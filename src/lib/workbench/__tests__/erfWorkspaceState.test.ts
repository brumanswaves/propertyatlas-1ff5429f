import { describe, expect, it } from "vitest";
import {
  buildErfWorkspaceNextStep,
  buildStoepStepProgress,
  createEmptyErfWorkspaceState,
  erfWorkspaceStateKey,
  readErfWorkspaceState,
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

  it("moves checked identity through reviewed sources, market evidence, saved scenarios, then reports", () => {
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
    ).toMatchObject({ title: "Create Stoep Report", tab: "stoep-report" });
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
        marketAddressSaved: true,
      }),
    ).toMatchObject({ title: "Run Strategy Lab calculators", tab: "calculators" });
  });

  it("builds honest StoepSteps progress from workspace state", () => {
    expect(buildStoepStepProgress(createEmptyErfWorkspaceState())).toMatchObject([
      { label: "Identity", status: "Current" },
      { label: "Sources", status: "Needs evidence" },
      { label: "Market", status: "Not started" },
      { label: "Strategy", status: "Not started" },
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
