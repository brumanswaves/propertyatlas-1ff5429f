import { describe, expect, it } from "vitest";
import { persistSavedProperty } from "../savedPropertyPersistence";

describe("saved property persistence", () => {
  it("upserts an existing property without duplicating it and preserves unrelated user data", async () => {
    const rows = new Map<string, { userData: Record<string, unknown>; externalLinks: unknown }>();
    const key = "user-1:parcel-1570";
    rows.set(key, {
      userData: { strategyWorkspace: { chosenScenarioId: "scenario-1" } },
      externalLinks: [{ label: "Existing official source" }],
    });

    const save = () =>
      persistSavedProperty({
        userId: "user-1",
        parcelId: "parcel-1570",
        userData: { normalizedParcelId: "parcel-1570", displayTitle: "Erf 1570" },
        externalLinks: [{ label: "CSG Viewer" }],
        readExisting: async () => rows.get(key) ?? null,
        write: async (record) => {
          rows.set(`${record.userId}:${record.parcelId}`, {
            userData: record.userData,
            externalLinks: record.externalLinks,
          });
        },
      });

    await save();
    await save();

    expect(rows.size).toBe(1);
    expect(rows.get(key)).toEqual({
      userData: {
        strategyWorkspace: { chosenScenarioId: "scenario-1" },
        normalizedParcelId: "parcel-1570",
        displayTitle: "Erf 1570",
      },
      externalLinks: [{ label: "Existing official source" }],
    });
  });

  it("creates a new saved property record when none exists", async () => {
    const writes: Array<{ userId: string; parcelId: string }> = [];

    await persistSavedProperty({
      userId: "user-1",
      parcelId: "parcel-new",
      userData: { normalizedParcelId: "parcel-new" },
      externalLinks: [{ label: "CSG Viewer" }],
      readExisting: async () => null,
      write: async (record) => {
        writes.push(record);
      },
    });

    expect(writes).toEqual([
      expect.objectContaining({ userId: "user-1", parcelId: "parcel-new" }),
    ]);
  });
});
