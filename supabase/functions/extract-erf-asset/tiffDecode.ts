/**
 * Deno-only TIFF rasteriser for Surveyor-General diagrams.
 *
 * Pure JavaScript on purpose: Supabase Edge Functions run on Deno with no
 * native addons, so Sharp/libvips/ImageMagick are unavailable.
 *
 * Real SG diagrams are CCITT Group 4 bilevel scans of 70-120 megapixels. Two
 * things make those readable inside an Edge Function's small CPU and memory
 * budget:
 *   1. the G4 stream is decoded to run lengths and box-averaged straight into
 *      the reduced page, so the full-size image is never materialised;
 *   2. the reduced page is written as an 8-bit greyscale PNG using the
 *      runtime's native deflate, which is far cheaper than a JS encoder.
 * Anything that is not bilevel G4 falls back to UTIF + UPNG.
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
  ERF_TIFF_MAX_BILEVEL_EDGE_PX,
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

/* ------------------------------------------------------------------ *
 * Minimal greyscale PNG writer (native deflate)
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function deflate(bytes: Uint8Array) {
  const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** 8-bit greyscale PNG, filter type 0 on every row. */
async function encodeGrayPng(gray: Uint8Array, width: number, height: number) {
  const raw = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0;
    raw.set(gray.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }
  const idat = await deflate(raw);

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // colour type: greyscale

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks = [
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", new Uint8Array(0)),
  ];
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    png.set(chunk, offset);
    offset += chunk.length;
  }
  return png;
}

/* ------------------------------------------------------------------ *
 * CCITT Group 4 -> reduced greyscale
 * ------------------------------------------------------------------ */

type G4Ifd = {
  t256?: number[];
  t257?: number[];
  t258?: number[];
  t259?: number[];
  t262?: number[];
  t266?: number[];
  t273?: number[];
  t278?: number[];
  t279?: number[];
};

function tag(ifd: G4Ifd, key: keyof G4Ifd) {
  const value = ifd[key];
  return Array.isArray(value) && value.length > 0 ? Number(value[0]) : null;
}

/**
 * Decode one G4 strip, accumulating black-pixel coverage into `ink`.
 *
 * Runs, not pixels, come out of the decoder, so the cost is proportional to
 * the drawing's line work rather than to its pixel count.
 */
function decodeG4Strip(
  data: Uint8Array,
  byteOffset: number,
  byteLength: number,
  width: number,
  height: number,
  stripRows: number,
  yBase: number,
  lsbFirst: boolean,
  colBin: Int32Array,
  dstWidth: number,
  dstHeight: number,
  ink: Float32Array,
) {
  const dmap = UTIF.decode._dmap as Record<string, number>;
  const lens = UTIF.decode._lens as Record<number, Record<string, number>>;

  let ref: number[] = [width, width];
  let cur: number[] = [];
  let bitOffset = byteOffset << 3;
  const endBit = (byteOffset + byteLength) << 3;
  let a0 = -1;
  let color = 0;
  let word = "";
  let mode = "";
  let toRead = 0;
  let runLength = 0;
  let y = 0;

  const addRun = (from: number, to: number, clr: number) => {
    if (clr !== 1) return;
    const start = Math.max(0, from);
    const stop = Math.min(width, to);
    if (stop <= start) return;
    const dstY = Math.min(dstHeight - 1, Math.floor(((y + yBase) * dstHeight) / height));
    const rowBase = dstY * dstWidth;
    for (let x = start; x < stop; x += 1) ink[rowBase + colBin[x]] += 1;
  };

  while (bitOffset < endBit && y < stripRows) {
    // b1: first changing element on the reference line right of a0 with the
    // opposite colour; b2: the one after it.
    let b1 = width;
    let b2 = width;
    for (let i = 0; i < ref.length; i += 1) {
      if (ref[i] > a0 && (i & 1) === color) {
        b1 = ref[i];
        b2 = i + 1 < ref.length ? ref[i + 1] : width;
        break;
      }
    }

    const byte = data[bitOffset >>> 3] ?? 0;
    const bit = lsbFirst ? (byte >>> (bitOffset & 7)) & 1 : (byte >>> (7 - (bitOffset & 7))) & 1;
    bitOffset += 1;
    word += bit;

    if (mode === "H") {
      const clr = toRead === 2 ? color : 1 - color;
      const value = lens[clr][word];
      if (value != null) {
        word = "";
        runLength += value;
        if (value < 64) {
          const start = a0 < 0 ? 0 : a0;
          addRun(start, start + runLength, clr);
          cur.push(start + runLength);
          a0 = start + runLength;
          runLength = 0;
          toRead -= 1;
          if (toRead === 0) mode = "";
        }
      }
    } else if (word === "0001") {
      word = "";
      addRun(a0 < 0 ? 0 : a0, b2, color);
      a0 = b2;
    } else if (word === "001") {
      word = "";
      mode = "H";
      toRead = 2;
      runLength = 0;
    } else if (dmap[word] != null) {
      const a1 = b1 + dmap[word];
      word = "";
      addRun(a0 < 0 ? 0 : a0, a1, color);
      cur.push(a1);
      a0 = a1;
      color = 1 - color;
    }

    if (a0 >= width && mode === "") {
      cur.push(width, width);
      ref = cur;
      cur = [];
      y += 1;
      a0 = -1;
      color = 0;
      word = "";
    }

    if (word.length > 24) throw new TiffNormalizationError("This diagram could not be decoded.");
  }
  return y;
}

async function convertBilevelPage(
  bytes: Uint8Array,
  ifd: G4Ifd,
  width: number,
  height: number,
) {
  const plan = planTiffPageScale(width, height, ERF_TIFF_MAX_BILEVEL_EDGE_PX);
  const offsets = ifd.t273 ?? [];
  const counts = ifd.t279 ?? [];
  if (offsets.length === 0 || counts.length !== offsets.length) {
    throw new TiffNormalizationError("This diagram has no readable image data.");
  }
  const rowsPerStrip = tag(ifd, "t278") ?? height;
  const lsbFirst = (tag(ifd, "t266") ?? 1) === 2;
  // PhotometricInterpretation 0 (WhiteIsZero) is the G4 norm: a set bit is ink.
  const whiteIsZero = (tag(ifd, "t262") ?? 0) === 0;

  const colBin = new Int32Array(width);
  for (let x = 0; x < width; x += 1) {
    colBin[x] = Math.min(plan.width - 1, Math.floor((x * plan.width) / width));
  }

  const ink = new Float32Array(plan.width * plan.height);
  let decodedRows = 0;
  for (let strip = 0; strip < offsets.length && decodedRows < height; strip += 1) {
    const stripRows = Math.min(rowsPerStrip, height - decodedRows);
    decodeG4Strip(
      bytes,
      offsets[strip],
      counts[strip],
      width,
      height,
      stripRows,
      decodedRows,
      lsbFirst,
      colBin,
      plan.width,
      plan.height,
      ink,
    );
    decodedRows += stripRows;
  }

  const cellArea = (width / plan.width) * (height / plan.height);
  const gray = new Uint8Array(plan.width * plan.height);
  for (let i = 0; i < gray.length; i += 1) {
    const coverage = Math.min(1, (ink[i] / cellArea) * 1.6);
    const value = Math.round(255 * (1 - coverage));
    gray[i] = whiteIsZero ? value : 255 - value;
  }

  return { png: await encodeGrayPng(gray, plan.width, plan.height), plan };
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
export async function normalizeTiffToPngPages(bytes: Uint8Array): Promise<TiffNormalizationResult> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  let ifds: unknown[];
  try {
    ifds = UTIF.decode(buffer);
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
    const ifd = usable[index] as G4Ifd & { width?: number; height?: number };
    const srcWidth = tag(ifd, "t256") ?? 0;
    const srcHeight = tag(ifd, "t257") ?? 0;
    if (!srcWidth || !srcHeight) {
      warnings.push(`Page ${index + 1} of this diagram has no readable image data.`);
      continue;
    }

    const isBilevelG4 = (tag(ifd, "t258") ?? 0) === 1 && (tag(ifd, "t259") ?? 0) === 4;
    const pixelBudget = checkTiffPixelBudget(srcWidth, srcHeight, { bilevel: isBilevelG4 });
    if (!pixelBudget.ok) {
      warnings.push(pixelBudget.message);
      continue;
    }

    let png: Uint8Array;
    let planWidth: number;
    let planHeight: number;
    try {
      if (isBilevelG4) {
        const converted = await convertBilevelPage(bytes, ifd, srcWidth, srcHeight);
        png = converted.png;
        planWidth = converted.plan.width;
        planHeight = converted.plan.height;
        if (converted.plan.downscaled) downscaled = true;
      } else {
        UTIF.decodeImage(buffer, ifd, ifds);
        const rgba = new Uint8Array(UTIF.toRGBA8(ifd));
        const plan = planTiffPageScale(srcWidth, srcHeight);
        const pixels = plan.downscaled
          ? resizeRgba(rgba, srcWidth, srcHeight, plan.width, plan.height)
          : rgba;
        if (plan.downscaled) downscaled = true;
        png = new Uint8Array(
          UPNG.encode([pixels.buffer as ArrayBuffer], plan.width, plan.height, 0) as ArrayBuffer,
        );
        planWidth = plan.width;
        planHeight = plan.height;
      }
    } catch (error) {
      warnings.push(
        error instanceof TiffNormalizationError
          ? error.message
          : `Page ${index + 1} of this diagram could not be converted.`,
      );
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
      width: planWidth,
      height: planHeight,
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
