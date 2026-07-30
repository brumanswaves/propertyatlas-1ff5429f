import { describe, expect, it } from "vitest";
import {
  assignVendorToParcel,
  coerceAssignmentList,
  coerceVendorDirectory,
  createVendorRecord,
  deleteVendorFromDirectory,
  markAssignmentSelected,
  recordQuote,
  removeAssignment,
  updateAssignment,
  upsertVendorInDirectory,
} from "../vendorRecords";
import { printSafeVendorSummaries } from "../vendorProgress";
import type { ManualVendorInput, Vendor, VendorAssignment } from "../types";

const MANUAL_INPUT: ManualVendorInput = {
  name: "Jane Builder",
  company: "Jane Co",
  role: "builder",
  phone: "0821234567",
  email: "jane@example.com",
  website: "https://jane.example.com",
  serviceArea: "Cape Town",
  source: "Manually added",
  notes: "Reliable",
};

describe("vendor directory", () => {
  it("saves a manually added vendor into the directory", () => {
    const { directory, vendor } = upsertVendorInDirectory([], MANUAL_INPUT);
    expect(directory).toHaveLength(1);
    expect(vendor.name).toBe("Jane Builder");
    expect(vendor.id).toMatch(/^vendor_/);
  });

  it("does not duplicate a vendor saved twice from the same Google place result", () => {
    const input = { ...MANUAL_INPUT, source: "Google search", originPlaceId: "place-1" };
    const first = upsertVendorInDirectory([], input);
    const second = upsertVendorInDirectory(first.directory, input);
    expect(second.directory).toHaveLength(1);
    expect(second.vendor.id).toBe(first.vendor.id);
  });

  it("removes a vendor from the directory on delete", () => {
    const { directory, vendor } = upsertVendorInDirectory([], MANUAL_INPUT);
    const next = deleteVendorFromDirectory(directory, vendor.id);
    expect(next).toHaveLength(0);
  });
});

describe("vendor assignments", () => {
  it("assigns a saved vendor to a parcel", () => {
    const vendor = createVendorRecord(MANUAL_INPUT);
    const { assignments, assignment } = assignVendorToParcel([], vendor.id, "parcel-1", {
      roleOnProperty: "builder",
      status: "considering",
    });
    expect(assignments).toHaveLength(1);
    expect(assignment.vendorId).toBe(vendor.id);
    expect(assignment.parcelId).toBe("parcel-1");
  });

  it("reuses the same vendor record across two different parcels without duplicating it", () => {
    const { directory, vendor } = upsertVendorInDirectory([], MANUAL_INPUT);
    expect(directory).toHaveLength(1);

    const first = assignVendorToParcel([], vendor.id, "parcel-1", { roleOnProperty: "builder" });
    const second = assignVendorToParcel(first.assignments, vendor.id, "parcel-2", {
      roleOnProperty: "builder",
    });

    expect(second.assignments).toHaveLength(2);
    expect(new Set(second.assignments.map((a) => a.vendorId)).size).toBe(1);
    expect(directory).toHaveLength(1);
  });

  it("updates assignment status", () => {
    const vendor = createVendorRecord(MANUAL_INPUT);
    const { assignments, assignment } = assignVendorToParcel([], vendor.id, "parcel-1", {
      roleOnProperty: "builder",
    });
    const updated = updateAssignment(assignments, assignment.id, { status: "contacted" });
    expect(updated[0].status).toBe("contacted");
  });

  it("records a quote and advances status to quote_received", () => {
    const vendor = createVendorRecord(MANUAL_INPUT);
    const { assignments, assignment } = assignVendorToParcel([], vendor.id, "parcel-1", {
      roleOnProperty: "builder",
    });
    const updated = recordQuote(assignments, assignment.id, {
      quoteAmount: 15000,
      quoteDate: "2026-01-01",
      quoteNotes: "Includes materials",
    });
    expect(updated[0].status).toBe("quote_received");
    expect(updated[0].quoteAmount).toBe(15000);
    expect(updated[0].quoteNotes).toBe("Includes materials");
  });

  it("marks an assignment as selected", () => {
    const vendor = createVendorRecord(MANUAL_INPUT);
    const { assignments, assignment } = assignVendorToParcel([], vendor.id, "parcel-1", {
      roleOnProperty: "builder",
    });
    const updated = markAssignmentSelected(assignments, assignment.id);
    expect(updated[0].status).toBe("selected");
  });

  it("removes the assignment from the property without deleting the saved vendor", () => {
    const { directory, vendor } = upsertVendorInDirectory([], MANUAL_INPUT);
    const { assignments, assignment } = assignVendorToParcel([], vendor.id, "parcel-1", {
      roleOnProperty: "builder",
    });
    const remaining = removeAssignment(assignments, assignment.id);
    expect(remaining).toHaveLength(0);
    expect(directory).toHaveLength(1);
    expect(directory[0].id).toBe(vendor.id);
  });
});

describe("print-safe vendor summaries", () => {
  it("excludes phone and email from the print-safe summary", () => {
    const { directory, vendor } = upsertVendorInDirectory([], MANUAL_INPUT);
    const { assignments } = assignVendorToParcel([], vendor.id, "parcel-1", {
      roleOnProperty: "builder",
      status: "selected",
      quoteAmount: 20000,
    });
    const summaries = printSafeVendorSummaries(directory, assignments);
    expect(summaries).toHaveLength(1);
    const summary = summaries[0] as unknown as Record<string, unknown>;
    expect(summary).not.toHaveProperty("phone");
    expect(summary).not.toHaveProperty("email");
    expect(JSON.stringify(summary)).not.toContain(MANUAL_INPUT.phone);
    expect(JSON.stringify(summary)).not.toContain(MANUAL_INPUT.email);
    expect(summary.name).toBe("Jane Builder");
    expect(summary.status).toBe("selected");
  });
});

describe("persistence coercion", () => {
  it("round-trips a vendor directory and assignment list through JSON (localStorage shape)", () => {
    const vendor = createVendorRecord(MANUAL_INPUT);
    const assignment: VendorAssignment = assignVendorToParcel([], vendor.id, "parcel-1", {
      roleOnProperty: "builder",
    }).assignments[0];

    const serializedVendors = JSON.stringify([vendor]);
    const serializedAssignments = JSON.stringify([assignment]);

    const restoredVendors = coerceVendorDirectory(JSON.parse(serializedVendors));
    const restoredAssignments = coerceAssignmentList(JSON.parse(serializedAssignments), "parcel-1");

    expect(restoredVendors).toEqual([vendor]);
    expect(restoredAssignments).toEqual([assignment]);
  });

  it("drops malformed entries defensively when coercing persisted data", () => {
    const restored = coerceVendorDirectory([{ name: "No id" }, null, { id: "v1", name: "Ok" }]);
    expect(restored).toHaveLength(1);
    expect(restored[0].name).toBe("Ok");
  });
});
