import { describe, expect, it } from "vitest";
import { buildGuidedSitePotentialSyncSnapshot } from "@/lib/sitePotential/guidedSitePotentialSync";
import type { SitePotentialProject } from "@/lib/sitePotential/types";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

function project(overrides: Partial<SitePotentialProject> = {}): SitePotentialProject {
  return {
    id: "project-1570",
    user_id: "user-1",
    parcel_id: "csg:lpi:c03400140000157000000",
    mode: "vacant_land",
    design_brief: null,
    selected_style: null,
    renovation_level: null,
    requested_rooms: [],
    requested_features: [],
    custom_instructions: null,
    rights_confirmed_at: null,
    generation_status: "concepts_ready",
    selected_design_asset_id: null,
    skipped_at: null,
    metadata: {},
    created_at: "2026-08-25T11:06:00.000Z",
    updated_at: "2026-08-25T11:07:13.000Z",
    ...overrides,
  };
}

function generatedDesign(id: string): ErfAsset {
  return {
    id,
    user_id: "user-1",
    parcel_id: "csg:lpi:c03400140000157000000",
    asset_category: "generated_design",
    asset_type: "image",
    source_label: "Generated concept",
    storage_bucket: "erf-files",
    storage_path: `${id}.png`,
    original_file_name: `${id}.png`,
    mime_type: "image/png",
    size_bytes: 1,
    checksum_sha256: null,
    status: "ready",
    metadata: {},
    local_migration_fingerprint: null,
    created_at: "2026-08-25T11:07:00.000Z",
    updated_at: "2026-08-25T11:07:00.000Z",
  };
}

describe("guided Site Potential reconciliation", () => {
  it("promotes stale guided generating state when the canonical project is concepts_ready", () => {
    const current = createEmptyErfWorkspaceState().sitePotential;
    current.progressState = "generating";
    current.conceptCount = 0;

    const next = buildGuidedSitePotentialSyncSnapshot(current, project(), []);

    expect(next).not.toBeNull();
    expect(next?.projectId).toBe("project-1570");
    expect(next?.progressState).toBe("concepts_ready");
    expect(next?.conceptCount).toBe(0);
    expect(next?.selectedDesignAssetId).toBeNull();
  });

  it("counts only real generated-design assets and preserves the canonical selection", () => {
    const current = createEmptyErfWorkspaceState().sitePotential;
    const selected = generatedDesign("concept-2");
    const next = buildGuidedSitePotentialSyncSnapshot(
      current,
      project({
        generation_status: "design_selected",
        selected_design_asset_id: selected.id,
      }),
      [selected, generatedDesign("concept-3")],
    );

    expect(next?.progressState).toBe("design_selected");
    expect(next?.conceptCount).toBe(2);
    expect(next?.selectedDesignAssetId).toBe("concept-2");
    expect(next?.preferredConceptId).toBe("concept-2");
  });
});
