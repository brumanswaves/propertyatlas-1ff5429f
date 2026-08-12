/**
 * Surveyor-General diagrams & lineage section model.
 *
 * Reads only what has already been extracted and identity-gated. Parent-plan
 * context is always labelled as context and never becomes a fact about the
 * subject erf. No diagram preview is implied here — TIFF assets are opened
 * through the existing signed-asset path only.
 */
import type { EvidenceAppendixRow } from "@/lib/reports/evidenceAppendix";
import type {
  EvidenceClaim,
  EvidenceDomain,
  PropertyEvidencePack,
} from "@/lib/evidence/propertyEvidenceTypes";
import {
  erfAssetExtractedClaims,
  erfAssetHasSearchableExtraction,
  erfAssetIdentityMatchStatus,
  erfAssetIdentityUserConfirmed,
} from "@/lib/evidence/extractionMetadata";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

export interface SgFileRow {
  id: string;
  name: string;
  readLabel: string;
  isParentContext: boolean;
  locator: string | null;
  assetId: string | null;
}

export interface SgLineageRow {
  label: string;
  value: string;
  provenance: string;
  scope: "subject" | "parent_context";
}

export interface SgEvidenceBlock {
  asset: ErfAsset;
  readLabel: string;
  isParentContext: boolean;
  isUserConfirmed: boolean;
  summary: string | null;
  findings: Array<{
    label: string;
    value: string;
    scope: "subject" | "parent_plan";
    confidence: "high" | "medium" | "low";
  }>;
}

export interface SgSectionModel {
  files: SgFileRow[];
  evidence: SgEvidenceBlock[];
  lineage: SgLineageRow[];
  hasParentContext: boolean;
  contextNote: string | null;
  emptyMessage: string | null;
}

const LINEAGE_SPECS: Array<{
  label: string;
  domains: EvidenceDomain[];
  keys: string[];
  parentContext?: boolean;
}> = [
  {
    label: "SG diagram / reference",
    domains: ["identity", "documents"],
    keys: ["sgDiagramNumber", "diagramNumber", "sgReference"],
  },
  {
    label: "General plan",
    domains: ["identity", "documents"],
    keys: ["generalPlanNumber", "generalPlan"],
    parentContext: true,
  },
  {
    label: "Parent erf",
    domains: ["identity"],
    keys: ["parentErfNumber", "parentErf"],
    parentContext: true,
  },
  {
    label: "Registered extent",
    domains: ["identity", "deeds"],
    keys: ["registeredExtent", "extent"],
  },
  {
    label: "Approval date",
    domains: ["documents", "identity"],
    keys: ["sgApprovalDate", "approvalDate"],
  },
  { label: "Surveyor", domains: ["documents", "identity"], keys: ["surveyor", "landSurveyor"] },
  {
    label: "Township / general plan area",
    domains: ["identity", "address"],
    keys: ["township", "generalPlanArea"],
    parentContext: true,
  },
];

function extractionSummary(asset: ErfAsset) {
  const value = asset.metadata.extractionSummary ?? asset.metadata.extraction_summary;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickClaim(
  pack: PropertyEvidencePack | null,
  domains: EvidenceDomain[],
  keys: string[],
): EvidenceClaim | null {
  if (!pack) return null;
  for (const domain of domains) {
    const claim = pack.claims.find(
      (candidate) =>
        candidate.domain === domain &&
        keys.includes(candidate.key) &&
        !candidate.excluded &&
        candidate.status !== "missing" &&
        candidate.status !== "excluded" &&
        candidate.value != null &&
        String(candidate.value).trim() !== "",
    );
    if (claim) return claim;
  }
  return null;
}

export function buildSgSectionModel(input: {
  appendixRows: EvidenceAppendixRow[];
  pack: PropertyEvidencePack | null;
  assets?: ErfAsset[];
}): SgSectionModel {
  const { appendixRows, pack, assets = [] } = input;

  const files: SgFileRow[] = appendixRows
    .filter(
      (row) =>
        row.category === "Surveyor-General diagram" &&
        (row.readState === "searchable_matched" || row.readState === "parent_plan_context"),
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      readLabel: row.readLabel,
      isParentContext: row.readState === "parent_plan_context",
      locator: row.pageLocator,
      assetId: row.assetId,
    }));

  const lineage: SgLineageRow[] = [];
  for (const spec of LINEAGE_SPECS) {
    const claim = pickClaim(pack, spec.domains, spec.keys);
    if (!claim) continue;
    const page = claim.locators.find((locator) => typeof locator.pageNumber === "number");
    lineage.push({
      label: spec.label,
      value: String(claim.value),
      provenance: `${claim.sourceIds.join(", ") || "Evidence source"}${page ? ` · page ${page.pageNumber}` : ""}`,
      scope: spec.parentContext ? "parent_context" : "subject",
    });
  }

  const hasParentContext =
    files.some((file) => file.isParentContext) ||
    lineage.some((row) => row.scope === "parent_context");

  return {
    files,
    evidence: assets
      .filter((asset) => asset.asset_category === "sg_diagram" && erfAssetHasSearchableExtraction(asset))
      .map((asset) => {
        const row = appendixRows.find((candidate) => candidate.assetId === asset.id);
        const identity = erfAssetIdentityMatchStatus(asset);
        return {
          asset,
          readLabel: row?.readLabel ?? "Readable cadastral evidence attached",
          isParentContext: identity === "parent_lineage_match",
          isUserConfirmed: identity === "unverified" && erfAssetIdentityUserConfirmed(asset),
          summary: extractionSummary(asset),
          findings: erfAssetExtractedClaims(asset).map((claim) => ({
            label: claim.label,
            value: claim.value,
            scope: claim.scope,
            confidence: claim.confidence,
          })),
        };
      }),
    lineage,
    hasParentContext,
    contextNote: hasParentContext
      ? "These diagrams were matched to the parent general plan for this erf. They are shown as parent-plan context: they describe the layout this erf came from, and they do not confirm boundaries, extent or servitudes for the subject erf on their own."
      : null,
    emptyMessage:
      files.length === 0 && lineage.length === 0 && assets.every((asset) => !erfAssetHasSearchableExtraction(asset))
        ? "No Surveyor-General diagram has been read for this erf yet. Upload the SG diagram in the Erf File to add cadastral evidence."
        : null,
  };
}
