import UTIF from "utif2";
import { checkSgPreviewPage, checkSgPreviewSamples, SG_PREVIEW_MAX_BYTES } from "./sgPreviewLimits";

self.onmessage = async (event: MessageEvent<{ file: Blob; page: number }>) => {
  try {
    const { file, page } = event.data;
    if (file.size > SG_PREVIEW_MAX_BYTES) throw new Error("File exceeds the local preview limit.");
    const buffer = await file.arrayBuffer();
    const pages = UTIF.decode(buffer);
    const ifd = pages[page];
    const width = Number(ifd?.t256?.[0]);
    const height = Number(ifd?.t257?.[0]);
    checkSgPreviewPage(width, height, page, pages.length);
    checkSgPreviewSamples(Number(ifd.t277?.[0] ?? 1), ifd.t258 ?? [1]);
    // Validate dimensions before decompression/RGBA allocation, inside a terminable worker.
    UTIF.decodeImage(buffer, ifd);
    const rgba = UTIF.toRGBA8(ifd);
    const canvas = new OffscreenCanvas(width, height);
    canvas
      .getContext("2d")!
      .putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
    const scale = Math.min(1, 1600 / Math.max(width, height));
    const preview = new OffscreenCanvas(
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale)),
    );
    preview.getContext("2d")!.drawImage(canvas, 0, 0, preview.width, preview.height);
    self.postMessage({
      blob: await preview.convertToBlob({ type: "image/png" }),
      pageCount: pages.length,
      width,
      height,
    });
  } catch {
    self.postMessage({
      error:
        "This TIFF cannot be previewed within local safety limits. Open the original for manual review. No interpretation has started.",
    });
  }
};
