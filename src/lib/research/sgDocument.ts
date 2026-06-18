// Best-effort builder for a CSG (Chief Surveyor-General) document-list URL.
//
// Honesty rule: we do not currently have a tested, parcel-scoped CSG
// document-list URL. The legacy csggis.drdlr.gov.za/psv/ endpoint does not
// resolve reliably for end users, and we have no validated builder for a
// per-erf document list. Until that integration is real, we always return
// shown=false and let the caller surface the working CSG Property Viewer
// (Experience Builder) as a fallback.

import { CSG_VIEWER_URL } from "@/lib/external-urls";

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
  /** The constructed URL when shown=true; otherwise empty. */
  url: string;
  /** Always-available fallback link to the CSG Property Viewer. */
  fallbackUrl: string;
  /** Why we did or did not build the document URL — surfaced in admin debug. */
  reason: string;
  /** Echo of the fields we used to evaluate — surfaced in admin debug. */
  fieldsUsed: Record<string, string | number | null | undefined>;
}

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

  // No validated per-erf SG document URL is available yet — always hide the
  // button and let the UI show the CSG Property Viewer fallback instead.
  return {
    shown: false,
    url: "",
    fallbackUrl: CSG_VIEWER_URL,
    reason: "No validated parcel-scoped CSG document-list URL is available yet.",
    fieldsUsed,
  };
}
