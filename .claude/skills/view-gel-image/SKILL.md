---
name: view-gel-image
description: Preview TIFF, high-bit-depth, or oversized scientific rasters when direct viewing is unsupported or impractical. Ordinary directly viewable PNG/JPEG files do not need conversion.
---

# Scientific Image Preview

Create a temporary preview for visual inspection; preserve the original for measurements, ROI/grid detection, and quantitative analysis.

- Limit input to the named files or diagnosed failure list. For a requested directory, convert that directory and inspect a representative batch first.
- Prefer a compatible project preview helper. Otherwise copy this Skill's `scripts/compress_for_preview.py` into a temporary directory's `scripts/` folder so its `outputs/preview/` stays temporary. Always supply an explicit absolute input path; the helper's default input is project-specific.
- The helper uses NumPy, Pillow, and scikit-image. Use an existing compatible environment; report missing dependencies rather than adding project dependencies as a side effect.
- Run `python <helper-path> <absolute-input-path>`. It detects content rather than trusting extensions, drops alpha, normalizes to uint8 grayscale, and downsamples to a 1280-pixel long edge. `LONG_EDGE=2048` can retain more band detail.
- Inspect conversion diagnostics, then view the generated PNGs in small batches. Reuse previews only when input, settings, and file identity match; equal stems from different inputs need separate output directories.
- Global min/max normalization can hide bands near bright outliers. If relevant detail is unclear, use a larger preview or a documented percentile-normalized preview. Preview intensities and coordinates are not measurement data.

Report findings with the original-to-preview mapping and any detail lost during conversion.
