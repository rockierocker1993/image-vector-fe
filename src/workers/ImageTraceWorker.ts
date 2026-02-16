import init, { trace_image } from 'vtracer-wasm';

let wasmReady: Promise<unknown> | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { id, data } = e.data as { id: number; data: Uint8Array };

  try {
    if (!wasmReady) {
      wasmReady = init();
    }
    await wasmReady;

    const svg = trace_image(
      data,
      'color',
      4,
      6,
      16,
      60,
      4.0,
      45,
      'spline',
      null,
      null,
      null,
      (percent: number) => {
        self.postMessage({ id, type: 'progress', percent });
      }
    );
    self.postMessage({ id, svg });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
