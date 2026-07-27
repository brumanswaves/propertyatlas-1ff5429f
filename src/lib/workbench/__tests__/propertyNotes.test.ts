import { describe, expect, it } from "vitest";
import { loadReportPropertyNotes } from "../propertyNotes";

function clientReturning(data: Record<string, unknown> | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data, error: null }),
          }),
        }),
      }),
    }),
  } as never;
}

describe("loadReportPropertyNotes", () => {
  it("returns no account notes for signed-out reports", async () => {
    await expect(loadReportPropertyNotes("parcel-a", null, () => true, clientReturning(null))).resolves.toEqual({
      status: "signed_out",
      notes: null,
    });
  });

  it("loads notes for the active parcel and user", async () => {
    const result = await loadReportPropertyNotes(
      "parcel-a",
      "user-a",
      () => true,
      clientReturning({
        parcel_id: "parcel-a",
        personal: "Inspect access road",
        questions: "Confirm zoning",
        checklist: { visited: true },
      }),
    );

    expect(result).toMatchObject({
      status: "loaded",
      notes: {
        parcelId: "parcel-a",
        personal: "Inspect access road",
      },
    });
  });

  it("ignores stale user or parcel responses", async () => {
    const result = await loadReportPropertyNotes(
      "parcel-a",
      "user-a",
      () => false,
      clientReturning({ parcel_id: "parcel-a", personal: "Old parcel notes" }),
    );

    expect(result).toEqual({ status: "stale", notes: null });
  });

  it("does not pass parcel A notes into parcel B reports", async () => {
    const result = await loadReportPropertyNotes(
      "parcel-b",
      "user-a",
      () => true,
      clientReturning({ parcel_id: "parcel-a", personal: "Wrong parcel notes" }),
    );

    expect(result).toEqual({ status: "loaded", notes: null });
  });

  it("does not block the report when loading notes fails", async () => {
    const failingClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: new Error("network") }),
            }),
          }),
        }),
      }),
    } as never;

    const result = await loadReportPropertyNotes("parcel-a", "user-a", () => true, failingClient);

    expect(result.status).toBe("failed");
    expect(result.notes).toBeNull();
  });
});
