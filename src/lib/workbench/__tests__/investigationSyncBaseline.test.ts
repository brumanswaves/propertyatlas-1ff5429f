import { describe, expect, it } from "vitest";
import { investigationSyncDecision, preserveInvestigationConflict, readInvestigationSyncBaseline, writeInvestigationSyncBaseline } from "../investigationSyncBaseline";

function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
}

describe("account and parcel scoped investigation synchronization", () => {
  it("retains offline edits when the cloud still matches the acknowledged baseline", () => {
    expect(investigationSyncDecision({ zone: "new" }, { zone: "old" }, { zone: "old" }, true)).toBe("save-local");
  });
  it("hydrates remote edits only when the browser has not changed since acknowledgement", () => {
    expect(investigationSyncDecision({ zone: "old" }, { zone: "new" }, { zone: "old" }, true)).toBe("hydrate");
  });
  it("does not let a newer timestamp overwrite a genuine competing draft", () => {
    expect(investigationSyncDecision({ zone: "local", updatedAt: "2020" }, { zone: "remote", updatedAt: "2030" }, { zone: "base" }, true)).toBe("conflict");
    expect(investigationSyncDecision({ zone: "local" }, { zone: "remote" }, null, true)).toBe("conflict");
  });
  const strategy = (stamp: string, price = "900000") => ({ strategyWorkspace: {
    parcelId: "parcel", activeStrategy: "buy_hold", draftInputs: { purchasePrice: price },
    draftUpdatedAt: stamp, chosenScenarioId: "chosen", chosenScenarioUpdatedAt: stamp,
    scenarios: [{ id: "chosen", inputs: { purchasePrice: price }, savedAt: "2026-01-01", updatedAt: stamp }],
  } });
  it("restores identical Strategy content despite draft, choice and scenario timestamp drift", () => {
    expect(investigationSyncDecision(strategy("2026-01-02"), strategy("2026-01-03"), null, true)).toBe("hydrate");
  });
  it("compares actual edits against the acknowledged Strategy baseline despite timestamp drift", () => {
    expect(investigationSyncDecision(strategy("2026-01-03", "910000"), strategy("2026-01-04"),
      strategy("2026-01-01"), true)).toBe("save-local");
    expect(investigationSyncDecision(strategy("2026-01-03"), strategy("2026-01-04", "920000"),
      strategy("2026-01-01"), true)).toBe("hydrate");
    expect(investigationSyncDecision(strategy("2026-01-03", "910000"), strategy("2026-01-04", "920000"),
      strategy("2026-01-01"), true)).toBe("conflict");
  });
  it("retains Strategy choice, parcel, inputs and scenario content as substantive differences", () => {
    const local = strategy("2026-01-02");
    for (const change of [
      { activeStrategy: "flip" }, { chosenScenarioId: "other" }, { parcelId: "other" },
      { draftInputs: { purchasePrice: "0" } },
      { scenarios: [{ ...local.strategyWorkspace.scenarios[0], inputs: { purchasePrice: "950000" } }] },
    ]) {
      expect(investigationSyncDecision(local, { strategyWorkspace: { ...local.strategyWorkspace, ...change } }, null, true)).toBe("conflict");
    }
  });
  it("does not ignore similarly named timestamps outside the Strategy workspace", () => {
    expect(investigationSyncDecision({ document: { draftUpdatedAt: "a" } },
      { document: { draftUpdatedAt: "b" } }, null, true)).toBe("conflict");
  });
  it("scopes acknowledgements and preserves both conflict versions without replacing old backups", () => {
    const store = storage();
    writeInvestigationSyncBaseline(store, "parcel", "A", { zone: "A" });
    expect(readInvestigationSyncBaseline(store, "parcel", "B")).toBeNull();
    expect(readInvestigationSyncBaseline(store, "other", "A")).toBeNull();
    expect(readInvestigationSyncBaseline(store, "parcel", "A")).toEqual({ zone: "A" });
    preserveInvestigationConflict(store, "parcel", "A", { zone: "local" }, { zone: "cloud" });
    preserveInvestigationConflict(store, "parcel", "A", { zone: "later" }, { zone: "cloud" });
    const backup = [...store.values.entries()].find(([key]) => key.includes("conflict-backups"));
    expect(JSON.parse(backup![1])).toHaveLength(2);
    expect(JSON.parse(backup![1])[0]).toMatchObject({ local: { zone: "local" }, remote: { zone: "cloud" } });
  });
});
