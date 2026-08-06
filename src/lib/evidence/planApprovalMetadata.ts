import type { ErfAsset } from "@/lib/workbench/erfFileVault";

export type PlanApprovalStatus =
  | "not_plan"
  | "unknown"
  | "user_identified"
  | "verified_municipal_approval";

function metadataStatus(asset: ErfAsset): string | null {
  const value = asset.metadata["planApprovalStatus"] ?? asset.metadata["plan_approval_status"];
  return typeof value === "string" && value.trim() ? value : null;
}

export function erfAssetPlanApprovalStatus(asset: ErfAsset): PlanApprovalStatus {
  if (asset.asset_category !== "architectural_plan") return "not_plan";
  const status = metadataStatus(asset);
  if (status === "verified_municipal_approval") return "verified_municipal_approval";
  if (status === "user_identified") return "user_identified";
  return "unknown";
}

export function isVerifiedMunicipalApprovedPlan(asset: ErfAsset) {
  return erfAssetPlanApprovalStatus(asset) === "verified_municipal_approval";
}

export function isUserIdentifiedPlan(asset: ErfAsset) {
  return erfAssetPlanApprovalStatus(asset) === "user_identified";
}

export function planApprovalStatusLabel(asset: ErfAsset) {
  switch (erfAssetPlanApprovalStatus(asset)) {
    case "verified_municipal_approval":
      return "Municipal approval verified";
    case "user_identified":
      return "User identified plan, approval not verified";
    case "unknown":
      return "Plan file stored, approval not verified";
    default:
      return "Property evidence";
  }
}
