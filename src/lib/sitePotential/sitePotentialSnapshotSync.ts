import { SITE_POTENTIAL_PACK_SIZE } from "@/lib/sitePotential/config";
import type { SitePotentialGenerationStatus, SitePotentialMode, SitePotentialProject } from "@/lib/sitePotential/types";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import type {
  SitePotentialProgressState,
  SitePotentialSnapshot,
} from "@/lib/workbench/erfWorkspaceState";

interface BuildSyncedSitePotentialSnapshotInput {
  projectId: string | null;
  photoCount: number;
  planCount: number;
  conceptCount: number;
  selectedDesignAssetId: string | null;
  mode: SitePotentialMode | null;
  generationStatus: SitePotentialGenerationStatus | null;
  imageRightsConfirmed: boolean;
  rightsConfirmedAt: string | null;
  activePackProjectState: SitePotentialProgressState | null;
}

type CanonicalSitePotentialAsset = Pick<ErfAsset, "asset_category" | "status">;

const SNAPSHOT_KEYS: Array<keyof SitePotentialSnapshot> = [
  "mode",
  "skipped",
  "photoCount",
  "planCount",
  "conceptCount",
  "preferredConceptId",
  "selectedDesignAssetId",
  "imageRightsConfirmed",
  "rightsConfirmedAt",
  "progressState",
  "projectId",
];

export function sitePotentialSnapshotsMatch(
  current: SitePotentialSnapshot,
  next: SitePotentialSnapshot,
) {
  return SNAPSHOT_KEYS.every((key) => current[key] === next[key]);
}

export function buildSyncedSitePotentialSnapshot(
  current: SitePotentialSnapshot,
  input: BuildSyncedSitePotentialSnapshotInput,
): SitePotentialSnapshot | null {
  const next: SitePotentialSnapshot = {
    projectId: input.projectId,
    photoCount: input.photoCount,
    planCount: input.planCount,
    conceptCount: input.conceptCount,
    selectedDesignAssetId: input.selectedDesignAssetId,
    preferredConceptId: input.selectedDesignAssetId,
    mode: input.mode ?? current.mode,
    skipped: input.generationStatus === "skipped" || input.mode === "skipped",
    imageRightsConfirmed: input.imageRightsConfirmed,
    rightsConfirmedAt: input.rightsConfirmedAt,
    progressState:
      input.activePackProjectState ??
      input.generationStatus ??
      (input.conceptCount >= SITE_POTENTIAL_PACK_SIZE ? "concepts_ready" : current.progressState),
  };

  return sitePotentialSnapshotsMatch(current, next) ? null : next;
}

export function buildCanonicalSitePotentialSnapshot(
  current: SitePotentialSnapshot,
  project: SitePotentialProject | null,
  assets: CanonicalSitePotentialAsset[],
): SitePotentialSnapshot | null {
  if (!project) return null;

  const activeAssets = assets.filter((asset) => asset.status !== "deleted");
  const photoCount = activeAssets.filter(
    (asset) =>
      asset.asset_category === "site_photo" || asset.asset_category === "existing_house_photo",
  ).length;
  const planCount = activeAssets.filter(
    (asset) =>
      asset.asset_category === "topography" ||
      asset.asset_category === "architectural_plan" ||
      asset.asset_category === "inspiration_image" ||
      asset.asset_category === "other",
  ).length;
  const conceptCount = activeAssets.filter(
    (asset) => asset.asset_category === "generated_design",
  ).length;

  return buildSyncedSitePotentialSnapshot(current, {
    projectId: project.id,
    photoCount,
    planCount,
    conceptCount,
    selectedDesignAssetId: project.selected_design_asset_id,
    mode: project.mode,
    generationStatus: project.generation_status,
    imageRightsConfirmed: Boolean(project.rights_confirmed_at),
    rightsConfirmedAt: project.rights_confirmed_at,
    activePackProjectState: null,
  });
}
