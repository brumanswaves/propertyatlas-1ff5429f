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
    bits.length < 1 ||
    bits.length > 4 ||
    bits.some((bit) => ![1, 2, 4, 8].includes(bit))
  ) {
    throw new Error("Unsupported TIFF pixel format. Open the original for manual review.");
  }
}

export function checkSgPreviewEncoding(
  compression: number,
  photometric: number,
  tiled: boolean,
  group3Options: unknown = [0],
) {
  // JPEG/Deflate and camera-specific decoders can allocate outside the TIFF
  // dimensions. This local path permits only bounded strip output formats.
  if (tiled || ![1, 3, 4, 32773].includes(compression) || ![0, 1, 2, 3].includes(photometric)) {
    throw new Error("Unsupported TIFF encoding. Open the original for manual review.");
  }
  // Bit 0 selects 2-D coding and bit 2 permits EOL fill bits. The pinned
  // decoder does not support the bit 1 uncompressed extension or reserved bits.
  if (
    compression === 3 &&
    (!Array.isArray(group3Options) ||
      group3Options.length !== 1 ||
      ![0, 1, 4, 5].includes(group3Options[0]))
  ) {
    throw new Error("Unsupported Group 3 options. Open the original for manual review.");
  }
}
