import { describe, expect, it } from "vitest";
import {
  confirmStoredPlanningZone,
  readStoredPlanningZoneState,
  writeStoredPlanningZone,
} from "@/lib/planning/storedPlanningZone";
import { readErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("stored planning zone", () => {
  it("records the selected zone and user confirmation in the canonical workspace", () => {
    const storage = memoryStorage();

    writeStoredPlanningZone("parcel-1570", "RES1", "user-a", storage);
    expect(readStoredPlanningZoneState("parcel-1570", "user-a", storage)).toEqual({
      zoneCode: "RES1",
      userConfirmedZoneCode: null,
      userConfirmedAt: null,
    });

    const confirmed = confirmStoredPlanningZone("parcel-1570", "user-a", storage);
    expect(confirmed.userConfirmedZoneCode).toBe("RES1");
    expect(confirmed.userConfirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(readErfWorkspaceState("parcel-1570", storage, "user-a").planning).toEqual(confirmed);
  });

  it("clears the confirmation when the user changes the selected working zone", () => {
    const storage = memoryStorage();
    writeStoredPlanningZone("parcel-1570", "RES1", "user-a", storage);
    confirmStoredPlanningZone("parcel-1570", "user-a", storage);

    writeStoredPlanningZone("parcel-1570", "BUS1", "user-a", storage);

    expect(readStoredPlanningZoneState("parcel-1570", "user-a", storage)).toEqual({
      zoneCode: "BUS1",
      userConfirmedZoneCode: null,
      userConfirmedAt: null,
    });
  });

  it("preserves the confirmation when the user selects the already-confirmed zone again", () => {
    const storage = memoryStorage();
    writeStoredPlanningZone("parcel-1570", "RES1", "user-a", storage);
    const confirmed = confirmStoredPlanningZone("parcel-1570", "user-a", storage);

    expect(writeStoredPlanningZone("parcel-1570", "RES1", "user-a", storage)).toEqual(
      confirmed,
    );
    expect(readStoredPlanningZoneState("parcel-1570", "user-a", storage)).toEqual(confirmed);
  });
});
