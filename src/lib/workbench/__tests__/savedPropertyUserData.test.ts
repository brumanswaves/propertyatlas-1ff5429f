import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import {
  mergeSavedPropertyUserDataPatch,
  patchSavedPropertyUserData,
} from "../savedPropertyUserData";

describe("saved property user_data patching", () => {
  it("merges top-level namespaces without dropping unrelated data", () => {
    expect(
      mergeSavedPropertyUserDataPatch(
        {
          manualResearch: { zoningNote: "Check" },
          strategyWorkspace: { draftInputs: { purchasePrice: "1200000" } },
        },
        { savedMarketEvidence: [{ id: "comp-1" }] },
      ),
    ).toEqual({
      manualResearch: { zoningNote: "Check" },
      strategyWorkspace: { draftInputs: { purchasePrice: "1200000" } },
      savedMarketEvidence: [{ id: "comp-1" }],
    });
  });

  it("calls the narrow Supabase RPC without accepting a browser supplied user_id", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        strategyWorkspace: { draftUpdatedAt: "2026-07-20T18:00:00.000Z" },
        manualResearch: { ratesNote: "Loaded" },
      },
      error: null,
    });

    const result = await patchSavedPropertyUserData(
      "parcel-123",
      {
        strategyWorkspace: { draftUpdatedAt: "2026-07-20T18:00:00.000Z" },
        strategyWorkspaceUpdatedAt: "2026-07-20T18:00:00.000Z",
      },
      { rpc } as never,
    );

    expect(rpc).toHaveBeenCalledWith("patch_saved_property_user_data", {
      p_parcel_id: "parcel-123",
      p_user_data_patch: {
        strategyWorkspace: { draftUpdatedAt: "2026-07-20T18:00:00.000Z" },
        strategyWorkspaceUpdatedAt: "2026-07-20T18:00:00.000Z",
      },
    });
    expect(JSON.stringify(rpc.mock.calls[0][1])).not.toContain("user_id");
    expect(result.manualResearch).toEqual({ ratesNote: "Loaded" });
  });

  it("surfaces RPC errors for retry UX", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("network unavailable"),
    });

    await expect(
      patchSavedPropertyUserData("parcel-123", { strategyWorkspace: {} }, { rpc } as never),
    ).rejects.toThrow("network unavailable");
  });

  it("keeps the database RPC constrained to authenticated parcel-scoped patches", () => {
    const migration = readFileSync(
      "supabase/migrations/20260720193000_patch_saved_property_user_data.sql",
      "utf8",
    );

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.patch_saved_property_user_data");
    expect(migration).toContain("v_user_id uuid := auth.uid()");
    expect(migration).toContain("ON CONFLICT (user_id, parcel_id) DO NOTHING");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("v_merged := v_existing || v_patch");
    expect(migration).toContain("v_patch := v_patch - 'strategyWorkspace'");
    expect(migration).toContain("GRANT EXECUTE");
  });
});
