/**
 * Runtime-neutral media rules for Erf document extraction.
 *
 * Imported by BOTH the Supabase Edge Function (Deno) and Vitest, so it must
 * stay free of URL imports, browser globals and Node-only APIs. The actual
 * TIFF decode lives in `tiffDecode.ts`, which is Deno-only; everything that
 * decides *what may be sent to the model* lives here so it is testable.
 *
 * Why this file exists at all: Surveyor-General diagrams are distributed as
 * TIFF, and no vision model accepts TIFF. TIFF is therefore accepted only as
 * a normalizable input — it must be rasterised to PNG first, and the rule
 * that raw TIFF never reaches the model is enforced here, not by convention.
 */
import {
  ERF_EXTRACTION_TIFF_MIME_TYPES,
  isSupportedExtractionMimeType,
} from "./erfExtractionContract.ts";

/** The only image MIME the normaliser ever emits. */
export const ERF_NORMALIZED_IMAGE_MIME = "image/png";

/** Safety budgets for TIFF rasterisation. Conservative on purpose. */
export const ERF_TIFF_MAX_PAGES = 8;
/** Per-page source pixels. A 100 MP scan is a decode bomb, not a diagram. */
export const ERF_TIFF_MAX_SOURCE_PIXELS = 60_000_000;
/**
 * Longest edge kept after downscaling. Cadastral labels are small, so this is
 * deliberately generous: only genuinely oversized scans are reduced.
 */
export const ERF_TIFF_MAX_EDGE_PX = 4_000;
/** Per converted page, and across all converted pages of one document. */
export const ERF_TIFF_MAX_PAGE_BYTES = 8 * 1024 * 1024;
export const ERF_TIFF_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export interface NormalizedExtractionPage {
  /** 1-based, in original document order. */
  pageNumber: number;
  mimeType: typeof ERF_NORMALIZED_IMAGE_MIME;
  /** Base64 PNG bytes. Never persisted anywhere. */
  base64: string;
  width: number;
  height: number;
}

export type ExtractionContentBlock =
  | { type: "text"; text: string }
  | { type: "file"; file: { filename: string; file_data: string } }
  | { type: "image_url"; image_url: { url: string } };

export function isTiffExtractionMimeType(mimeType: string | null | undefined) {
  const value = (mimeType ?? "").toLowerCase().split(";")[0].trim();
  return (ERF_EXTRACTION_TIFF_MIME_TYPES as readonly string[]).includes(value);
}

/** True when the stored bytes may be sent to the model unchanged. */
export function canSendMimeTypeDirectly(mimeType: string | null | undefined) {
  return isSupportedExtractionMimeType(mimeType) && !isTiffExtractionMimeType(mimeType);
}

/**
 * Downscale plan for one source page. Returns the original dimensions when no
 * reduction is needed — legibility of fine cadastral text matters more than
 * bandwidth, so we only shrink what exceeds the edge budget.
 */
export function planTiffPageScale(width: number, height: number) {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const longest = Math.max(w, h);
  if (longest <= ERF_TIFF_MAX_EDGE_PX) return { width: w, height: h, scale: 1, downscaled: false };
  const scale = ERF_TIFF_MAX_EDGE_PX / longest;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    scale,
    downscaled: true,
  };
}

export type TiffBudgetRejection =
  | { ok: true }
  | { ok: false; reason: "too_many_pages" | "page_too_large" | "converted_too_large"; message: string };

/** Page-count budget, checked before any pixel work. */
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

/** Source-pixel budget for a single page. */
export function checkTiffPixelBudget(width: number, height: number): TiffBudgetRejection {
  if (width * height > ERF_TIFF_MAX_SOURCE_PIXELS) {
    return {
      ok: false,
      reason: "page_too_large",
      message: "One page of this diagram is too large to read automatically.",
    };
  }
  return { ok: true };
}

/** Converted-byte budget, per page and cumulative. */
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

/**
 * Builds the model message content for one asset.
 *
 * `pages` is supplied only for normalised (previously TIFF) input; when it is
 * present the original bytes are ignored entirely, which is what guarantees
 * raw TIFF can never reach the model.
 */
export function buildExtractionContent(input: {
  fileName: string;
  mimeType: string;
  /** `data:<mime>;base64,...` of the ORIGINAL bytes. Ignored for TIFF. */
  dataUrl?: string | null;
  pages?: NormalizedExtractionPage[] | null;
}): ExtractionContentBlock[] {
  const mime = (input.mimeType || "").toLowerCase().split(";")[0].trim();
  const pages = input.pages ?? null;

  if (isTiffExtractionMimeType(mime)) {
    if (!pages || pages.length === 0) {
      throw new Error("TIFF input must be normalised to PNG before extraction.");
    }
  }

  if (pages && pages.length > 0) {
    const ordered = pages.slice().sort((a, b) => a.pageNumber - b.pageNumber);
    const blocks: ExtractionContentBlock[] = [
      {
        type: "text",
        text:
          `Extract this Surveyor-General style property diagram: ${input.fileName}. ` +
          `It has ${ordered.length} page image(s), supplied in page order starting at page 1.`,
      },
    ];
    for (const page of ordered) {
      blocks.push({ type: "text", text: `Page ${page.pageNumber}:` });
      blocks.push({
        type: "image_url",
        image_url: { url: `data:${ERF_NORMALIZED_IMAGE_MIME};base64,${page.base64}` },
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

/**
 * Last line of defence before the network call: no content block may carry a
 * TIFF data URL. Returns the offending mime type, or null when clean.
 */
export function findUnsupportedContentMime(content: ExtractionContentBlock[]): string | null {
  for (const block of content) {
    const url =
      block.type === "image_url" ? block.image_url.url : block.type === "file" ? block.file.file_data : "";
    if (!url.startsWith("data:")) continue;
    const mime = url.slice(5, url.indexOf(";") === -1 ? undefined : url.indexOf(";")).toLowerCase();
    if (!canSendMimeTypeDirectly(mime)) return mime;
  }
  return null;
}
