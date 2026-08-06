/**
 * Runtime-neutral media rules for Erf document extraction.
 *
 * TIFF is accepted only as a normalizable source. Raw TIFF bytes must never
 * leave the Edge Function or reach the model.
 */
import {
  ERF_EXTRACTION_TIFF_MIME_TYPES,
  isSupportedExtractionMimeType,
} from "./erfExtractionContract.ts";

export const ERF_NORMALIZED_IMAGE_MIME = "image/png";
export const ERF_TIFF_MAX_PAGES = 8;
export const ERF_TIFF_MAX_SOURCE_PIXELS = 60_000_000;
export const ERF_TIFF_MAX_BILEVEL_SOURCE_PIXELS = 160_000_000;
export const ERF_TIFF_MAX_EDGE_PX = 4_000;
export const ERF_TIFF_MAX_BILEVEL_EDGE_PX = 3_000;
export const ERF_TIFF_MAX_PAGE_BYTES = 8 * 1024 * 1024;
export const ERF_TIFF_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

/** Dense township plans need detail crops in addition to an overview. */
export const ERF_TIFF_DETAIL_TILE_MIN_SOURCE_PIXELS = 40_000_000;
export const ERF_TIFF_DETAIL_TILE_ROWS = 2;
export const ERF_TIFF_DETAIL_TILE_COLS = 2;
export const ERF_TIFF_MAX_DETAIL_TILE_EDGE_PX = 2_400;
export const ERF_TIFF_DETAIL_TILE_OVERLAP = 0.06;

export interface ExtractionDetailTile {
  index: number;
  row: number;
  col: number;
  rows: number;
  cols: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface NormalizedExtractionPage {
  pageNumber: number;
  mimeType: typeof ERF_NORMALIZED_IMAGE_MIME;
  base64: string;
  width: number;
  height: number;
  detail?: ExtractionDetailTile | null;
}

export type ExtractionContentBlock =
  | { type: "text"; text: string }
  | { type: "file"; file: { filename: string; file_data: string } }
  | { type: "image_url"; image_url: { url: string; detail?: "high" } };

export function isTiffExtractionMimeType(mimeType: string | null | undefined) {
  const value = (mimeType ?? "").toLowerCase().split(";")[0].trim();
  return (ERF_EXTRACTION_TIFF_MIME_TYPES as readonly string[]).includes(value);
}

export function canSendMimeTypeDirectly(mimeType: string | null | undefined) {
  return isSupportedExtractionMimeType(mimeType) && !isTiffExtractionMimeType(mimeType);
}

export function planTiffPageScale(width: number, height: number, maxEdgePx = ERF_TIFF_MAX_EDGE_PX) {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const limit = Math.max(1, Math.floor(maxEdgePx));
  const longest = Math.max(w, h);
  if (longest <= limit) return { width: w, height: h, scale: 1, downscaled: false };
  const scale = limit / longest;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    scale,
    downscaled: true,
  };
}

export function planDenseSheetTiles(
  width: number,
  height: number,
  options: {
    minSourcePixels?: number;
    rows?: number;
    cols?: number;
    overlap?: number;
  } = {},
): ExtractionDetailTile[] {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const minPixels = options.minSourcePixels ?? ERF_TIFF_DETAIL_TILE_MIN_SOURCE_PIXELS;
  if (w * h < minPixels) return [];

  const rows = Math.max(1, Math.floor(options.rows ?? ERF_TIFF_DETAIL_TILE_ROWS));
  const cols = Math.max(1, Math.floor(options.cols ?? ERF_TIFF_DETAIL_TILE_COLS));
  if (rows * cols < 2) return [];
  const overlap = Math.min(0.4, Math.max(0, options.overlap ?? ERF_TIFF_DETAIL_TILE_OVERLAP));
  const cellWidth = w / cols;
  const cellHeight = h / rows;
  const padX = Math.round(cellWidth * overlap);
  const padY = Math.round(cellHeight * overlap);

  const tiles: ExtractionDetailTile[] = [];
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      index += 1;
      const x0 = Math.max(0, Math.round(col * cellWidth) - (col > 0 ? padX : 0));
      const y0 = Math.max(0, Math.round(row * cellHeight) - (row > 0 ? padY : 0));
      const x1 = Math.min(w, Math.round((col + 1) * cellWidth) + (col < cols - 1 ? padX : 0));
      const y1 = Math.min(h, Math.round((row + 1) * cellHeight) + (row < rows - 1 ? padY : 0));
      tiles.push({ index, row: row + 1, col: col + 1, rows, cols, x0, y0, x1, y1 });
    }
  }
  return tiles;
}

export function describeDetailTile(tile: ExtractionDetailTile) {
  const vertical =
    tile.rows === 1 ? "" : tile.row === 1 ? "top" : tile.row === tile.rows ? "bottom" : "middle";
  const horizontal =
    tile.cols === 1 ? "" : tile.col === 1 ? "left" : tile.col === tile.cols ? "right" : "centre";
  return `${[vertical, horizontal].filter(Boolean).join(" ") || "whole sheet"} quadrant`;
}

export type TiffBudgetRejection =
  | { ok: true }
  | {
      ok: false;
      reason: "too_many_pages" | "page_too_large" | "converted_too_large";
      message: string;
    };

export function checkTiffPageBudget(pageCount: number): TiffBudgetRejection {
  if (pageCount > ERF_TIFF_MAX_PAGES) {
    return {
      ok: false,
      reason: "too_many_pages",
      message: `This diagram has ${pageCount} pages. Only the first ${ERF_TIFF_MAX_PAGES} can be read automatically.`,
    };
  }
  return { ok: true };
}

export function checkTiffPixelBudget(
  width: number,
  height: number,
  options: { bilevel?: boolean } = {},
): TiffBudgetRejection {
  const limit = options.bilevel
    ? ERF_TIFF_MAX_BILEVEL_SOURCE_PIXELS
    : ERF_TIFF_MAX_SOURCE_PIXELS;
  if (width * height > limit) {
    return {
      ok: false,
      reason: "page_too_large",
      message: "One page of this diagram is too large to read automatically.",
    };
  }
  return { ok: true };
}

export function checkConvertedByteBudget(pageBytes: number, totalBytes: number): TiffBudgetRejection {
  if (pageBytes > ERF_TIFF_MAX_PAGE_BYTES || totalBytes > ERF_TIFF_MAX_TOTAL_BYTES) {
    return {
      ok: false,
      reason: "converted_too_large",
      message: "This diagram is too large to read automatically once converted.",
    };
  }
  return { ok: true };
}

export function buildExtractionContent(input: {
  fileName: string;
  mimeType: string;
  dataUrl?: string | null;
  pages?: NormalizedExtractionPage[] | null;
  subjectErfNumber?: string | number | null;
}): ExtractionContentBlock[] {
  const mime = (input.mimeType || "").toLowerCase().split(";")[0].trim();
  const pages = input.pages ?? null;
  const subject =
    input.subjectErfNumber == null ? null : String(input.subjectErfNumber).trim() || null;

  if (isTiffExtractionMimeType(mime) && (!pages || pages.length === 0)) {
    throw new Error("TIFF input must be normalised to PNG before extraction.");
  }

  if (pages && pages.length > 0) {
    const ordered = pages
      .slice()
      .sort(
        (a, b) =>
          a.pageNumber - b.pageNumber || (a.detail?.index ?? 0) - (b.detail?.index ?? 0),
      );
    const overviewCount = ordered.filter((page) => !page.detail).length;
    const tileCount = ordered.length - overviewCount;
    const intro = [
      `Extract this Surveyor-General style property diagram: ${input.fileName}.`,
      `It has ${overviewCount} whole-page image(s), supplied in page order starting at page 1.`,
    ];
    if (tileCount > 0) {
      intro.push(
        `${tileCount} overlapping high-detail crop(s) of the same page(s) follow.`,
        "Use the crops to read small printed text. They are not separate pages or documents.",
      );
    }
    if (subject) {
      intro.push(
        `The parcel under investigation is Erf ${subject}. Look for the printed number ${subject}. Report it only when it is visibly present on the sheet. Never infer or invent a match from the request itself.`,
      );
    }

    const blocks: ExtractionContentBlock[] = [{ type: "text", text: intro.join(" ") }];
    for (const page of ordered) {
      blocks.push({
        type: "text",
        text: page.detail
          ? `Page ${page.pageNumber}, high-detail crop ${page.detail.index} of ${page.detail.rows * page.detail.cols} (${describeDetailTile(page.detail)}):`
          : `Page ${page.pageNumber}:`,
      });
      blocks.push({
        type: "image_url",
        image_url: {
          url: `data:${ERF_NORMALIZED_IMAGE_MIME};base64,${page.base64}`,
          detail: "high",
        },
      });
    }
    return blocks;
  }

  const dataUrl = input.dataUrl ?? "";
  if (mime === "application/pdf") {
    return [
      { type: "text", text: `Extract this property document: ${input.fileName}` },
      { type: "file", file: { filename: input.fileName, file_data: dataUrl } },
    ];
  }
  return [
    { type: "text", text: `Extract this property document image: ${input.fileName}` },
    { type: "image_url", image_url: { url: dataUrl } },
  ];
}

export function findUnsupportedContentMime(content: ExtractionContentBlock[]): string | null {
  for (const block of content) {
    const url =
      block.type === "image_url"
        ? block.image_url.url
        : block.type === "file"
          ? block.file.file_data
          : "";
    if (!url.startsWith("data:")) continue;
    const mime = url.slice(5, url.indexOf(";") === -1 ? undefined : url.indexOf(";")).toLowerCase();
    if (!canSendMimeTypeDirectly(mime)) return mime;
  }
  return null;
}
