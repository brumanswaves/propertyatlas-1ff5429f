import { describe, expect, it } from "vitest";
import {
  buildErfWorkspaceNextStep,
  buildStoepStepProgress,
  createEmptyErfWorkspaceState,
  erfStrategyScenariosKey,
  erfStrategyWorkspaceKey,
  erfWorkspaceStateKey,
  getChosenStrategyScenario,
  mergeStrategyWorkspaces,
  readStrategyWorkspace,
  readErfWorkspaceState,
  saveStrategyDraft,
  saveStrategyScenario,
  strategyWorkspaceFromUserData,
  updateErfWorkspaceState,
  writeErfWorkspaceState,
} from "../erfWorkspaceState";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => Array.from(map.keys())[index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, String(value));
    },
  };
}

describe("erfWorkspaceState", () => {
  it("persists workspace state per normalized parcel id", () => {
    const storage = memoryStorage();
    const parcelId = "csg:lpi:c03400140000096200000";

    const updated = updateErfWorkspaceState(
      parcelId,
      {
        saved: true,
        identityStatus: "checked",
        openedSourceIds: ["csg-property-viewer"],
        reviewedSourceIds: ["csg-property-viewer"],
      },
      storage,
    );

    expect(storage.getItem(erfWorkspaceStateKey(parcelId))).toContain("csg-property-viewer");
    expect(readErfWorkspaceState(parcelId, storage)).toMatchObject({
      saved: true,
      identityStatus: "checked",
      openedSourceIds: ["csg-property-viewer"],
      reviewedSourceIds: ["csg-property-viewer"],
    });
    expect(updated.updatedAt).toEqual(expect.any(String));
  });

  it("isolates workspace and Strategy drafts between signed-in accounts", () => {
    const storage = memoryStorage();
    const parcelId = "csg:lpi:c03400140000157000000";

    updateErfWorkspaceState(parcelId, { identityStatus: "checked" }, storage, "account-a");
    saveStrategyDraft(
      parcelId,
      {
        activeStrategy: "development_sell",
        draftInputs: { landCost: "900000" },
        updatedAt: "2026-08-10T10:00:00.000Z",
      },
      storage,
      "account-a",
    );

    updateErfWorkspaceState(parcelId, { identityStatus: "uncertain" }, storage, "account-b");
    saveStrategyDraft(
      parcelId,
      {
        activeStrategy: "flip",
        draftInputs: { purchasePrice: "1200000" },
        updatedAt: "2026-08-10T10:01:00.000Z",
      },
      storage,
      "account-b",
    );

    expect(readErfWorkspaceState(parcelId, storage, "account-a").identityStatus).toBe("checked");
    expect(readStrategyWorkspace(parcelId, storage, "account-a")).toMatchObject({
      activeStrategy: "development_sell",
      draftInputs: { landCost: "900000" },
    });
    expect(readErfWorkspaceState(parcelId, storage, "account-b").identityStatus).toBe("uncertain");
    expect(readStrategyWorkspace(parcelId, storage, "account-b")).toMatchObject({
      activeStrategy: "flip",
      draftInputs: { purchasePrice: "1200000" },
    });
    expect(storage.getItem(erfWorkspaceStateKey(parcelId, "account-a"))).not.toBeNull();
    expect(storage.getItem(erfStrategyWorkspaceKey(parcelId, "account-b"))).not.toBeNull();
  });

  it("does not silently claim legacy parcel-only workspace or strategy records for a signed-in user", () => {
    const storage = memoryStorage();
    const parcelId = "legacy-parcel";
    storage.setItem(
      `erfstoep.workspace.${parcelId}`,
      JSON.stringify({ identityStatus: "looks_correct", saved: true }),
    );
    storage.setItem(
      `erfstoep.strategyScenarios.${parcelId}`,
      JSON.stringify([
        {
          id: "legacy-scenario",
          parcelId,
          label: "Legacy scenario",
          strategy: "development_sell",
          inputs: { landCost: "1200000" },
          summary: [],
          selected: true,
          savedAt: "2026-07-18T12:00:00.000Z",
        },
      ]),
    );

    expect(readErfWorkspaceState(parcelId, storage, "account-b").identityStatus).toBe("none");
    expect(readStrategyWorkspace(parcelId, storage, "account-b").scenarios).toEqual([]);
    expect(storage.getItem(erfStrategyScenariosKey(parcelId, "account-b"))).toBeNull();
  });

  it("coerces legacy investigation snapshots into the versioned guided journey shape", () => {
    const storage = memoryStorage();
    const parcelId = "csg:lpi:c03400140000102100000";
    storage.setItem(
      erfWorkspaceStateKey(parcelId),
      JSON.stringify({
        identityStatus: "looks_correct",
        investigation: {
          version: 1,
          startedAt: "2026-07-30T08:00:00.000Z",
          skippedTaskIds: ["add-sg-diagram"],
          currentStepId: "market",
          intentionallyVisitedStepIds: ["market"],
          skippedStepIds: ["add-address"],
          expertWorkspaceOpen: true,
          lastExpertView: "calculators",
        },
      }),
    );

    expect(readErfWorkspaceState(parcelId, storage).investigation).toMatchObject({
      version: 2,
      startedAt: "2026-07-30T08:00:00.000Z",
      skippedTaskIds: ["add-sg-diagram"],
      currentStepId: "market",
      intentionallyVisitedStepIds: ["market"],
      skippedStepIds: ["add-address"],
      expertWorkspaceOpen: true,
      lastExpertView: "calculators",
      guidedReturnStepId: null,
    });
  });

  it("preserves a Guided expert return context while the real expert workspace is open", () => {
    const storage = memoryStorage();
    const parcelId = "csg:lpi:c03400140000157000000";
    const state = createEmptyErfWorkspaceState();
    state.investigation = {
      ...state.investigation,
      startedAt: "2026-08-10T10:00:00.000Z",
      currentStepId: "strategy",
      expertWorkspaceOpen: true,
      lastExpertView: "calculators",
      guidedReturnStepId: "strategy",
    };

    writeErfWorkspaceState(parcelId, state, storage);

    expect(readErfWorkspaceState(parcelId, storage).investigation).toMatchObject({
      currentStepId: "strategy",
      expertWorkspaceOpen: true,
      lastExpertView: "calculators",
      guidedReturnStepId: "strategy",
    });
  });

  it("starts recommended next step with official identity", () => {
    expect(buildErfWorkspaceNextStep(createEmptyErfWorkspaceState())).toMatchObject({
      title: "Verify the official parcel identity",
      tab: "research",
      why: "Every comp, calculator and report depends on researching the correct erf.",
      doneWhen:
        "Identity looks correct is selected, or source review is completed and identity is checked.",
    });
  });

  it("moves an opened source into review before identity completion", () => {
    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        openedSourceIds: ["csg-property-viewer"],
      }),
    ).toMatchObject({
      title: "Review the official source",
      doNow: "Compare erf number, portion, area, size, LPI, parcel key and coordinates.",
      tab: "research",
    });
  });

  it("keeps identity resolution first when identity is uncertain", () => {
    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "uncertain",
      }),
    ).toMatchObject({
      title: "Resolve official parcel identity",
      next: "Build Market Evidence once the identity is comfortable.",
      tab: "research",
    });
  });

  it("moves checked identity through sources, market, strategy, Site Potential, then reports", () => {
    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "looks_correct",
      }),
    ).toMatchObject({ title: "Add or review sources", tab: "research" });

    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "looks_correct",
        openedSourceIds: ["csg-property-viewer"],
      }),
    ).toMatchObject({ title: "Review the opened source", tab: "research" });

    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "looks_correct",
        reviewedSourceIds: ["csg-property-viewer"],
      }),
    ).toMatchObject({ title: "Build Market Evidence", tab: "listings" });

    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "checked",
        reviewedSourceIds: ["csg-property-viewer"],
        marketEvidenceStarted: true,
      }),
    ).toMatchObject({ title: "Run Strategy Lab calculators", tab: "calculators" });

    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "checked",
        reviewedSourceIds: ["csg-property-viewer"],
        marketEvidenceStarted: true,
        calculatorStarted: true,
      }),
    ).toMatchObject({ title: "Run Strategy Lab calculators", tab: "calculators" });

    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "checked",
        reviewedSourceIds: ["csg-property-viewer"],
        marketEvidenceStarted: true,
        calculatorStarted: true,
        strategyScenarioCount: 1,
      }),
    ).toMatchObject({ title: "Explore Site Potential", tab: "site-potential" });

    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "checked",
        reviewedSourceIds: ["csg-property-viewer"],
        marketEvidenceStarted: true,
        calculatorStarted: true,
        strategyScenarioCount: 1,
        sitePotential: {
          ...createEmptyErfWorkspaceState().sitePotential,
          skipped: true,
          progressState: "skipped",
        },
      }),
    ).toMatchObject({ title: "Create Easy Erf Report", tab: "stoep-report" });
  });

  it("treats SG attachments and saved market addresses as real progress", () => {
    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "checked",
        sgDiagramAttachmentCount: 1,
      }),
    ).toMatchObject({ title: "Build Market Evidence", tab: "listings" });

    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "checked",
        sgDiagramAttachmentCount: 1,
        sitePotential: {
          ...createEmptyErfWorkspaceState().sitePotential,
          skipped: true,
          progressState: "skipped",
        },
        marketAddressSaved: true,
      }),
    ).toMatchObject({ title: "Run Strategy Lab calculators", tab: "calculators" });
  });

  it("does not mark Site Potential complete for a project row without a selected concept or skip", () => {
    const nextStep = buildErfWorkspaceNextStep({
      ...createEmptyErfWorkspaceState(),
      identityStatus: "checked",
      reviewedSourceIds: ["csg-property-viewer"],
      marketEvidenceStarted: true,
      strategyScenarioCount: 1,
      sitePotential: {
        ...createEmptyErfWorkspaceState().sitePotential,
        projectId: "project-1",
        mode: "vacant_land",
        progressState: "inputs_added",
      },
    });

    expect(nextStep).toMatchObject({
      title: "Finish or skip Site Potential",
      tab: "site-potential",
      doneWhen: "One generated design is selected, or Site Potential is skipped for this erf.",
    });
  });

  it("updates the chosen Strategy Lab scenario as the chosen scenario", () => {
    const storage = memoryStorage();
    const parcelId = "csg:lpi:c03400140000102100000";

    const first = saveStrategyScenario(
      parcelId,
      {
        label: "Buy and hold rental scenario",
        strategy: "buy_hold",
        inputs: { monthlyRent: "18000" },
        summary: [{ label: "Monthly cash flow", value: "R2,000" }],
      },
      storage,
    );
    const second = saveStrategyScenario(
      parcelId,
      {
        label: "Development to rent scenario",
        strategy: "development_rent",
        inputs: { expectedMonthlyRent: "42000" },
        summary: [{ label: "Net yield", value: "7.7%" }],
      },
      storage,
    );

    expect(first.scenario.selected).toBe(true);
    expect(second.scenario.selected).toBe(true);
    expect(second.scenario.id).toBe(first.scenario.id);
    expect(readErfWorkspaceState(parcelId, storage)).toMatchObject({
      calculatorStarted: true,
      strategyScenarioCount: 1,
      chosenScenarioId: second.scenario.id,
    });
    expect(getChosenStrategyScenario(parcelId, storage)).toMatchObject({
      id: second.scenario.id,
      label: "Development to rent scenario",
      selected: true,
    });
    expect(second.scenarios).toHaveLength(1);
  });

  it("autosaves Strategy Lab draft inputs separately from the chosen report scenario", () => {
    const storage = memoryStorage();
    const parcelId = "csg:lpi:c03400140000102100000";

    const draft = saveStrategyDraft(
      parcelId,
      {
        activeStrategy: "flip",
        draftInputs: { purchasePrice: "2100000", expectedResalePrice: "2800000" },
        updatedAt: "2026-07-20T10:00:00.000Z",
      },
      storage,
    );

    expect(storage.getItem(erfStrategyWorkspaceKey(parcelId))).toContain("expectedResalePrice");
    expect(draft.chosenScenarioId).toBeNull();
    expect(readErfWorkspaceState(parcelId, storage)).toMatchObject({
      calculatorStarted: true,
      strategyScenarioCount: 0,
      chosenScenarioId: null,
    });

    const { scenario } = saveStrategyScenario(
      parcelId,
      {
        label: "Buy and hold rental scenario",
        strategy: "buy_hold",
        inputs: { monthlyRent: "18000" },
        summary: [{ label: "Monthly cash flow", value: "R2,000" }],
      },
      storage,
    );

    const workspace = readStrategyWorkspace(parcelId, storage);
    expect(workspace.draftInputs.monthlyRent).toBe("18000");
    expect(workspace.chosenScenarioId).toBe(scenario.id);
    expect(getChosenStrategyScenario(parcelId, storage)?.id).toBe(scenario.id);
  });

  it("keeps legacy local strategy scenarios unclaimed until a dedicated migration is available", () => {
    const storage = memoryStorage();
    const parcelId = "legacy-parcel";
    storage.setItem(
      `erfstoep.strategyScenarios.${parcelId}`,
      JSON.stringify([
        {
          id: "legacy-scenario",
          parcelId,
          label: "Legacy scenario",
          strategy: "development_sell",
          inputs: { landCost: "1200000" },
          summary: [{ label: "Margin", value: "18%" }],
          selected: true,
          savedAt: "2026-07-18T12:00:00.000Z",
        },
      ]),
    );

    const workspace = readStrategyWorkspace(parcelId, storage);

    expect(workspace.migratedFromLegacy).toBe(false);
    expect(workspace.activeStrategy).toBe("buy_hold");
    expect(workspace.draftInputs).toEqual({});
    expect(workspace.chosenScenarioId).toBeNull();
  });

  it("merges signed-in cloud Strategy workspace without losing local draft edits", () => {
    const parcelId = "cloud-parcel";
    const local = {
      ...readStrategyWorkspace(parcelId, memoryStorage()),
      activeStrategy: "flip",
      draftInputs: { expectedResalePrice: "3000000" },
      draftUpdatedAt: "2026-07-20T12:00:00.000Z",
    };
    const remote = strategyWorkspaceFromUserData(parcelId, {
      savedMarketEvidence: [{ id: "untouched-market-namespace" }],
      strategyWorkspace: {
        schemaVersion: 1,
        parcelId,
        activeStrategy: "buy_hold",
        draftInputs: { monthlyRent: "22000" },
        draftUpdatedAt: "2026-07-19T12:00:00.000Z",
        scenarios: [
          {
            id: "remote-scenario",
            parcelId,
            label: "Remote scenario",
            strategy: "buy_hold",
            inputs: { monthlyRent: "22000" },
            summary: [{ label: "Net yield", value: "6.2%" }],
            selected: true,
            savedAt: "2026-07-19T12:01:00.000Z",
          },
        ],
        chosenScenarioId: "remote-scenario",
      },
    });

    const merged = mergeStrategyWorkspaces(parcelId, local, remote);

    expect(merged.activeStrategy).toBe("flip");
    expect(merged.draftInputs.expectedResalePrice).toBe("3000000");
    expect(merged.scenarios).toHaveLength(1);
    expect(merged.chosenScenarioId).toBe("remote-scenario");
  });

  it("resolves Strategy draft and chosen scenario conflicts by valid timestamps", () => {
    const parcelId = "timestamp-parcel";
    const local = {
      ...readStrategyWorkspace(parcelId, memoryStorage()),
      activeStrategy: "flip",
      draftInputs: { expectedResalePrice: "3300000" },
      draftUpdatedAt: "2026-07-20T12:00:00.000Z",
      chosenScenarioId: "local-choice",
      chosenScenarioUpdatedAt: "2026-07-20T12:05:00.000Z",
      scenarios: [
        {
          id: "local-choice",
          parcelId,
          label: "Local flip",
          strategy: "flip",
          inputs: { expectedResalePrice: "3300000" },
          summary: [{ label: "ROI", value: "21%" }],
          selected: true,
          savedAt: "2026-07-20T12:01:00.000Z",
          updatedAt: "2026-07-20T12:05:00.000Z",
        },
      ],
    };
    const remote = strategyWorkspaceFromUserData(parcelId, {
      strategyWorkspace: {
        schemaVersion: 1,
        parcelId,
        activeStrategy: "buy_hold",
        draftInputs: { monthlyRent: "18000" },
        draftUpdatedAt: "2026-07-20T11:00:00.000Z",
        chosenScenarioId: "remote-choice",
        chosenScenarioUpdatedAt: "2026-07-20T11:05:00.000Z",
        scenarios: [
          {
            id: "remote-choice",
            parcelId,
            label: "Remote rental",
            strategy: "buy_hold",
            inputs: { monthlyRent: "18000" },
            summary: [{ label: "Yield", value: "6%" }],
            selected: true,
            savedAt: "2026-07-20T11:01:00.000Z",
            updatedAt: "2026-07-20T11:05:00.000Z",
          },
        ],
      },
    });

    const merged = mergeStrategyWorkspaces(parcelId, local, remote);

    expect(merged.activeStrategy).toBe("flip");
    expect(merged.draftInputs.expectedResalePrice).toBe("3300000");
    expect(merged.chosenScenarioId).toBe("local-choice");
    expect(merged.scenarios).toHaveLength(2);
  });

  it("updates the chosen Strategy scenario instead of duplicating unless requested", () => {
    const parcelId = "chosen-update-parcel";
    const storage = memoryStorage();

    const first = saveStrategyScenario(
      parcelId,
      {
        label: "Buy and hold rental scenario",
        strategy: "buy_hold",
        inputs: { monthlyRent: "15000" },
        summary: [{ label: "Cash flow", value: "R 1,000" }],
        selected: true,
      },
      storage,
    );
    const updated = saveStrategyScenario(
      parcelId,
      {
        label: "Buy and hold rental scenario",
        strategy: "buy_hold",
        inputs: { monthlyRent: "18000" },
        summary: [{ label: "Cash flow", value: "R 2,000" }],
        selected: true,
      },
      storage,
    );

    expect(updated.scenarios).toHaveLength(1);
    expect(updated.scenario.id).toBe(first.scenario.id);
    expect(updated.scenario.savedAt).toBe(first.scenario.savedAt);
    expect(updated.scenario.updatedAt).not.toBe(first.scenario.updatedAt);

    const asNew = saveStrategyScenario(
      parcelId,
      {
        label: "Flip scenario",
        strategy: "flip",
        inputs: { expectedResalePrice: "3000000" },
        summary: [{ label: "ROI", value: "18%" }],
        selected: true,
      },
      { asNew: true },
      storage,
    );

    expect(asNew.scenarios).toHaveLength(2);
    expect(asNew.scenario.id).not.toBe(first.scenario.id);
  });

  it("builds honest Easy Erf Steps progress from workspace state", () => {
    expect(buildStoepStepProgress(createEmptyErfWorkspaceState())).toMatchObject([
      { label: "Identity", status: "Current" },
      { label: "Sources", status: "Needs evidence" },
      { label: "Market", status: "Not started" },
      { label: "Strategy", status: "Not started" },
      { label: "Site", status: "Not started" },
      { label: "Report", status: "Not started" },
    ]);

    expect(
      buildStoepStepProgress({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "uncertain",
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Identity", status: "Blocked / uncertain" }),
        expect.objectContaining({ label: "Market", status: "Blocked / uncertain" }),
      ]),
    );

    expect(
      buildStoepStepProgress({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "looks_correct",
        reviewedSourceIds: ["csg-property-viewer"],
        sitePotential: {
          ...createEmptyErfWorkspaceState().sitePotential,
          selectedDesignAssetId: "asset-123",
          progressState: "design_selected",
          conceptCount: 6,
        },
        marketEvidenceStarted: true,
        calculatorStarted: true,
        strategyScenarioCount: 1,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Identity", status: "Done" }),
        expect.objectContaining({ label: "Sources", status: "Done" }),
        expect.objectContaining({ label: "Market", status: "Done" }),
        expect.objectContaining({ label: "Strategy", status: "Done" }),
        expect.objectContaining({ label: "Site", status: "Done" }),
        expect.objectContaining({ label: "Report", status: "Current" }),
      ]),
    );
  });

  it("does not claim fake verification or automation", () => {
    const copy = JSON.stringify(buildErfWorkspaceNextStep(createEmptyErfWorkspaceState()));

    expect(copy).not.toMatch(/verified ownership|verified valuation|verified zoning/i);
    expect(copy).not.toMatch(/pdf extraction|scraping|auto-fill/i);
  });
});
