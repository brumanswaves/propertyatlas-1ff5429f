import { useEffect } from "react";
import { useSitePotentialProject } from "@/lib/sitePotential/sitePotentialService";
import { buildGuidedSitePotentialSyncSnapshot } from "@/lib/sitePotential/guidedSitePotentialSync";
import { useErfFileVault } from "@/lib/workbench/useErfFileVault";
import {
  readErfWorkspaceState,
  updateErfWorkspaceState,
} from "@/lib/workbench/erfWorkspaceState";
import type { ErfAssetCategory } from "@/lib/workbench/erfFileVault";

const GUIDED_SITE_POTENTIAL_CATEGORIES: ErfAssetCategory[] = [
  "site_photo",
  "existing_house_photo",
  "topography",
  "architectural_plan",
  "inspiration_image",
  "other",
  "generated_design",
];

export function GuidedSitePotentialWorkspaceSync({
  parcelId,
  userId,
}: {
  parcelId: string;
  userId: string | null;
}) {
  const vault = useErfFileVault(parcelId, GUIDED_SITE_POTENTIAL_CATEGORIES);
  const projectState = useSitePotentialProject(parcelId);

  useEffect(() => {
    if (!userId || vault.loading || projectState.loading) return;

    const current = readErfWorkspaceState(parcelId, undefined, userId);
    const nextSitePotential = buildGuidedSitePotentialSyncSnapshot(
      current.sitePotential,
      projectState.project,
      vault.assets,
    );
    if (!nextSitePotential) return;

    updateErfWorkspaceState(
      parcelId,
      {
        sitePotential: nextSitePotential,
        dirty: true,
      },
      undefined,
      userId,
    );
  }, [parcelId, projectState.loading, projectState.project, userId, vault.assets, vault.loading]);

  return null;
}

export default GuidedSitePotentialWorkspaceSync;
