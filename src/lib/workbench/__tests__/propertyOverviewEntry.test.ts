import { describe, expect, it } from "vitest";
import { createEmptyErfWorkspaceState } from "../erfWorkspaceState";
import { prepareWorkspaceEntry, resolvePropertyEntryTab } from "../propertyOverviewEntry";

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
});
