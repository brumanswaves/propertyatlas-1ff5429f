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
