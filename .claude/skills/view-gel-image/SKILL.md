---
name: view-gel-image
description: Safely inspect very large, 16-bit, or unusual raster images such as electrophoresis gels, microscopy TIFF files, and large scans without exhausting the multimodal context on the original. Trigger when the user asks to view a `.tif`, `.tiff`, a `.jpg` that is actually TIFF, an image larger than 2 MB, a known non-8-bit raster, or when direct image reading reports unsupported bit depth or excessive size.
---

# view-gel-image: Safe Large-Image Preview

English | [Chinese](SKILL-zh.md)

## When to use it

1. The input is `.tif`, `.tiff`, a `.jpg` whose actual format is TIFF, or a PNG larger than 2 MB.
2. The image is known to be 16-bit or otherwise not uint8.
3. Direct image reading reports excessive size or unsupported bit depth.
4. Several images need batch diagnosis.

An 8-bit PNG or JPEG smaller than 1 MB can normally be viewed directly without this Skill.

## Core principle

**Do not read the original directly.**

- A 16-bit TIFF may use a misleading `.jpg` extension, as seen in FluxGel batch5/batch6, and the multimodal decoder may reject it.
- An original whose longest side exceeds 3000 px consumes substantial context, especially when several images are inspected together.
- Converting a gel image to uint8 and downsampling normally preserves enough diagnostic detail to assess band positions and ROI alignment.

Use this sequence: compress, write to a temporary preview location, then read the preview.

## Required workflow

### 1. Prepare the compression script

Prefer an existing project `scripts/compress_for_preview.py`. If none exists, copy this Skill's `scripts/compress_for_preview.py` into the project.

Script contract:

- Input: one file or a directory containing supported image extensions.
- Output: `outputs/preview/<stem>.png`, grayscale uint8 with a default 1280 px long edge.
- Set `LONG_EDGE=1536` or another value for a larger preview.
- Conversion: 16-bit → float → linear normalization `(x - min) / (max - min)` → `[0, 255]` uint8.

### 2. Bound the input set

- When the user names images, compress only those images.
- For “all failed images,” extract the failure list first, then compress the named files.
- For a directory, compress the directory but initially view only a small representative batch.

### 3. Run compression

```bash
python scripts/compress_for_preview.py path/to/image.jpg
python scripts/compress_for_preview.py test_images/batch5/
LONG_EDGE=1536 python scripts/compress_for_preview.py batch4/
```

Output stays under `outputs/preview/<stem>.png`. The script prints original dimensions, bit depth, output dimensions, and file size for each image; inspect that output first when conversion fails.

### 4. View the preview

```text
Read outputs/preview/Batch5-P1+P2.png
```

Estimate the context budget before each call. One compressed PNG is typically 300–500 KB, then grows by roughly 1.33× under base64 plus image tiling. View at most four to six files in parallel and split larger sets into batches.

### 5. Reuse a fresh preview

When `outputs/preview/<stem>.png` exists and its mtime is newer than the original, view it directly instead of recompressing.

## Common pitfalls

### A `.jpg` may actually be TIFF

Pillow's `Image.open` detects the magic bytes rather than trusting the extension, and `np.array(img)` can return the uint16 ndarray directly. Use the same normalization path instead of assuming a `.jpg` is 8-bit.

### RGBA alpha can distort grayscale

For a TIFF with alpha, drop it with `raw[..., :3]` before taking the RGB mean. Do not include alpha through `raw.mean(axis=2)`.

### Outliers can dominate normalization

Global min-max normalization can make a gel too dark when a few wells are extremely bright. If bands become unreadable, switch to percentile normalization with `lo = P1(arr)` and `hi = P99(arr)`. The current script uses global min-max because it is usually sufficient; document the change if it is replaced.

### A small long edge can hide the grid

The 1280 px default downsamples a 4000×3000 original by roughly three times. Marker and lane structure remain visible, but individual band boundaries may not. Use `LONG_EDGE=2048` for band-alignment detail.

### Preview pixels are not algorithm input

The compressed output exists only for visual inspection. Do not feed it to `detect_roi` or grid detection because those parameters are calibrated to original image dimensions.

## Background

This failure mode was first recorded in another image-processing project's known issues when a 16-bit TIFF used a `.jpg` extension. If it appears here, record the reusable conclusion in this project's known-issues documents. The ROI detector's v1 through v6 iterations also used the repeated modify → compress → view several images loop, which is the Skill's intended use.
