import { describe, expect, it } from "vitest";
import {
  buildErfWorkspaceNextStep,
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
      title: "Verify the official parcel identity first.",
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
      title: "Resolve official parcel identity before using market or strategy tools.",
      tab: "research",
    });
  });

  it("moves checked identity to market evidence, calculators, then reports", () => {
    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "looks_correct",
      }),
    ).toMatchObject({ title: "Build market evidence next.", tab: "listings" });

    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "checked",
        marketEvidenceStarted: true,
      }),
    ).toMatchObject({ title: "Run Strategy Lab calculators next.", tab: "calculators" });

    expect(
      buildErfWorkspaceNextStep({
        ...createEmptyErfWorkspaceState(),
        identityStatus: "checked",
        marketEvidenceStarted: true,
        calculatorStarted: true,
      }),
    ).toMatchObject({ title: "Create Stoep Report next.", tab: "reports" });
  });

  it("does not claim fake verification or automation", () => {
    const copy = JSON.stringify(buildErfWorkspaceNextStep(createEmptyErfWorkspaceState()));

    expect(copy).not.toMatch(/verified ownership|verified valuation|verified zoning/i);
    expect(copy).not.toMatch(/pdf extraction|scraping|auto-fill/i);
  });
});
