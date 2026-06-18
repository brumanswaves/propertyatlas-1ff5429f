// Best-effort builder for a CSG (Chief Surveyor-General) document-list URL.
// Returns shown=false with a reason when we don't have enough trustworthy fields
// to construct a URL that will land on a real parcel page. Never returns a guess.

export interface SgDocumentInput {
  lpi?: string | null;
  parcelKey?: string | null;
  erfNumber?: string | number | null;
  portion?: string | number | null;
  province?: string | null;
  majorRegion?: string | null;
  minorRegion?: string | null;
}

export interface SgDocumentResult {
  /** True when we built a URL we're willing to expose as a "document list" link. */
  shown: boolean;
  /** The constructed URL when shown=true; otherwise the best fallback (CSG viewer). */
  url: string;
  /** Always-available fallback link to the CSG Property Viewer (parcel-aware when possible). */
  fallbackUrl: string;
  /** Why we did or did not build the document URL — surfaced in admin debug. */
  reason: string;
  /** Echo of the fields we used to build the URL — surfaced in admin debug. */
  fieldsUsed: Record<string, string | number | null | undefined>;
}

// A valid CSG LPI is a 21-character code: 1 letter (province) + 20 digits.
// e.g. "C01900000000007480000" — province "C0…" + registration division + erf + portion.
const LPI_RE = /^[A-Z][0-9]{20}$/;

const CSG_VIEWER = "https://csggis.drdlr.gov.za/psv/";

function buildViewerUrl(lpi?: string | null): string {
  if (lpi && LPI_RE.test(lpi)) return `${CSG_VIEWER}?lpi=${encodeURIComponent(lpi)}`;
  return CSG_VIEWER;
}

/**
 * Build a CSG document-list URL only when we have enough trustworthy data.
 * Hard requirements: a well-formed 21-char LPI AND a non-empty erf number AND a province.
 * Otherwise hide the document button and let the caller offer the CSG viewer instead.
 */
export function buildSgDocumentUrl(input: SgDocumentInput): SgDocumentResult {
  const fieldsUsed = {
    lpi: input.lpi ?? null,
    parcelKey: input.parcelKey ?? null,
    erfNumber: input.erfNumber ?? null,
    portion: input.portion ?? null,
    province: input.province ?? null,
    majorRegion: input.majorRegion ?? null,
    minorRegion: input.minorRegion ?? null,
  };

  const lpi = (input.lpi ?? "").trim();
  if (!lpi) {
    return { shown: false, url: "", fallbackUrl: buildViewerUrl(input.lpi), reason: "Missing CSG LPI.", fieldsUsed };
  }
  if (!LPI_RE.test(lpi)) {
    return { shown: false, url: "", fallbackUrl: buildViewerUrl(null), reason: `LPI "${lpi}" is not the expected 21-character format.`, fieldsUsed };
  }
  if (input.erfNumber == null || String(input.erfNumber).trim() === "") {
    return { shown: false, url: "", fallbackUrl: buildViewerUrl(lpi), reason: "Missing erf number — cannot confidently scope to one parcel.", fieldsUsed };
  }
  if (!input.province || !String(input.province).trim()) {
    return { shown: false, url: "", fallbackUrl: buildViewerUrl(lpi), reason: "Missing province — required to scope CSG document search.", fieldsUsed };
  }

  // The CSG Property Viewer lists approved SG documents for a parcel when looked up by LPI.
  // We surface it as the document-list URL because it is the official, parcel-scoped CSG page.
  const url = `${CSG_VIEWER}?lpi=${encodeURIComponent(lpi)}&view=documents`;
  return {
    shown: true,
    url,
    fallbackUrl: buildViewerUrl(lpi),
    reason: "LPI, erf number, and province all present and well-formed.",
    fieldsUsed,
  };
}
