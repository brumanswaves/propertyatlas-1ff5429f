// Best-effort builder for a CSG (Chief Surveyor-General) document-list URL.
//
// Pattern (validated by the user):
//   https://csg.dlrrd.gov.za/esio/listdocument.jsp
//     ?office=SGCTN&Noffice=8
//     &regDivision={regDivision}      // 8-char registration division code (e.g. C0340014)
//     &Erf={paddedErf}                // 8 digits, left-padded with 0
//     &Portion={paddedPortion}        // 5 digits, left-padded with 0
//     &FarmName=
//
// We only return shown=true when we have a registration-division code that
// looks valid AND an erf number. Otherwise the UI falls back to the always-
// available CSG Property Viewer link.

import { CSG_VIEWER_URL, SG_DOCUMENT_BASE } from "@/lib/external-urls";

export interface SgDocumentInput {
  lpi?: string | null;
  parcelKey?: string | null;
  erfNumber?: string | number | null;
  portion?: string | number | null;
  province?: string | null;
  majorRegion?: string | null;
  minorRegion?: string | null;
  /** Optional registration division code if the caller already has it. */
  regDivision?: string | null;
}

export interface SgDocumentResult {
  shown: boolean;
  url: string;
  fallbackUrl: string;
  reason: string;
  fieldsUsed: Record<string, string | number | null | undefined>;
}

/** Extract an 8-char registration-division code (letter + 7 digits) from any input. */
function extractRegDivision(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const s = String(c).toUpperCase().replace(/\s+/g, "");
    const m = s.match(/[A-Z]\d{7}/);
    if (m) return m[0];
  }
  return null;
}

function padNumeric(value: string | number | null | undefined, width: number): string | null {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length > width) return null;
  return digits.padStart(width, "0");
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
    regDivision: input.regDivision ?? null,
  };

  const regDivision = extractRegDivision(
    input.regDivision,
    input.minorRegion,
    input.parcelKey,
    input.lpi,
  );
  const paddedErf = padNumeric(input.erfNumber, 8);
  const paddedPortion = padNumeric(input.portion ?? 0, 5);

  if (!regDivision || !paddedErf || !paddedPortion) {
    return {
      shown: false,
      url: "",
      fallbackUrl: CSG_VIEWER_URL,
      reason: `Insufficient fields for SG document URL (regDivision=${regDivision ?? "—"}, erf=${paddedErf ?? "—"}).`,
      fieldsUsed,
    };
  }

  const url =
    `${SG_DOCUMENT_BASE}?office=SGCTN&Noffice=8` +
    `&regDivision=${encodeURIComponent(regDivision)}` +
    `&Erf=${paddedErf}` +
    `&Portion=${paddedPortion}` +
    `&FarmName=`;

  return {
    shown: true,
    url,
    fallbackUrl: CSG_VIEWER_URL,
    reason: "Built from registration division + padded erf/portion.",
    fieldsUsed,
  };
}
