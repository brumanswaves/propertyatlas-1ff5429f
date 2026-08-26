import type { SitePotentialProject } from "@/lib/sitePotential/types";
import { buildSyncedSitePotentialSnapshot } from "@/lib/sitePotential/sitePotentialSnapshotSync";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import type { SitePotentialSnapshot } from "@/lib/workbench/erfWorkspaceState";

export function buildGuidedSitePotentialSyncSnapshot(
  current: SitePotentialSnapshot,
  project: SitePotentialProject | null,
  assets: ErfAsset[],
): SitePotentialSnapshot | null {
  const photoCount = assets.filter(
    (asset) =>
      asset.asset_category === "site_photo" || asset.asset_category === "existing_house_photo",
  ).length;
  const planCount = assets.filter(
    (asset) =>
      asset.asset_category === "topography" ||
      asset.asset_category === "architectural_plan" ||
      asset.asset_category === "inspiration_image" ||
      asset.asset_category === "other",
  ).length;
  const conceptCount = assets.filter(
    (asset) => asset.asset_category === "generated_design",
  ).length;

  return buildSyncedSitePotentialSnapshot(current, {
    projectId: project?.id ?? null,
    photoCount,
    planCount,
    conceptCount,
    selectedDesignAssetId: project?.selected_design_asset_id ?? null,
    mode: project?.mode ?? null,
    generationStatus: project?.generation_status ?? null,
    imageRightsConfirmed: Boolean(project?.rights_confirmed_at),
    rightsConfirmedAt: project?.rights_confirmed_at ?? null,
    activePackProjectState: null,
  });
}
