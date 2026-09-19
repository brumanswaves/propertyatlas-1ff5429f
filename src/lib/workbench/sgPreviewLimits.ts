export const SG_PREVIEW_MAX_BYTES = 25 * 1024 * 1024;
export const SG_PREVIEW_MAX_PIXELS = 12_000_000;

export function checkSgPreviewPage(width: number, height: number, page: number, count: number) {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    !Number.isInteger(page) ||
    page < 0 ||
    page >= count ||
    count > 32 ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > SG_PREVIEW_MAX_PIXELS
  ) {
    throw new Error(
      "This sheet exceeds the local preview limit. Open the original for manual review; no interpretation has started.",
    );
  }
}

export function checkSgPreviewSamples(samples: number, bits: number[]) {
  if (
    !Number.isInteger(samples) ||
    samples < 1 ||
    samples > 4 ||
    bits.length > 4 ||
    bits.some((bit) => ![1, 2, 4, 8].includes(bit))
  ) {
    throw new Error("Unsupported TIFF pixel format. Open the original for manual review.");
  }
}
