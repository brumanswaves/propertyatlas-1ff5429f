import { describe, expect, it } from "vitest";

import {
  buildSyncedSitePotentialSnapshot,
  sitePotentialSnapshotsMatch,
} from "../sitePotentialSnapshotSync";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";

function baseSnapshot() {
  return {
    ...createEmptyErfWorkspaceState().sitePotential,
    projectId: "project-1570",
    mode: "vacant_land" as const,
    photoCount: 1,
    planCount: 2,
    conceptCount: 4,
    selectedDesignAssetId: "concept-1",
    preferredConceptId: "concept-1",
    imageRightsConfirmed: true,
    rightsConfirmedAt: "2026-07-20T10:00:00.000Z",
    progressState: "concepts_ready" as const,
  };
}

describe("Site Potential workspace snapshot sync", () => {
  it("does not create a workspace patch when the stored Site Potential snapshot already matches", () => {
    const current = baseSnapshot();

    const next = buildSyncedSitePotentialSnapshot(current, {
      projectId: "project-1570",
      photoCount: 1,
      planCount: 2,
      conceptCount: 4,
      selectedDesignAssetId: "concept-1",
      mode: "vacant_land",
      generationStatus: "concepts_ready",
      imageRightsConfirmed: true,
      rightsConfirmedAt: "2026-07-20T10:00:00.000Z",
      activePackProjectState: null,
    });

    expect(next).toBeNull();
  });

  it("remains idempotent when a parent rerender changes only callback identity", () => {
    const current = baseSnapshot();
    const input = {
      projectId: "project-1570",
      photoCount: 1,
      planCount: 2,
      conceptCount: 4,
      selectedDesignAssetId: "concept-1",
      mode: "vacant_land" as const,
      generationStatus: "concepts_ready" as const,
      imageRightsConfirmed: true,
      rightsConfirmedAt: "2026-07-20T10:00:00.000Z",
      activePackProjectState: null,
    };

    const firstRerender = buildSyncedSitePotentialSnapshot(current, input);
    const secondRerender = buildSyncedSitePotentialSnapshot(current, input);

    expect(firstRerender).toBeNull();
    expect(secondRerender).toBeNull();
  });

  it("creates a workspace patch when Site Potential values genuinely change", () => {
    const current = baseSnapshot();

    const next = buildSyncedSitePotentialSnapshot(current, {
      projectId: "project-1570",
      photoCount: 2,
      planCount: 2,
      conceptCount: 4,
      selectedDesignAssetId: "concept-1",
      mode: "vacant_land",
      generationStatus: "concepts_ready",
      imageRightsConfirmed: true,
      rightsConfirmedAt: "2026-07-20T10:00:00.000Z",
      activePackProjectState: null,
    });

    expect(next).not.toBeNull();
    expect(next?.photoCount).toBe(2);
    expect(sitePotentialSnapshotsMatch(current, next!)).toBe(false);
  });

  it("does not mark skipped or clear the selected concept unless the project state says so", () => {
    const current = baseSnapshot();

    const next = buildSyncedSitePotentialSnapshot(current, {
      projectId: "project-1570",
      photoCount: 1,
      planCount: 2,
      conceptCount: 4,
      selectedDesignAssetId: "concept-1",
      mode: "vacant_land",
      generationStatus: "concepts_ready",
      imageRightsConfirmed: true,
      rightsConfirmedAt: "2026-07-20T10:00:00.000Z",
      activePackProjectState: null,
    });

    expect(next).toBeNull();
  });
});
