import { describe, expect, it } from "vitest";
import { createEmptyErfWorkspaceState } from "../erfWorkspaceState";
import {
  SAVED_INVESTIGATION_PROJECTION_KEY,
  buildSavedInvestigationProjection,
  buildSavedInvestigationUserDataPatch,
  readSavedInvestigationProjection,
} from "../savedInvestigationProjection";

describe("saved investigation projection", () => {
  it("projects canonical workspace state without inventing completion", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.updatedAt = "2026-08-15T14:00:00.000Z";
    workspace.identityStatus = "looks_correct";
    workspace.sgDiagramAttachmentCount = 2;
    workspace.marketEvidenceStarted = true;
    workspace.strategyScenarioCount = 3;
    workspace.chosenScenarioId = "scenario-1";
    workspace.reportStarted = true;
    workspace.planning.zoneCode = "RES1";
    workspace.planning.userConfirmedZoneCode = "RES1";
    workspace.sitePotential.progressState = "concepts_ready";
    workspace.sitePotential.conceptCount = 2;
    workspace.investigation.startedAt = "2026-08-15T12:00:00.000Z";
    workspace.investigation.currentStepId = "zoning";
    workspace.investigation.skippedStepIds = ["title"];
    workspace.investigation.lastMeaningfulActionAt = "2026-08-15T13:30:00.000Z";

    const projection = buildSavedInvestigationProjection(
      "parcel-1570",
      workspace,
      "2026-08-15T14:01:00.000Z",
    );

    expect(projection).toMatchObject({
      version: 1,
      parcelId: "parcel-1570",
      identityStatus: "looks_correct",
      sgDiagramAttachmentCount: 2,
      marketEvidenceStarted: true,
      strategyScenarioCount: 3,
      chosenScenarioId: "scenario-1",
      reportStarted: true,
      planning: { zoneCode: "RES1", userConfirmedZoneCode: "RES1" },
      sitePotential: { progressState: "concepts_ready", conceptCount: 2 },
      investigation: {
        startedAt: "2026-08-15T12:00:00.000Z",
        currentStepId: "zoning",
        skippedStepIds: ["title"],
        lastMeaningfulActionAt: "2026-08-15T13:30:00.000Z",
      },
    });
    expect(projection).not.toHaveProperty("completedStepIds");
    expect(projection).not.toHaveProperty("readinessScore");
    expect(projection).not.toHaveProperty("nextBestAction");
  });

  it("wraps the projection in the existing saved-property user_data namespace", () => {
    const workspace = createEmptyErfWorkspaceState();
    const patch = buildSavedInvestigationUserDataPatch(
      "parcel-1570",
      workspace,
      "2026-08-15T14:01:00.000Z",
    );

    expect(Object.keys(patch)).toEqual([SAVED_INVESTIGATION_PROJECTION_KEY]);
    expect(patch[SAVED_INVESTIGATION_PROJECTION_KEY].parcelId).toBe("parcel-1570");
  });

  it("round-trips a valid durable projection", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.updatedAt = "2026-08-15T14:00:00.000Z";
    workspace.sitePotential.progressState = "design_selected";
    workspace.sitePotential.selectedDesignAssetId = "asset-1";
    workspace.investigation.startedAt = "2026-08-15T12:00:00.000Z";
    workspace.investigation.currentStepId = "site-potential";

    const patch = buildSavedInvestigationUserDataPatch(
      "parcel-1570",
      workspace,
      "2026-08-15T14:01:00.000Z",
    );
    const parsed = readSavedInvestigationProjection({ unrelated: "kept", ...patch });

    expect(parsed).not.toBeNull();
    expect(parsed?.parcelId).toBe("parcel-1570");
    expect(parsed?.sitePotential.progressState).toBe("design_selected");
    expect(parsed?.sitePotential.selectedDesignAssetId).toBe("asset-1");
    expect(parsed?.investigation.currentStepId).toBe("site-potential");
  });

  it("rejects malformed or unsupported projections", () => {
    expect(readSavedInvestigationProjection(null)).toBeNull();
    expect(readSavedInvestigationProjection({ easyErfInvestigation: { version: 99 } })).toBeNull();
    expect(
      readSavedInvestigationProjection({
        easyErfInvestigation: {
          version: 1,
          parcelId: "parcel-1570",
          syncedAt: "2026-08-15T14:01:00.000Z",
          workspaceUpdatedAt: "2026-08-15T14:00:00.000Z",
          identityStatus: "made_up",
          sitePotential: { progressState: "not_started" },
        },
      }),
    ).toBeNull();
  });
});
