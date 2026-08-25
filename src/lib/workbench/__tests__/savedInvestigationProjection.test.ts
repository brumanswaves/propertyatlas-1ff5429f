import { describe, expect, it } from "vitest";
import { createEmptyErfWorkspaceState } from "../erfWorkspaceState";
import {
  SAVED_INVESTIGATION_PROJECTION_KEY,
  buildSavedInvestigationProjection,
  buildSavedInvestigationUserDataPatch,
  mergeSavedInvestigationProjectionIntoWorkspace,
  readSavedInvestigationProjection,
  shouldHydrateSavedInvestigationProjection,
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
    workspace.planning.userConfirmedAt = "2026-08-15T13:45:00.000Z";
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
      planning: {
        zoneCode: "RES1",
        userConfirmedZoneCode: "RES1",
        userConfirmedAt: "2026-08-15T13:45:00.000Z",
      },
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

  it("reads older v1 projections that do not yet contain confirmation timestamps", () => {
    const parsed = readSavedInvestigationProjection({
      easyErfInvestigation: {
        version: 1,
        parcelId: "parcel-1570",
        syncedAt: "2026-08-15T14:01:00.000Z",
        workspaceUpdatedAt: "2026-08-15T14:00:00.000Z",
        identityStatus: "looks_correct",
        planning: { zoneCode: "RES1", userConfirmedZoneCode: "RES1" },
        sitePotential: { progressState: "not_started" },
      },
    });

    expect(parsed?.planning).toEqual({
      zoneCode: "RES1",
      userConfirmedZoneCode: "RES1",
      userConfirmedAt: null,
    });
  });

  it("hydrates durable zoning, Site Potential and report state into a fresh browser workspace", () => {
    const durable = createEmptyErfWorkspaceState();
    durable.updatedAt = "2026-08-25T09:37:31.038Z";
    durable.identityStatus = "looks_correct";
    durable.reportStarted = true;
    durable.planning = {
      zoneCode: "RES1",
      userConfirmedZoneCode: "RES1",
      userConfirmedAt: "2026-08-25T09:30:00.000Z",
    };
    durable.sitePotential.progressState = "design_selected";
    durable.sitePotential.conceptCount = 3;
    durable.sitePotential.selectedDesignAssetId = "design-1570";
    durable.investigation.startedAt = "2026-08-25T09:28:36.576Z";
    durable.investigation.currentStepId = "report";
    durable.investigation.skippedStepIds = ["title"];
    durable.investigation.lastMeaningfulActionAt = "2026-08-25T09:37:27.844Z";

    const projection = buildSavedInvestigationProjection(
      "csg:lpi:c03400140000157000000",
      durable,
      "2026-08-25T09:37:32.277Z",
    );
    const freshBrowser = createEmptyErfWorkspaceState();

    expect(
      shouldHydrateSavedInvestigationProjection({
        hasStoredBrowserWorkspace: false,
        browserWorkspace: freshBrowser,
        projection,
      }),
    ).toBe(true);

    const hydrated = mergeSavedInvestigationProjectionIntoWorkspace(
      "csg:lpi:c03400140000157000000",
      freshBrowser,
      projection,
    );

    expect(hydrated.saved).toBe(true);
    expect(hydrated.dirty).toBe(false);
    expect(hydrated.planning).toEqual(durable.planning);
    expect(hydrated.sitePotential.progressState).toBe("design_selected");
    expect(hydrated.sitePotential.selectedDesignAssetId).toBe("design-1570");
    expect(hydrated.sitePotential.conceptCount).toBe(3);
    expect(hydrated.reportStarted).toBe(true);
    expect(hydrated.investigation.currentStepId).toBe("report");
  });

  it("preserves newer material browser work instead of replacing it with an older projection", () => {
    const browserWorkspace = createEmptyErfWorkspaceState();
    browserWorkspace.updatedAt = "2026-08-25T10:00:00.000Z";
    browserWorkspace.planning.zoneCode = "RES2";
    browserWorkspace.investigation.lastMeaningfulActionAt = "2026-08-25T10:00:00.000Z";

    const older = createEmptyErfWorkspaceState();
    older.updatedAt = "2026-08-25T09:00:00.000Z";
    older.planning.zoneCode = "RES1";
    const projection = buildSavedInvestigationProjection(
      "parcel-1570",
      older,
      "2026-08-25T09:01:00.000Z",
    );

    expect(
      shouldHydrateSavedInvestigationProjection({
        hasStoredBrowserWorkspace: true,
        browserWorkspace,
        projection,
      }),
    ).toBe(false);
  });

  it("allows durable progress to replace navigation-only browser state", () => {
    const browserWorkspace = createEmptyErfWorkspaceState();
    browserWorkspace.updatedAt = "2026-08-25T10:00:00.000Z";
    browserWorkspace.investigation.startedAt = "2026-08-25T10:00:00.000Z";
    browserWorkspace.investigation.lastViewedAt = "2026-08-25T10:00:00.000Z";

    const durable = createEmptyErfWorkspaceState();
    durable.updatedAt = "2026-08-25T09:00:00.000Z";
    durable.planning.zoneCode = "RES1";
    durable.planning.userConfirmedZoneCode = "RES1";
    const projection = buildSavedInvestigationProjection(
      "parcel-1570",
      durable,
      "2026-08-25T09:01:00.000Z",
    );

    expect(
      shouldHydrateSavedInvestigationProjection({
        hasStoredBrowserWorkspace: true,
        browserWorkspace,
        projection,
      }),
    ).toBe(true);
  });

  it("does not merge a projection from another parcel", () => {
    const browserWorkspace = createEmptyErfWorkspaceState();
    const durable = createEmptyErfWorkspaceState();
    durable.planning.zoneCode = "RES1";
    const projection = buildSavedInvestigationProjection("other-parcel", durable);

    expect(
      mergeSavedInvestigationProjectionIntoWorkspace(
        "parcel-1570",
        browserWorkspace,
        projection,
      ),
    ).toBe(browserWorkspace);
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
