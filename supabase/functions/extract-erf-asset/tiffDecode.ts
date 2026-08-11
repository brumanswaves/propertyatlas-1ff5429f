/**
 * Deno-only TIFF rasteriser for Surveyor-General diagrams.
 *
 * Real SG diagrams are often 70 to 120 megapixel CCITT Group 4 scans. Bilevel
 * pages are decoded to run lengths and accumulated directly into reduced PNGs,
 * so a full-size RGBA image is never materialised. Dense plans receive one
 * overview plus a bounded set of overlapping detail tiles.
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
  planBilevelTiffOutputs,
  planTiffRegionStrips,
  planTiffPageScale,
} from "../_shared/erfExtractionMedia.ts";

export interface TiffNormalizationResult {
  pages: NormalizedExtractionPage[];
  sourcePageCount: number;
  warning: string | null;
  downscaled: boolean;
  detailTileCount: number;
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
  const stream = new Blob([bytes as unknown as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function encodeInkPng(
  ink: Float32Array,
  width: number,
  height: number,
  cellArea: number,
  whiteIsZero: boolean,
) {
  const raw = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0;
    const rowStart = y * width;
    const rawStart = y * (width + 1) + 1;
    for (let x = 0; x < width; x += 1) {
      const coverage = Math.min(1, (ink[rowStart + x] / cellArea) * 1.6);
      const value = Math.round(255 * (1 - coverage));
      raw[rawStart + x] = whiteIsZero ? value : 255 - value;
    }
  }
  const idat = await deflate(raw);

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 0;

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

interface DecodeRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function decodeG4Strip(
  data: Uint8Array,
  byteOffset: number,
  byteLength: number,
  width: number,
  region: DecodeRegion,
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
  const regionHeight = Math.max(1, region.y1 - region.y0);

  const addRun = (from: number, to: number, clr: number) => {
    if (clr !== 1) return;
    const absY = y + yBase;
    if (absY < region.y0 || absY >= region.y1) return;
    const start = Math.max(region.x0, from);
    const stop = Math.min(region.x1, to);
    if (stop <= start) return;
    const dstY = Math.min(
      dstHeight - 1,
      Math.floor(((absY - region.y0) * dstHeight) / regionHeight),
    );
    const rowBase = dstY * dstWidth;
    for (let x = start; x < stop; x += 1) ink[rowBase + colBin[x]] += 1;
  };

  while (bitOffset < endBit && y < stripRows) {
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
    const bit = lsbFirst
      ? (byte >>> (bitOffset & 7)) & 1
      : (byte >>> (7 - (bitOffset & 7))) & 1;
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
  options: { region?: DecodeRegion; maxEdgePx?: number } = {},
) {
  const region: DecodeRegion = options.region ?? { x0: 0, y0: 0, x1: width, y1: height };
  const regionWidth = Math.max(1, region.x1 - region.x0);
  const regionHeight = Math.max(1, region.y1 - region.y0);
  const plan = planTiffPageScale(
    regionWidth,
    regionHeight,
    options.maxEdgePx ?? ERF_TIFF_MAX_BILEVEL_EDGE_PX,
  );
  const offsets = ifd.t273 ?? [];
  const counts = ifd.t279 ?? [];
  if (offsets.length === 0 || counts.length !== offsets.length) {
    throw new TiffNormalizationError("This diagram has no readable image data.");
  }
  const rowsPerStrip = tag(ifd, "t278") ?? height;
  const lsbFirst = (tag(ifd, "t266") ?? 1) === 2;
  const whiteIsZero = (tag(ifd, "t262") ?? 0) === 0;

  const colBin = new Int32Array(width);
  for (let x = 0; x < width; x += 1) {
    colBin[x] = Math.min(
      plan.width - 1,
      Math.max(0, Math.floor(((x - region.x0) * plan.width) / regionWidth)),
    );
  }

  const ink = new Float32Array(plan.width * plan.height);
  const stripWork = planTiffRegionStrips({
    height,
    rowsPerStrip,
    stripCount: offsets.length,
    y0: region.y0,
    y1: region.y1,
  });
  for (const strip of stripWork) {
    decodeG4Strip(
      bytes,
      offsets[strip.index],
      counts[strip.index],
      width,
      region,
      strip.rowCount,
      strip.yBase,
      lsbFirst,
      colBin,
      plan.width,
      plan.height,
      ink,
    );
  }

  const cellArea = (regionWidth / plan.width) * (regionHeight / plan.height);
  return {
    png: await encodeInkPng(ink, plan.width, plan.height, cellArea, whiteIsZero),
    plan,
  };
}

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

export async function normalizeTiffToPngPages(bytes: Uint8Array): Promise<TiffNormalizationResult> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  let ifds: unknown[];
  try {
    ifds = UTIF.decode(buffer);
  } catch {
    throw new TiffNormalizationError(
      "This TIFF could not be read. It may be corrupted or in an unsupported format.",
    );
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
  let detailTileCount = 0;

  for (let index = 0; index < usable.length; index += 1) {
    const ifd = usable[index] as G4Ifd & { width?: number; height?: number };
    const srcWidth = tag(ifd, "t256") ?? 0;
    const srcHeight = tag(ifd, "t257") ?? 0;
    if (!srcWidth || !srcHeight) {
      warnings.push(`Page ${index + 1} of this diagram has no readable image data.`);
      continue;
    }

    const isBilevelG4 = (tag(ifd, "t258") ?? 0) === 1 && (tag(ifd, "t259") ?? 0) === 4;
    const bilevelOutputs = isBilevelG4 ? planBilevelTiffOutputs(srcWidth, srcHeight) : null;
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
        const converted = await convertBilevelPage(bytes, ifd, srcWidth, srcHeight, {
          maxEdgePx: bilevelOutputs!.overview.maxEdgePx,
        });
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
      detail: null,
    });

    if (!isBilevelG4) continue;
    for (const detail of bilevelOutputs!.details) {
      const tile = detail.tile;
      try {
        const converted = await convertBilevelPage(bytes, ifd, srcWidth, srcHeight, {
          region: { x0: tile.x0, y0: tile.y0, x1: tile.x1, y1: tile.y1 },
          maxEdgePx: detail.output.maxEdgePx,
        });
        const tileBudget = checkConvertedByteBudget(
          converted.png.byteLength,
          totalBytes + converted.png.byteLength,
        );
        if (!tileBudget.ok) {
          warnings.push(tileBudget.message);
          break;
        }
        totalBytes += converted.png.byteLength;
        detailTileCount += 1;
        pages.push({
          pageNumber: index + 1,
          mimeType: ERF_NORMALIZED_IMAGE_MIME,
          base64: toBase64(converted.png),
          width: converted.plan.width,
          height: converted.plan.height,
          detail: tile,
        });
      } catch {
        warnings.push(`One detail crop on page ${index + 1} could not be converted.`);
      }
    }
  }

  if (pages.length === 0) {
    throw new TiffNormalizationError(
      warnings[0] ?? "No page of this TIFF diagram could be converted for reading.",
    );
  }

  return {
    pages,
    sourcePageCount,
    warning: warnings.length > 0 ? Array.from(new Set(warnings)).join(" ") : null,
    downscaled,
    detailTileCount,
  };
}
