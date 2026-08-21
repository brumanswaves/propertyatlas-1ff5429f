import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import type { SitePotentialProject } from "../types";
import {
  buildSelectedDesignDeletionPatch,
  resolveSelectedSitePotentialDesign,
} from "../sitePotentialService";

function read(path: string) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function project(selectedDesignAssetId: string | null): SitePotentialProject {
  return {
    id: "project-1",
    user_id: "user-1",
    parcel_id: "parcel-1",
    mode: "vacant_land",
    design_brief: null,
    selected_style: null,
    renovation_level: null,
    requested_rooms: [],
    requested_features: [],
    custom_instructions: null,
    rights_confirmed_at: null,
    generation_status: selectedDesignAssetId ? "design_selected" : "concepts_ready",
    selected_design_asset_id: selectedDesignAssetId,
    skipped_at: null,
    metadata: {},
    created_at: "2026-07-15T00:00:00.000Z",
    updated_at: "2026-07-15T00:00:00.000Z",
  };
}

function asset(id: string, designPackId = "pack-a"): ErfAsset {
  return {
    id,
    user_id: "user-1",
    parcel_id: "parcel-1",
    asset_category: "generated_design",
    asset_type: "generated_design",
    source_label: "Generated Site Potential concept",
    storage_bucket: "erf-files",
    storage_path: `parcel-1/${id}.png`,
    original_file_name: `${id}.png`,
    mime_type: "image/png",
    size_bytes: 1024,
    checksum_sha256: null,
    status: "uploaded_reference_only",
    metadata: { designPackId },
    local_migration_fingerprint: null,
    created_at: "2026-07-15T00:00:00.000Z",
    updated_at: "2026-07-15T00:00:00.000Z",
  };
}

describe("Site Potential selected concept persistence", () => {
  it("does not build a destructive clear patch while File Vault assets are still loading", () => {
    const selectedProject = project("asset-selected");

    expect(resolveSelectedSitePotentialDesign(selectedProject, [])).toBeNull();
    expect(buildSelectedDesignDeletionPatch(selectedProject, asset("other"), [])).toBeNull();
  });

  it("resolves the selected design when File Vault assets arrive later", () => {
    const selectedProject = project("asset-selected");
    const selectedAsset = asset("asset-selected");

    expect(
      resolveSelectedSitePotentialDesign(selectedProject, [asset("other"), selectedAsset]),
    ).toBe(selectedAsset);
  });

  it("does not treat active design-pack filtering as confirmed deletion", () => {
    const selectedProject = project("asset-from-previous-pack");
    const filteredCurrentPackAssets = [asset("asset-from-new-pack", "pack-b")];

    expect(
      resolveSelectedSitePotentialDesign(selectedProject, filteredCurrentPackAssets),
    ).toBeNull();
    expect(
      buildSelectedDesignDeletionPatch(
        selectedProject,
        filteredCurrentPackAssets[0],
        filteredCurrentPackAssets,
      ),
    ).toBeNull();
  });

  it("does not clear the selected concept when a new pack begins generating", () => {
    const selectedProject = project("previous-pack-selected");
    const newPackPlaceholder = asset("new-pack-concept", "pack-b");

    expect(
      buildSelectedDesignDeletionPatch(selectedProject, newPackPlaceholder, [newPackPlaceholder]),
    ).toBeNull();
  });

  it("deleting an unselected generated concept preserves the preferred selection", () => {
    const selectedProject = project("asset-selected");

    expect(
      buildSelectedDesignDeletionPatch(selectedProject, asset("asset-unselected"), [
        asset("asset-selected"),
        asset("asset-unselected"),
      ]),
    ).toBeNull();
  });

  it("deleting the selected generated concept clears selection after confirmed deletion", () => {
    const selectedProject = project("asset-selected");

    expect(
      buildSelectedDesignDeletionPatch(selectedProject, asset("asset-selected"), [
        asset("asset-selected"),
        asset("asset-other"),
      ]),
    ).toEqual({
      selected_design_asset_id: null,
      generation_status: "concepts_ready",
    });
  });

  it("deleting the final selected generated concept returns the project to not started", () => {
    const selectedProject = project("asset-selected");

    expect(
      buildSelectedDesignDeletionPatch(selectedProject, asset("asset-selected"), [
        asset("asset-selected"),
      ]),
    ).toEqual({
      selected_design_asset_id: null,
      generation_status: "not_started",
    });
  });

  it("removes concept selection controls from the simplified R999 Site Potential UI", () => {
    const sitePotentialTab = read("src/components/property/dossier/SitePotentialTab.tsx");
    expect(sitePotentialTab).not.toContain("selected_design_asset_id: asset?.id ?? null");
    expect(sitePotentialTab).not.toContain("Select for Easy Erf Report");
  });

  it("keeps generated-concept hook plumbing out of the simplified R999 Site Potential UI", () => {
    const sitePotentialTab = read("src/components/property/dossier/SitePotentialTab.tsx");
    const service = read("src/lib/sitePotential/sitePotentialService.ts");
    expect(sitePotentialTab).not.toContain("useSitePotentialProject(parcel.id, allGeneratedDesigns)");
    expect(sitePotentialTab).not.toContain("removeGeneratedDesign(asset)");
    expect(service).not.toContain("clearMissingSelectedDesign");
  });

  it("keeps the Easy Erf Report selected concept view tied to persisted project state", () => {
    const dossier = read("src/components/property/ErfResearchDossier.tsx");

    expect(dossier).toContain(
      "const siteProject = useSitePotentialProject(parcel.id, generatedDesigns)",
    );
    expect(dossier).toContain("<SignedAssetPreview asset={selectedDesign} />");
    expect(dossier).not.toContain("clearMissingSelectedDesign");
  });
});
