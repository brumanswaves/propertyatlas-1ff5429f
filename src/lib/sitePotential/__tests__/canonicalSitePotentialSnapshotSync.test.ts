import { describe, expect, it } from "vitest";

import { buildCanonicalSitePotentialSnapshot } from "../sitePotentialSnapshotSync";
import type { SitePotentialProject } from "../types";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

function project(overrides: Partial<SitePotentialProject> = {}): SitePotentialProject {
  return {
    id: "project-1570",
    user_id: "user-1",
    parcel_id: "parcel-1570",
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
    created_at: "2026-08-27T10:00:00.000Z",
    updated_at: "2026-08-27T10:00:00.000Z",
    ...overrides,
  };
}

function asset(
  asset_category: ErfAsset["asset_category"],
  status: ErfAsset["status"] = "ready",
) {
  return { asset_category, status };
}

describe("canonical Site Potential snapshot reconciliation", () => {
  it("repairs a stale generating workspace from the canonical completed project and assets", () => {
    const current = {
      ...createEmptyErfWorkspaceState().sitePotential,
      projectId: "project-1570",
      mode: "vacant_land" as const,
      progressState: "generating" as const,
      conceptCount: 0,
    };

    const next = buildCanonicalSitePotentialSnapshot(current, project(), [
      asset("generated_design"),
      asset("generated_design"),
      asset("generated_design"),
    ]);

    expect(next).not.toBeNull();
    expect(next?.progressState).toBe("concepts_ready");
    expect(next?.conceptCount).toBe(3);
    expect(next?.projectId).toBe("project-1570");
  });

  it("reconciles canonical photo, support-file, selected-design, and rights state", () => {
    const current = createEmptyErfWorkspaceState().sitePotential;
    const next = buildCanonicalSitePotentialSnapshot(
      current,
      project({
        selected_design_asset_id: "design-2",
        generation_status: "design_selected",
        rights_confirmed_at: "2026-08-27T11:00:00.000Z",
      }),
      [
        asset("site_photo"),
        asset("existing_house_photo"),
        asset("topography"),
        asset("architectural_plan"),
        asset("inspiration_image"),
        asset("other"),
        asset("generated_design"),
        asset("generated_design"),
      ],
    );

    expect(next).toMatchObject({
      photoCount: 2,
      planCount: 4,
      conceptCount: 2,
      selectedDesignAssetId: "design-2",
      preferredConceptId: "design-2",
      imageRightsConfirmed: true,
      rightsConfirmedAt: "2026-08-27T11:00:00.000Z",
      progressState: "design_selected",
    });
  });

  it("ignores deleted assets and is idempotent once the workspace matches", () => {
    const assets = [
      asset("generated_design"),
      asset("generated_design", "deleted"),
      asset("site_photo"),
      asset("site_photo", "deleted"),
    ];
    const first = buildCanonicalSitePotentialSnapshot(
      createEmptyErfWorkspaceState().sitePotential,
      project(),
      assets,
    );

    expect(first).not.toBeNull();
    expect(first?.conceptCount).toBe(1);
    expect(first?.photoCount).toBe(1);
    expect(buildCanonicalSitePotentialSnapshot(first!, project(), assets)).toBeNull();
  });

  it("does not rewrite workspace Site Potential state when no canonical project exists", () => {
    const current = {
      ...createEmptyErfWorkspaceState().sitePotential,
      progressState: "inputs_added" as const,
      photoCount: 1,
    };

    expect(buildCanonicalSitePotentialSnapshot(current, null, [asset("site_photo")])).toBeNull();
  });
});
