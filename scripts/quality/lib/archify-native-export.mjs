import { writeFileSync } from "node:fs";
import {
  ChromeVisualBrowser,
  findChrome,
} from "../../../.claude/skills/archify/bin/visual-check.mjs";
import { nativePngExpectation, pngDimensions } from "./archify.mjs";

const NATIVE_PNG_EXPRESSION = `(async function () {
  if (!window.Archify || !Archify.exportMenu || typeof Archify.exportMenu.run !== 'function') {
    throw new Error('Archify native export runtime is unavailable.');
  }
  var svg = document.querySelector('.diagram-container svg');
  if (!svg || !svg.viewBox || !svg.viewBox.baseVal) {
    throw new Error('Archify canonical SVG is unavailable.');
  }

  var capturedBlob = null;
  var capturedFilename = '';
  var alertMessage = '';
  var originalCreateObjectURL = URL.createObjectURL;
  var originalAnchorClick = HTMLAnchorElement.prototype.click;
  var originalAlert = window.alert;

  URL.createObjectURL = function (blob) {
    capturedBlob = blob;
    return originalCreateObjectURL.call(URL, blob);
  };
  HTMLAnchorElement.prototype.click = function () {
    capturedFilename = this.download || '';
  };
  window.alert = function (message) {
    alertMessage = String(message || '');
  };

  try {
    await Archify.exportMenu.run('png');
    var root = document.documentElement;
    var exportError = root.getAttribute('data-last-export-error') || alertMessage;
    if (exportError) throw new Error(exportError);
    if (!capturedBlob || capturedBlob.type !== 'image/png' || capturedBlob.size <= 0) {
      throw new Error('Archify native PNG export returned no non-empty PNG blob.');
    }

    var buffer = await capturedBlob.arrayBuffer();
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var offset = 0; offset < bytes.length; offset += 32768) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 32768));
    }

    var vb = svg.viewBox.baseVal;
    var scale = 1;
    for (var candidate = 4; candidate >= 1; candidate -= 1) {
      if (vb.width * candidate * vb.height * candidate <= 16 * 1024 * 1024) {
        scale = candidate;
        break;
      }
    }

    return {
      base64: btoa(binary),
      filename: capturedFilename,
      bytes: capturedBlob.size,
      format: root.getAttribute('data-last-export-format') || '',
      canonical: root.getAttribute('data-last-export-canonical') || '',
      viewBoxWidth: vb.width,
      viewBoxHeight: vb.height,
      scale: scale,
      expectedWidth: Math.trunc(vb.width * scale),
      expectedHeight: Math.trunc(vb.height * scale)
    };
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
    window.alert = originalAlert;
  }
})()`;

async function evaluate(browser, sessionId, expression, awaitPromise = false) {
  const response = await browser.cdp.send(
    "Runtime.evaluate",
    {
      expression,
      awaitPromise,
      returnByValue: true,
    },
    sessionId,
    60000
  );
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ||
        response.exceptionDetails.text ||
        "Runtime.evaluate failed"
    );
  }
  return response.result?.value;
}

export async function exportNativePng({ artifactPath, outputPath, theme = "light" }) {
  const chrome = findChrome();
  if (!chrome) throw new Error("未找到 Chrome/Chromium，无法执行 Viewer 原生 PNG 导出。");

  const browser = new ChromeVisualBrowser(chrome);
  try {
    await browser.inspect({
      artifactPath,
      width: 1440,
      height: 900,
      theme,
    });
    const sessionId = await browser.sessionPromise;
    const receipt = await evaluate(browser, sessionId, NATIVE_PNG_EXPRESSION, true);
    if (!receipt || receipt.format !== "png" || receipt.canonical !== "true") {
      throw new Error(`Viewer 原生导出回执无效：${JSON.stringify(receipt)}`);
    }

    const bytes = Buffer.from(receipt.base64 || "", "base64");
    if (bytes.length !== Number(receipt.bytes)) {
      throw new Error(`原生 PNG 字节数与回执不一致：文件 ${bytes.length}，回执 ${receipt.bytes}。`);
    }

    const actual = pngDimensions(bytes);
    const expectedFromPage = {
      width: Number(receipt.expectedWidth),
      height: Number(receipt.expectedHeight),
    };
    const expectedFromContract = nativePngExpectation(
      `<svg viewBox="0 0 ${receipt.viewBoxWidth} ${receipt.viewBoxHeight}"></svg>`
    );
    if (
      actual.width !== expectedFromPage.width ||
      actual.height !== expectedFromPage.height ||
      actual.width !== expectedFromContract.width ||
      actual.height !== expectedFromContract.height
    ) {
      throw new Error(
        `原生 PNG 尺寸不一致：实际 ${actual.width}x${actual.height}，` +
          `页面回执 ${expectedFromPage.width}x${expectedFromPage.height}，` +
          `契约 ${expectedFromContract.width}x${expectedFromContract.height}。`
      );
    }
    if (!String(receipt.filename || "").endsWith(".png")) {
      throw new Error(`Viewer 原生下载文件名不是 PNG：${JSON.stringify(receipt.filename)}`);
    }

    writeFileSync(outputPath, bytes);
    return {
      bytes: bytes.length,
      width: actual.width,
      height: actual.height,
      scale: expectedFromContract.scale,
      filename: receipt.filename,
      canonical: true,
      theme,
    };
  } finally {
    await browser.close();
  }
}
