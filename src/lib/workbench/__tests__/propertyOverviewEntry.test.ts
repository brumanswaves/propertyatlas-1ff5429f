import { describe, expect, it } from "vitest";
import { createEmptyErfWorkspaceState } from "../erfWorkspaceState";
import {
  prepareGuidedIdentityConfirmationTransition,
  prepareExplicitWorkspaceTransition,
  prepareWorkspaceEntry,
  resolvePropertyEntryTab,
} from "../propertyOverviewEntry";

describe("property overview entry", () => {
  it("defaults a normal official parcel open to Overview", () => {
    expect(resolvePropertyEntryTab("")).toBe("overview");
    expect(resolvePropertyEntryTab("?officialParcel=csg%3Alpi%3Atest")).toBe("overview");
    expect(resolvePropertyEntryTab("?tab=guided")).toBe("investigation");
    expect(resolvePropertyEntryTab("?tab=market")).toBe("listings");
  });

  it("keeps the default overview zero-commit", () => {
    const workspace = createEmptyErfWorkspaceState();
    const result = prepareWorkspaceEntry({
      workspace,
      mergedIdentityStatus: "none",
      savedScenarioCount: 0,
      initialTab: "overview",
      now: "2026-08-08T08:00:00.000Z",
    });

    expect(result.persistencePatch).toBeNull();
    expect(result.displayWorkspace.investigation).toEqual(workspace.investigation);
    expect(result.displayWorkspace.investigation.startedAt).toBeNull();
    expect(result.displayWorkspace.reportStarted).toBe(false);
    expect(result.displayWorkspace.marketEvidenceStarted).toBe(false);
    expect(result.displayWorkspace.calculatorStarted).toBe(false);
  });

  it("starts Guided only on explicit investigation entry", () => {
    const workspace = createEmptyErfWorkspaceState();
    const result = prepareWorkspaceEntry({
      workspace,
      mergedIdentityStatus: "none",
      savedScenarioCount: 0,
      initialTab: "investigation",
      now: "2026-08-08T08:00:00.000Z",
    });

    expect(result.persistencePatch?.investigation).toMatchObject({
      startedAt: "2026-08-08T08:00:00.000Z",
      lastViewedAt: "2026-08-08T08:00:00.000Z",
      expertWorkspaceOpen: false,
    });
  });

  it("preserves a resumed Guided step", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.investigation.startedAt = "2026-08-01T08:00:00.000Z";
    workspace.investigation.currentStepId = "add-address";
    const result = prepareWorkspaceEntry({
      workspace,
      mergedIdentityStatus: "checked",
      savedScenarioCount: 2,
      initialTab: "investigation",
      now: "2026-08-08T08:00:00.000Z",
    });

    expect(result.displayWorkspace.investigation.startedAt).toBe(
      "2026-08-01T08:00:00.000Z",
    );
    expect(result.displayWorkspace.investigation.currentStepId).toBe("add-address");
    expect(result.displayWorkspace.identityStatus).toBe("checked");
    expect(result.displayWorkspace.strategyScenarioCount).toBe(2);
  });

  it("keeps hydrated canonical state zero-write until the user enters Guided", () => {
    const persistedWorkspace = createEmptyErfWorkspaceState();
    persistedWorkspace.investigation.currentStepId = "add-address";
    const overview = prepareWorkspaceEntry({
      workspace: persistedWorkspace,
      mergedIdentityStatus: "looks_correct",
      savedScenarioCount: 3,
      initialTab: "overview",
      now: "2026-08-08T08:00:00.000Z",
    });

    expect(overview.persistencePatch).toBeNull();
    expect(persistedWorkspace.identityStatus).toBe("none");
    expect(persistedWorkspace.strategyScenarioCount).toBe(0);
    expect(persistedWorkspace.investigation.startedAt).toBeNull();

    const guidedPatch = prepareExplicitWorkspaceTransition({
      persistedWorkspace,
      displayWorkspace: overview.displayWorkspace,
      investigationPatch: { expertWorkspaceOpen: false },
      now: "2026-08-08T08:05:00.000Z",
    });

    expect(guidedPatch.identityStatus).toBe("looks_correct");
    expect(guidedPatch.strategyScenarioCount).toBe(3);
    expect(guidedPatch.investigation).toMatchObject({
      startedAt: "2026-08-08T08:05:00.000Z",
      currentStepId: "add-address",
      expertWorkspaceOpen: false,
    });
  });

  it("confirms identity and advances to Add address without a stale second write", () => {
    const persistedWorkspace = createEmptyErfWorkspaceState();
    persistedWorkspace.investigation.currentStepId = "confirm-property";
    persistedWorkspace.investigation.intentionallyVisitedStepIds = ["confirm-property"];
    const displayWorkspace = {
      ...persistedWorkspace,
      strategyScenarioCount: 2,
    };

    const patch = prepareGuidedIdentityConfirmationTransition({
      persistedWorkspace,
      displayWorkspace,
      now: "2026-08-08T09:00:00.000Z",
    });

    expect(patch).toMatchObject({
      identityStatus: "looks_correct",
      strategyScenarioCount: 2,
      dirty: true,
      investigation: {
        currentStepId: "add-address",
        intentionallyVisitedStepIds: ["confirm-property", "add-address"],
        expertWorkspaceOpen: false,
        lastMeaningfulActionAt: "2026-08-08T09:00:00.000Z",
      },
    });
  });
});
