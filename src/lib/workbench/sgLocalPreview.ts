import { SG_PREVIEW_MAX_BYTES } from "./sgPreviewLimits";
export { SG_PREVIEW_MAX_BYTES, SG_PREVIEW_MAX_PIXELS, checkSgPreviewPage } from "./sgPreviewLimits";
export const SG_PREVIEW_VERSION = 1;
export const SG_PREVIEW_DEADLINE_MS = 8_000;

export type SgPreviewResult = { blob: Blob; pageCount: number; width: number; height: number };

/** Only renders pixels locally. It never supplies evidence or sends a file to AI. */
export function renderLocalSgTiff(
  file: Blob,
  page: number,
  signal: AbortSignal,
): Promise<SgPreviewResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Preview closed."));
      return;
    }
    if (file.size > SG_PREVIEW_MAX_BYTES) {
      reject(new Error("File exceeds the local preview limit."));
      return;
    }
    const worker = new Worker(new URL("./sgPreview.worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = (result?: SgPreviewResult, error?: string) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate();
      if (result) resolve(result);
      else reject(new Error(error ?? "Preview unavailable. Open the original for manual review."));
    };
    const abort = () => finish(undefined, "Preview closed.");
    const timer = setTimeout(
      () =>
        finish(
          undefined,
          "Local preview took too long. Open the original for manual review; no interpretation has started.",
        ),
      SG_PREVIEW_DEADLINE_MS,
    );
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<SgPreviewResult & { error?: string }>) => {
      if (event.data.error) finish(undefined, event.data.error);
      else finish(event.data);
    };
    worker.onerror = () => finish();
    worker.postMessage({ file, page });
  });
}
