/**
 * Evidence & Documents appendix model.
 *
 * Every report-facing source is listed with an honest read state. Nothing here
 * upgrades a status: states come from the extraction metadata written by the
 * identity gate, or from the evidence pack for non-file sources.
 */
import {
  erfAssetDocumentLineage,
  erfAssetExtractionError,
  erfAssetExtractionLabel,
  erfAssetExtractionStatus,
  erfAssetIdentityMatchStatus,
  isExtractableErfAsset,
} from "@/lib/evidence/extractionMetadata";
import { redactPersonalIdentifiers } from "@/lib/reports/reportFindings";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import type { PropertyEvidencePack } from "@/lib/evidence/propertyEvidenceTypes";

export type AppendixReadState =
  | "searchable_matched"
  | "parent_plan_context"
  | "pending"
  | "unreadable"
  | "wrong_property"
  | "failed"
  | "reference_only";

export const APPENDIX_READ_STATE_LABEL: Record<AppendixReadState, string> = {
  searchable_matched: "Searchable — identity matched",
  parent_plan_context: "Parent General Plan matched — context only",
  pending: "Pending — not read yet",
  unreadable: "Unreadable — needs OCR or a clearer copy",
  wrong_property: "Wrong property — quarantined",
  failed: "Failed — retry or check needed",
  reference_only: "Reference only — not extractable",
};

export type AppendixScope =
  | "parcel_specific"
  | "parent_plan_context"
  | "user_supplied"
  | "official"
  | "paid_provider"
  | "market";

export const APPENDIX_SCOPE_LABEL: Record<AppendixScope, string> = {
  parcel_specific: "Parcel-specific",
  parent_plan_context: "Parent-plan context",
  user_supplied: "User supplied",
  official: "Official source",
  paid_provider: "Paid provider",
  market: "Market listing",
};

export interface EvidenceAppendixRow {
  id: string;
  name: string;
  category: string;
  providerType: string;
  readState: AppendixReadState;
  readLabel: string;
  scope: AppendixScope;
  pageLocator: string | null;
  detail: string | null;
  assetId: string | null;
  url: string | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  paid_report: "Paid report",
  sg_diagram: "Surveyor-General diagram",
  title_deed: "Title deed",
  official_document: "Official document",
  zoning_document: "Zoning document",
  topography: "Topography",
  site_photo: "Site photograph",
  architectural_plan: "Architectural plan",
  design_concept: "Design concept",
  report_export: "Report export",
};

function categoryLabel(category: string) {
  return CATEGORY_LABEL[category] ?? category.replace(/_/g, " ");
}

function providerTypeFor(category: string): string {
  if (category === "paid_report") return "Paid data provider";
  if (category === "sg_diagram") return "Surveyor-General";
  if (category === "title_deed") return "Deeds registry document";
  if (category === "zoning_document" || category === "official_document")
    return "Official / municipal";
  return "User supplied";
}

function readStateForAsset(asset: ErfAsset): AppendixReadState {
  if (!isExtractableErfAsset(asset)) return "reference_only";
  const identity = erfAssetIdentityMatchStatus(asset);
  if (identity === "mismatch") return "wrong_property";
  if (identity === "parent_lineage_match") return "parent_plan_context";
  const status = erfAssetExtractionStatus(asset);
  if (status === "ready" && identity === "matched") return "searchable_matched";
  if (status === "failed") return "failed";
  if (status === "unsupported" || status === "partial") return "unreadable";
  return "pending";
}

function scopeForAsset(asset: ErfAsset, readState: AppendixReadState): AppendixScope {
  if (readState === "parent_plan_context") return "parent_plan_context";
  if (asset.asset_category === "paid_report") return "paid_provider";
  if (
    asset.asset_category === "sg_diagram" ||
    asset.asset_category === "title_deed" ||
    asset.asset_category === "official_document" ||
    asset.asset_category === "zoning_document"
  ) {
    return readState === "searchable_matched" ? "parcel_specific" : "official";
  }
  return "user_supplied";
}

function pageLocatorFor(pack: PropertyEvidencePack | null, assetId: string): string | null {
  if (!pack) return null;
  const pages = new Set<number>();
  let pageCount: number | null = null;
  for (const source of pack.sources) {
    if (source.assetId !== assetId) continue;
    if (source.asset?.pageCount) pageCount = source.asset.pageCount;
    for (const locator of source.locators) {
      if (typeof locator.pageNumber === "number") pages.add(locator.pageNumber);
    }
  }
  for (const claim of pack?.claims ?? []) {
    for (const locator of claim.locators) {
      if (locator.assetId === assetId && typeof locator.pageNumber === "number") {
        pages.add(locator.pageNumber);
      }
    }
  }
  const sorted = [...pages].sort((a, b) => a - b);
  if (sorted.length) {
    const shown = sorted.slice(0, 6).join(", ");
    return `Page${sorted.length === 1 ? "" : "s"} ${shown}${pageCount ? ` of ${pageCount}` : ""}`;
  }
  return pageCount ? `${pageCount} page${pageCount === 1 ? "" : "s"}` : null;
}

function detailForAsset(asset: ErfAsset, readState: AppendixReadState): string | null {
  const lineage = erfAssetDocumentLineage(asset);
  if (readState === "parent_plan_context" && lineage) {
    const parts = [
      lineage.generalPlanReference ? `General Plan ${lineage.generalPlanReference}` : null,
      lineage.parentErfNumber ? `parent Erf ${lineage.parentErfNumber}` : null,
    ].filter(Boolean);
    if (parts.length) return `${parts.join(" · ")} — context only, never a fact about this erf.`;
  }
  if (readState === "failed") return erfAssetExtractionError(asset);
  if (readState === "wrong_property") {
    return "This document describes a different property and is excluded from the report.";
  }
  return null;
}

export function buildEvidenceAppendixRows(input: {
  assets: ErfAsset[];
  pack: PropertyEvidencePack | null;
}): EvidenceAppendixRow[] {
  const { assets, pack } = input;

  const fileRows: EvidenceAppendixRow[] = assets.map((asset) => {
    const readState = readStateForAsset(asset);
    return {
      id: `asset-${asset.id}`,
      name: redactPersonalIdentifiers(asset.original_file_name ?? "Unnamed file"),
      category: categoryLabel(asset.asset_category),
      providerType: providerTypeFor(asset.asset_category),
      readState,
      readLabel:
        readState === "reference_only"
          ? APPENDIX_READ_STATE_LABEL.reference_only
          : erfAssetExtractionLabel(
              asset,
              asset.asset_category === "sg_diagram" ? "diagram" : "report",
            ),
      scope: scopeForAsset(asset, readState),
      pageLocator: pageLocatorFor(pack, asset.id),
      detail: detailForAsset(asset, readState),
      assetId: asset.id,
      url: null,
    };
  });

  const linkRows: EvidenceAppendixRow[] = (pack?.sources ?? [])
    .filter(
      (source) =>
        !source.assetId &&
        (source.kind === "market_listing" ||
          source.kind === "official_portal" ||
          source.kind === "municipal_portal"),
    )
    .map((source) => ({
      id: `source-${source.id}`,
      name: redactPersonalIdentifiers(source.label),
      category: source.kind === "market_listing" ? "Market listing" : "Official portal",
      providerType:
        source.authorityType === "official"
          ? "Official"
          : source.authorityType === "municipal"
            ? "Municipal"
            : source.authorityType === "paid_provider"
              ? "Paid provider"
              : "Market",
      readState: source.status === "reviewed" ? "searchable_matched" : "reference_only",
      readLabel:
        source.status === "reviewed"
          ? "Reviewed by you"
          : source.kind === "market_listing"
            ? "Saved listing reference"
            : "Source link — open and review",
      scope: source.kind === "market_listing" ? "market" : "official",
      pageLocator: null,
      detail: null,
      assetId: null,
      url: source.url ?? null,
    }));

  return [...fileRows, ...linkRows];
}
