import { SITE_POTENTIAL_PACK_SIZE } from "@/lib/sitePotential/config";
import type { SitePotentialGenerationStatus, SitePotentialMode } from "@/lib/sitePotential/types";
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
