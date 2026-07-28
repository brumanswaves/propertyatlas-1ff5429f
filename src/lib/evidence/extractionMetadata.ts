/**
 * Runtime-neutral readers for the extraction metadata stored on `erf_assets`.
 *
 * Lives in the evidence layer (not the workbench UI layer) so
 * `buildPropertyEvidencePack` never has to import a UI module.
 */
import {
  isSupportedExtractionMimeType,
  type ErfExtractedClaim,
  type ErfExtractedIdentity,
  type ErfExtractionStatus,
  type ErfIdentityMatchStatus,
} from "../../../supabase/functions/_shared/erfExtractionContract";

type MetadataBearer = { metadata?: Record<string, unknown> | null };

/** Categories whose contents are worth reading into evidence. */
export const EXTRACTABLE_CATEGORIES = new Set([
  "official_document",
  "sg_diagram",
  "paid_report",
  "title_deed",
  "zoning_document",
  "topography",
]);

const KNOWN_STATUSES: ErfExtractionStatus[] = [
  "not_started",
  "queued",
  "processing",
  "ready",
  "partial",
  "unsupported",
  "failed",
];

function meta(asset: MetadataBearer): Record<string, unknown> {
  return (asset.metadata ?? {}) as Record<string, unknown>;
}

/** True when this asset is a document Easy Erf should try to read. */
export function isExtractableErfAsset(asset: { asset_category: string; mime_type: string }) {
  return EXTRACTABLE_CATEGORIES.has(asset.asset_category) && isSupportedExtractionMimeType(asset.mime_type);
}

export function erfAssetExtractionStatus(asset: MetadataBearer): ErfExtractionStatus {
  const value = meta(asset).extractionStatus ?? meta(asset).extraction_status;
  return typeof value === "string" && (KNOWN_STATUSES as string[]).includes(value)
    ? (value as ErfExtractionStatus)
    : "not_started";
}

export function erfAssetIdentityMatchStatus(asset: MetadataBearer): ErfIdentityMatchStatus | null {
  const value = meta(asset).identityMatchStatus ?? meta(asset).identity_match_status;
  return value === "matched" || value === "mismatch" || value === "unverified" || value === "parent_lineage_match"
    ? value
    : null;
}

/** True when the asset is a parent General Plan accepted as contextual evidence. */
export function erfAssetIsParentLineageMatch(asset: MetadataBearer) {
  return erfAssetIdentityMatchStatus(asset) === "parent_lineage_match";
}

/** Parent erf / general-plan provenance recorded by the identity gate. */
export function erfAssetDocumentLineage(asset: MetadataBearer): {
  parentErfNumber: string | null;
  generalPlanReference: string | null;
  lineage: string | null;
} | null {
  const value = meta(asset).documentLineage ?? meta(asset).document_lineage;
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const text = (key: string) => (typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : null);
  return {
    parentErfNumber: text("parentErfNumber"),
    generalPlanReference: text("generalPlanReference"),
    lineage: text("lineage"),
  };
}

export function erfAssetIdentityMatchReason(asset: MetadataBearer): string | null {
  const value = meta(asset).identityMatchReason ?? meta(asset).identity_match_reason;
  return typeof value === "string" && value.trim() ? value : null;
}

export function erfAssetExtractedIdentity(asset: MetadataBearer): ErfExtractedIdentity | null {
  const value = meta(asset).extractedIdentity ?? meta(asset).extracted_identity;
  return value && typeof value === "object" ? (value as ErfExtractedIdentity) : null;
}

export function erfAssetExtractedClaims(asset: MetadataBearer): ErfExtractedClaim[] {
  const raw = meta(asset).extractedClaims ?? meta(asset).extracted_claims;
  return Array.isArray(raw) ? (raw as ErfExtractedClaim[]) : [];
}

export function erfAssetExtractedText(asset: MetadataBearer): string {
  const raw = meta(asset).extractedText ?? meta(asset).extracted_text;
  return typeof raw === "string" ? raw : "";
}

export function erfAssetExtractionError(asset: MetadataBearer): string | null {
  const value = meta(asset).extractionError ?? meta(asset).extraction_error;
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * The single gate every evidence consumer must use: only an identity-matched,
 * ready extraction may contribute searchable claims or text.
 */
export function erfAssetHasSearchableExtraction(asset: MetadataBearer) {
  return erfAssetExtractionStatus(asset) === "ready" && erfAssetIdentityMatchStatus(asset) === "matched";
}

/**
 * Human label for the extraction state, used across Sources and Reports.
 * `variant` only changes the noun, so Sources can say "diagram" where the
 * Reports tab says "report" without a second status vocabulary.
 */
export function erfAssetExtractionLabel(asset: MetadataBearer, variant: "report" | "diagram" = "report") {
  const noun = variant === "diagram" ? "diagram" : "report";
  const Noun = variant === "diagram" ? "Diagram" : "Report";
  const identity = erfAssetIdentityMatchStatus(asset);
  if (identity === "mismatch") return `Wrong property ${noun}`;
  if (identity === "unverified") return `${Noun} could not be matched to this erf`;
  const status = erfAssetExtractionStatus(asset);
  switch (status) {
    case "ready":
      return `${Noun} searchable`;
    case "partial":
      return variant === "diagram" ? "No readable diagram text" : "Read — no structured values found";
    case "processing":
      return `Extracting ${noun}...`;
    case "queued":
      return "Queued for reading";
    case "unsupported":
      return "Cannot be read automatically";
    case "failed":
      return erfAssetExtractionError(asset) ?? "Extraction failed";
    default:
      return "Not read yet";
  }
}
