/**
 * Deno-only TIFF rasteriser for Surveyor-General diagrams.
 *
 * Pure JavaScript on purpose: Supabase Edge Functions run on Deno with no
 * native addons, so Sharp/libvips/ImageMagick are unavailable. UTIF decodes
 * TIFF to RGBA and UPNG re-encodes to PNG; both are dependency-free JS and
 * are pinned to exact versions so a registry change cannot alter behaviour.
 *
 * Nothing here is persisted: converted bytes exist only for the duration of
 * one model call.
 */
// @ts-expect-error npm: specifiers are resolved by Deno at deploy time.
import UTIF from "npm:utif2@4.1.0";
// @ts-expect-error npm: specifiers are resolved by Deno at deploy time.
import UPNG from "npm:upng-js@2.1.0";

import {
  ERF_NORMALIZED_IMAGE_MIME,
  type NormalizedExtractionPage,
  checkConvertedByteBudget,
  checkTiffPageBudget,
  checkTiffPixelBudget,
  planTiffPageScale,
} from "../_shared/erfExtractionMedia.ts";


export interface TiffNormalizationResult {
  pages: NormalizedExtractionPage[];
  /** Pages present in the source file, even if some were skipped. */
  sourcePageCount: number;
  /** Honest, user-safe note when the conversion was partial. */
  warning: string | null;
  downscaled: boolean;
}

export class TiffNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TiffNormalizationError";
  }
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Nearest-neighbour RGBA downscale. Keeps hard cadastral line work crisp. */
function resizeRgba(
  rgba: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
) {
  const out = new Uint8Array(dstWidth * dstHeight * 4);
  for (let y = 0; y < dstHeight; y += 1) {
    const srcY = Math.min(srcHeight - 1, Math.floor((y * srcHeight) / dstHeight));
    for (let x = 0; x < dstWidth; x += 1) {
      const srcX = Math.min(srcWidth - 1, Math.floor((x * srcWidth) / dstWidth));
      const srcIndex = (srcY * srcWidth + srcX) * 4;
      const dstIndex = (y * dstWidth + x) * 4;
      out[dstIndex] = rgba[srcIndex];
      out[dstIndex + 1] = rgba[srcIndex + 1];
      out[dstIndex + 2] = rgba[srcIndex + 2];
      out[dstIndex + 3] = rgba[srcIndex + 3];
    }
  }
  return out;
}

/**
 * Decodes every page of a TIFF to PNG, in order, within the safety budgets.
 * Throws TiffNormalizationError when the file is corrupt or unreadable —
 * failing honestly is required, guessing is not acceptable.
 */
export function normalizeTiffToPngPages(bytes: Uint8Array): TiffNormalizationResult {
  let ifds: unknown[];
  try {
    ifds = UTIF.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  } catch (_error) {
    throw new TiffNormalizationError("This TIFF could not be read. It may be corrupted or in an unsupported format.");
  }
  if (!Array.isArray(ifds) || ifds.length === 0) {
    throw new TiffNormalizationError("This TIFF contains no readable pages.");
  }

  const sourcePageCount = ifds.length;
  const warnings: string[] = [];
  const pageBudget = checkTiffPageBudget(sourcePageCount);
  if (!pageBudget.ok) warnings.push(pageBudget.message);

  const usable = ifds.slice(0, Math.min(sourcePageCount, 8));
  const pages: NormalizedExtractionPage[] = [];
  let totalBytes = 0;
  let downscaled = false;

  for (let index = 0; index < usable.length; index += 1) {
    const ifd = usable[index] as { width?: number; height?: number };
    try {
      UTIF.decodeImage(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ifd, ifds);
    } catch (_error) {
      warnings.push(`Page ${index + 1} of this diagram could not be decoded.`);
      continue;
    }

    const srcWidth = Number(ifd.width ?? 0);
    const srcHeight = Number(ifd.height ?? 0);
    if (!srcWidth || !srcHeight) {
      warnings.push(`Page ${index + 1} of this diagram has no readable image data.`);
      continue;
    }

    const pixelBudget = checkTiffPixelBudget(srcWidth, srcHeight);
    if (!pixelBudget.ok) {
      warnings.push(pixelBudget.message);
      continue;
    }

    let rgba: Uint8Array;
    try {
      rgba = new Uint8Array(UTIF.toRGBA8(ifd));
    } catch (_error) {
      warnings.push(`Page ${index + 1} of this diagram could not be rendered.`);
      continue;
    }

    const plan = planTiffPageScale(srcWidth, srcHeight);
    const pixels =
      plan.downscaled ? resizeRgba(rgba, srcWidth, srcHeight, plan.width, plan.height) : rgba;
    if (plan.downscaled) downscaled = true;

    let png: Uint8Array;
    try {
      png = new Uint8Array(
        UPNG.encode([pixels.buffer as ArrayBuffer], plan.width, plan.height, 0) as ArrayBuffer,
      );
    } catch (_error) {
      warnings.push(`Page ${index + 1} of this diagram could not be converted.`);
      continue;
    }

    const byteBudget = checkConvertedByteBudget(png.byteLength, totalBytes + png.byteLength);
    if (!byteBudget.ok) {
      warnings.push(byteBudget.message);
      break;
    }
    totalBytes += png.byteLength;

    pages.push({
      pageNumber: index + 1,
      mimeType: ERF_NORMALIZED_IMAGE_MIME,
      base64: toBase64(png),
      width: plan.width,
      height: plan.height,
    });
  }

  if (pages.length === 0) {
    throw new TiffNormalizationError(
      warnings[0] ?? "No page of this TIFF diagram could be converted for reading.",
    );
  }

  return {
    pages,
    sourcePageCount,
    warning: warnings.length > 0 ? warnings.join(" ") : null,
    downscaled,
  };
}
