# vtracer-wasm

WebAssembly binding for [vtracer](https://github.com/visioncortex/vtracer) — converts raster images (PNG, JPG, etc.) to SVG vector graphics directly in the browser.

## Build

```bash
wasm-pack build --target web
```

Output will be in the `pkg/` directory.

## API

### `trace_image(data, ...options, progress?): string`

Converts raw image bytes to an SVG string.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `data` | `Uint8Array` | *(required)* | Raw image file bytes (PNG, JPG, BMP, etc.) |
| `colormode` | `string \| null` | `"color"` | `"color"` for true color, `"bw"` for black & white |
| `filter_speckle` | `number \| null` | `4` | Discard patches smaller than N×N px |
| `color_precision` | `number \| null` | `6` | Significant bits per RGB channel (1–8) |
| `gradient_step` | `number \| null` | `16` | Color difference between gradient layers |
| `corner_threshold` | `number \| null` | `60` | Minimum angle (degrees) to be considered a corner |
| `segment_length` | `number \| null` | `4.0` | Max segment length before iterative subdivision |
| `splice_threshold` | `number \| null` | `45` | Minimum angle displacement (degrees) to splice a spline |
| `mode` | `string \| null` | `"spline"` | Curve fitting: `"pixel"`, `"polygon"`, or `"spline"` |
| `hierarchical` | `string \| null` | `"stacked"` | Clustering: `"stacked"` or `"cutout"` |
| `path_precision` | `number \| null` | `2` | Decimal places in SVG path coordinates |
| `preset` | `string \| null` | `null` | Preset config: `"bw"`, `"poster"`, or `"photo"` (overrides defaults) |
| `progress` | `Function \| null` | `null` | Callback `(percent: number) => void`, called with 0–100 |

All parameters except `data` are optional — pass `null` or `undefined` to use defaults.

## Processing Flow

The conversion goes through these stages, each reporting progress:

```
0%   ─── Start
5%   ─── Image decoded (PNG/JPG bytes → RGBA pixels)
10%  ─── Config parsed & validated
15%  ─── Keying phase (transparent pixel handling)
│
├─── Color mode:
│    50%  ─── Color clustering complete (Runner.run())
│    55%  ─── Cutout re-clustering (if hierarchical = "cutout")
│    55–95% ─── Path tracing per cluster (granular progress)
│
├─── Binary mode:
│    15%  ─── Binary conversion complete
│    40%  ─── Cluster detection complete
│    40–95% ─── Path tracing per cluster (granular progress)
│
95%  ─── All paths converted
100% ─── SVG string serialized
```

### Detailed stage breakdown

1. **Image Decode (0→5%)** — Raw file bytes are decoded into RGBA pixels using the `image` crate. Supports PNG, JPEG, BMP, GIF, TIFF, etc.

2. **Config Setup (5→10%)** — If a `preset` is specified (`bw`/`poster`/`photo`), it loads preset defaults. Individual parameters then override the preset or default values.

3. **Keying (10→15%)** — For images with transparency, the algorithm finds an unused color in the image and replaces all transparent pixels with it. This "key color" is later discarded from the output, preserving transparency in the SVG.

4. **Clustering (15→50%)** — The core visioncortex `Runner` groups adjacent pixels of similar color into clusters. This is the most computationally intensive step for color images. Parameters like `color_precision` (controls color matching strictness) and `gradient_step` (layer difference) heavily influence this stage.

5. **Cutout Re-clustering (50→55%)** — Only applies when `hierarchical = "cutout"`. Performs a second clustering pass on the flattened image to create non-overlapping SVG shapes instead of stacked layers.

6. **Path Conversion (55→95%)** — Each cluster is converted to SVG path data. This is where `mode` matters:
   - `"pixel"` — No simplification, raw pixel boundaries
   - `"polygon"` — Straight-line polygon approximation
   - `"spline"` — Smooth Bézier curve fitting (best quality, default)
   
   The `corner_threshold`, `segment_length`, `splice_threshold`, and `max_iterations` parameters control the curve fitting quality. Progress is reported per-cluster, giving granular feedback.

7. **Serialization (95→100%)** — The internal SVG structure is serialized to an XML string with the specified `path_precision` decimal places.

## Usage in React

### Install

```bash
# From your React project directory
npm install ../vtracer/vtracer-wasm/pkg
```

### Basic usage

```tsx
import { useState } from "react";
import init, { trace_image } from "vtracer-wasm";

const wasmReady = init();

export default function ImageTracer() {
  const [svg, setSvg] = useState("");
  const [progress, setProgress] = useState(0);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await wasmReady;
    const data = new Uint8Array(await file.arrayBuffer());

    const result = trace_image(
      data,           // image bytes
      "color",        // colormode
      4,              // filter_speckle
      6,              // color_precision
      16,             // gradient_step
      60,             // corner_threshold
      4.0,            // segment_length
      45,             // splice_threshold
      "spline",       // mode
      "stacked",      // hierarchical
      2,              // path_precision
      null,           // preset
      (pct: number) => setProgress(pct), // progress callback
    );

    setSvg(result);
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFile} />
      <progress value={progress} max={100} />
      {svg && <div dangerouslySetInnerHTML={{ __html: svg }} />}
    </div>
  );
}
```

### With defaults (minimal)

```tsx
const result = trace_image(data);
```

### With preset

```tsx
const result = trace_image(
  data,
  null, null, null, null, null, null, null, null, null, null,
  "photo",  // preset
  (pct) => console.log(`${pct.toFixed(1)}%`), // progress
);
```

### Web Worker (recommended for large images)

```ts
// trace-worker.ts
import init, { trace_image } from "vtracer-wasm";

self.onmessage = async (e: MessageEvent) => {
  await init();
  const { data, options } = e.data;

  const svg = trace_image(
    data,
    options.colormode ?? null,
    options.filter_speckle ?? null,
    options.color_precision ?? null,
    options.gradient_step ?? null,
    options.corner_threshold ?? null,
    options.segment_length ?? null,
    options.splice_threshold ?? null,
    options.mode ?? null,
    options.hierarchical ?? null,
    options.path_precision ?? null,
    options.preset ?? null,
    (pct: number) => self.postMessage({ type: "progress", pct }),
  );

  self.postMessage({ type: "done", svg });
};
```

## Vite Configuration

```ts
// vite.config.ts
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [react(), wasm()],
});
```

## License

MIT / Apache-2.0
