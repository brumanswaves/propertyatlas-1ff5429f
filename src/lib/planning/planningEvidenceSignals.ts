import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import { isVerifiedMunicipalApprovedPlan } from "@/lib/evidence/planApprovalMetadata";
import type { ParcelPlanningEvidenceSignals } from "./parcelPlanningAssessment";

/**
 * Derives Zoning & Build evidence signals from real Erf File Vault assets.
 *
 * Rules that keep this honest:
 *  - "searchable" means the asset was actually extracted (`status === "ready"`),
 *    never merely uploaded as a reference.
 *  - Nothing is inferred from the absence of a file: every signal defaults false.
 *  - Servitude / overlay / departure confirmation is never derived from a file;
 *    those stay false until a person records the confirmation.
 */

const EMPTY: ParcelPlanningEvidenceSignals = {
  zoningCertificateUploaded: false,
  approvedBuildingPlansUploaded: false,
  titleDeedSearchable: false,
  sgDiagramSearchable: false,
  servitudesConfirmed: false,
  departureOrRezoningHistoryConfirmed: false,
  hoaOrDesignApprovalOnFile: false,
  occupancyCertificateUploaded: false,
  environmentalOverlayChecked: false,
};

function haystack(asset: ErfAsset) {
  return [asset.asset_type, asset.source_label ?? "", asset.original_file_name]
    .join(" ")
    .toLowerCase();
}

function isSearchable(asset: ErfAsset) {
  return asset.status === "ready";
}

function isLive(asset: ErfAsset) {
  return asset.status !== "deleted" && asset.status !== "archived" && asset.status !== "failed";
}

export function derivePlanningEvidenceSignals(
  assets: ErfAsset[],
  overrides: Partial<ParcelPlanningEvidenceSignals> = {},
): ParcelPlanningEvidenceSignals {
  const signals: ParcelPlanningEvidenceSignals = { ...EMPTY };

  for (const asset of assets) {
    if (!isLive(asset)) continue;
    const text = haystack(asset);

    if (asset.asset_category === "zoning_document" || text.includes("zoning certificate")) {
      signals.zoningCertificateUploaded = true;
    }
    if (isVerifiedMunicipalApprovedPlan(asset)) {
      signals.approvedBuildingPlansUploaded = true;
    }
    if (asset.asset_category === "title_deed" && isSearchable(asset)) {
      signals.titleDeedSearchable = true;
    }
    if (asset.asset_category === "sg_diagram" && isSearchable(asset)) {
      signals.sgDiagramSearchable = true;
    }
    if (text.includes("occupancy certificate")) {
      signals.occupancyCertificateUploaded = true;
    }
    if (
      text.includes("design guideline") ||
      text.includes("architectural guideline") ||
      text.includes("hoa approval")
    ) {
      signals.hoaOrDesignApprovalOnFile = true;
    }
  }

  return { ...signals, ...overrides };
}
