---
name: view-gel-image
description: 用于查看超大/16-bit/非常规格式的图片（凝胶电泳胶图、显微镜 TIFF、扫描大图等），避免 Claude 多模态能力直接 Read 原图爆 context。触发条件：用户要求"看"或"检查"某张 .tif/.tiff/.jpg（实为 TIFF）、> 2 MB 的图片、或已知位深非 8-bit 的栅格图像；以及 Claude 在 Read 图片时报"文件过大"或"位深不支持"。
---

# view-gel-image — 大图安全预览

[English](SKILL.md) | 中文

## 何时使用

1. 用户发来 `.tif` / `.tiff` / 实为 TIFF 的 `.jpg` / 体积 > 2 MB 的 PNG
2. 已知 16-bit 或非 uint8 位深的图像
3. Claude Read 图片返回"文件过大" / "位深不支持"
4. 需要一次看多张图（批量诊断）

对 8-bit、体积 < 1 MB 的 PNG / JPG 可以直接 Read，不走本 skill。

## 核心原则

**不要直接 `Read` 原图**。原因：
- 16-bit TIFF 常被伪装成 `.jpg` 扩展名（如 FluxGel 的 batch5/batch6），Claude 多模态解码器读不进来
- 长边 > 3000 px 的原图进 context 会吃掉大量 token，多看几张就溢出
- 胶图灰度信息压到 uint8 + 下采样后基本不损失诊断信息（band 位置、ROI 正确性都肉眼可判）

**正确流程**：压缩 → 输出到临时目录 → `Read` 压缩产物。

## 黄金工作流（不可跳过）

### 1. 准备压缩脚本

项目里优先复用 `scripts/compress_for_preview.py`；没有时从本 skill 的 `scripts/compress_for_preview.py` 复制过去。

脚本契约：
- 输入：单文件路径 **或** 目录（目录下所有图像扩展名文件）
- 输出：`outputs/preview/<stem>.png`（灰度、uint8、长边默认 1280）
- 环境变量 `LONG_EDGE` 控制下采样目标（想看更清晰就 `LONG_EDGE=1536`）
- 处理：16-bit → float → 线性归一化 `(x - min) / (max - min)` → 映射到 `[0, 255]` uint8

### 2. 选择压缩范围

- 用户点名几张 → 只压那几张（节省时间）
- 用户说"所有失败的图" → 先把失败清单 grep 出来，然后按名字一张张压
- 用户只给目录 → 全目录压，但只 Read 前几张

### 3. 执行压缩

```bash
python scripts/compress_for_preview.py path/to/image.jpg
# 或
python scripts/compress_for_preview.py test_images/batch5/
# 或改长边
LONG_EDGE=1536 python scripts/compress_for_preview.py batch4/
```

产物路径固定在 `outputs/preview/<stem>.png`。脚本会打印每张图的原尺寸 / 位深 / 产物尺寸 / 文件大小，出问题时先看这段输出。

### 4. Read 压缩产物

```
Read outputs/preview/Batch5-P1+P2.png
```

**每次调用前估算 token 预算**：单张压缩 PNG ~ 300-500 KB，Claude 一次 Read 会把图片做 base64 转码（原始体积 × ~1.33 再加上分 tile）。一次最多并行 Read 4-6 张，再多就分批。

### 5. 已处理过的图无需重压

`outputs/preview/<stem>.png` 存在且 mtime 晚于原图 → 直接 Read，跳过压缩。

## 常见坑点

### `.jpg` 其实是 TIFF
PIL `Image.open` 能识别魔数不看扩展名，`np.array(img)` 直接拿到 uint16 ndarray。**不要** 先假设 `.jpg` 是 8-bit 再报错；都走同一条归一化路径就对了。

### RGBA alpha 污染
部分 TIFF 有 alpha 通道。`raw[..., :3]` 丢掉 alpha 再取 RGB 均值，不要按 `raw.mean(axis=2)` 把 alpha 也算进去。

### 归一化被离群值吃掉
线性 min-max 在有"极亮 wells"时会压缩 gel 内部对比度。若发现压缩后 gel 一片暗看不清 band，可以改成分位数归一化（`lo = P1(arr)`, `hi = P99(arr)`）。脚本目前用全局 min-max，够用但不是最优，换的时候记得标注。

### 长边太小看不清 grid
默认 1280 对 4000x3000 原图下采样 ~3 倍，肉眼能看清 marker / lane 结构但看不清单个 band 边界。要看 band 对齐细节就 `LONG_EDGE=2048`。

### 别把压缩图当作算法输入
本 skill 产物**只给 Claude 看**，不要用它跑 detect_roi / 栅格检测 —— 那些算法参数都按原图尺度调的。

## 沉淀参考

这个坑最早在另一个图像处理项目（FluxGel）的已知问题记录里出现（「16-bit TIFF 伪装成 .jpg 扩展名」）；本仓库若遇到同类问题，应把可复用结论记录到项目的中英文已知问题文档。ROI 检测 v1 → v6 的迭代也采用了重复的“修改 → 压缩 → Read → 查看多张图”循环，这正是本 Skill 的预期用法。
