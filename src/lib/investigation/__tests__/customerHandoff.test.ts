import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";

const fixture = vi.hoisted(() => ({
  owner: "owner-a" as string | null,
  read: vi.fn(),
  patch: vi.fn(),
  flush: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: fixture.owner ? { user: { id: fixture.owner } } : null },
      }),
    },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: fixture.read }) }) }) }),
  },
}));
vi.mock("@/lib/workbench/savedPropertyUserData", () => ({
  isSavedPropertyUserData: (value: unknown) => value !== null && typeof value === "object",
  patchSavedPropertyUserData: fixture.patch,
}));
vi.mock("@/lib/workbench/savedInvestigationProjection", async (original) => ({
  ...(await original<typeof import("@/lib/workbench/savedInvestigationProjection")>()),
  flushSavedInvestigation: fixture.flush,
}));
import { prepareCustomerInvestigation } from "../investigationClient";

const parcel = { id: "csg:lpi:synthetic42" } as NormalizedOfficialParcel;
beforeEach(() => {
  vi.clearAllMocks();
  fixture.owner = "owner-a";
  fixture.read.mockResolvedValue({
    data: { user_data: { existingEvidence: "preserve" } },
    error: null,
  });
  fixture.patch.mockResolvedValue({ existingEvidence: "preserve" });
  fixture.flush.mockResolvedValue(undefined);
});

describe("customer handoff account continuity", () => {
  it("waits for the saved investigation before allowing the handoff", async () => {
    await expect(prepareCustomerInvestigation("owner-a", parcel, null)).resolves.toBeUndefined();
    expect(fixture.patch.mock.calls[0][3]).toEqual({ existingEvidence: "preserve" });
    expect(fixture.flush).toHaveBeenCalledWith(parcel.id, "owner-a", undefined);
  });
  it.each(["owner-b", null])(
    "rejects an account change during the final save (%s)",
    async (owner) => {
      fixture.flush.mockImplementationOnce(async () => {
        fixture.owner = owner;
      });
      await expect(prepareCustomerInvestigation("owner-a", parcel, null)).rejects.toThrow(
        "active account changed",
      );
    },
  );
  it("rejects before saving when the initial account is different", async () => {
    fixture.owner = "owner-b";
    await expect(prepareCustomerInvestigation("owner-a", parcel, null)).rejects.toThrow(
      "active account changed",
    );
    expect(fixture.read).not.toHaveBeenCalled();
    expect(fixture.patch).not.toHaveBeenCalled();
  });
  it("retains a save failure instead of allowing navigation", async () => {
    fixture.flush.mockRejectedValueOnce(new Error("Evidence changed; reload before continuing."));
    await expect(prepareCustomerInvestigation("owner-a", parcel, null)).rejects.toThrow(
      "Evidence changed",
    );
  });
});
