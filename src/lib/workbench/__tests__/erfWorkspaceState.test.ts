import { describe, expect, it } from "vitest";
import {
  buildErfWorkspaceNextStep,
  buildStoepStepProgress,
  createEmptyErfWorkspaceState,
  erfWorkspaceStateKey,
  getChosenStrategyScenario,
  readErfWorkspaceState,
  saveStrategyScenario,
  updateErfWorkspaceState,
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

  it("saves the newest Strategy Lab scenario as the chosen scenario", () => {
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
    expect(readErfWorkspaceState(parcelId, storage)).toMatchObject({
      calculatorStarted: true,
      strategyScenarioCount: 2,
      chosenScenarioId: second.scenario.id,
    });
    expect(getChosenStrategyScenario(parcelId, storage)).toMatchObject({
      id: second.scenario.id,
      label: "Development to rent scenario",
      selected: true,
    });
    expect(second.scenarios.find((scenario) => scenario.id === first.scenario.id)?.selected).toBe(
      false,
    );
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
