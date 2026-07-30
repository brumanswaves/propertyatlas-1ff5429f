import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readLocalVendorAssignments,
  readLocalVendorDirectory,
  writeLocalVendorAssignments,
  writeLocalVendorDirectory,
} from "../vendorStore";
import { assignVendorToParcel, createVendorRecord } from "../vendorRecords";

function stubStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
  vi.stubGlobal("window", { localStorage });
  return { store, localStorage };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signed-out vendor persistence fallback (localStorage)", () => {
  it("round-trips the vendor directory through localStorage", () => {
    stubStorage();
    const vendor = createVendorRecord({ name: "Local Jane", role: "builder" });
    writeLocalVendorDirectory([vendor]);
    const restored = readLocalVendorDirectory();
    expect(restored).toEqual([vendor]);
  });

  it("round-trips property assignments through localStorage, scoped per parcel", () => {
    stubStorage();
    const vendor = createVendorRecord({ name: "Local Jane", role: "builder" });
    const { assignments } = assignVendorToParcel([], vendor.id, "parcel-1", {
      roleOnProperty: "builder",
    });
    writeLocalVendorAssignments("parcel-1", assignments);
    writeLocalVendorAssignments("parcel-2", []);

    expect(readLocalVendorAssignments("parcel-1")).toEqual(assignments);
    expect(readLocalVendorAssignments("parcel-2")).toEqual([]);
  });

  it("returns an empty list gracefully when nothing is stored yet", () => {
    stubStorage();
    expect(readLocalVendorDirectory()).toEqual([]);
    expect(readLocalVendorAssignments("parcel-1")).toEqual([]);
  });
});
