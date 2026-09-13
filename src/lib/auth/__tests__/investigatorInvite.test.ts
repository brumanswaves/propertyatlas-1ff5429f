import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { setInvestigatorPassword, verifyInvestigatorInvite } from "../investigatorInvite";

function fixture(roles = ["moderator"], invited = true) {
  const updateUser = vi.fn().mockResolvedValue({ error: null });
  const getUser = vi.fn().mockResolvedValue({
    data: { user: { id: "worker", email: "worker@example.invalid", invited_at: invited ? "2026-09-13" : null } },
    error: null,
  });
  const client = {
    auth: { getUser, updateUser },
    from: vi.fn(() => ({ select: () => ({ eq: vi.fn().mockResolvedValue({ data: roles.map(role => ({ role })), error: null }) }) })),
  };
  return { client: client as unknown as SupabaseClient<Database>, getUser, updateUser };
}
describe("investigator invitation acceptance", () => {
  it("verifies the invited identity and saves only its password, never roles", async () => {
    const f = fixture();
    expect(await verifyInvestigatorInvite(f.client)).toMatchObject({ id: "worker" });
    await setInvestigatorPassword(f.client, "worker", "synthetic-password");
    expect(f.updateUser).toHaveBeenCalledExactlyOnceWith({ password: "synthetic-password" });
  });
  it.each([["user"], ["admin"], ["moderator", "admin"]])("rejects non-investigator/admin role set %j", async (...roles) => {
    const f = fixture(roles);
    await expect(setInvestigatorPassword(f.client, "worker", "synthetic-password")).rejects.toThrow("not available");
    expect(f.updateUser).not.toHaveBeenCalled();
  });
  it("rejects expired authentication", async () => {
    const f = fixture(); f.getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    await expect(verifyInvestigatorInvite(f.client)).rejects.toThrow("expired");
    expect(f.updateUser).not.toHaveBeenCalled();
  });
  it("rejects a non-invited account", async () => {
    await expect(verifyInvestigatorInvite(fixture(["moderator"], false).client)).rejects.toThrow("missing or expired");
  });
  it("does not update a different account after a session switch", async () => {
    const f = fixture();
    await expect(setInvestigatorPassword(f.client, "other-worker", "synthetic-password")).rejects.toThrow("account changed");
    expect(f.updateUser).not.toHaveBeenCalled();
  });
  it("surfaces password save failure and does not retry", async () => {
    const f = fixture(); f.updateUser.mockResolvedValue({ error: new Error("expired") });
    await expect(setInvestigatorPassword(f.client, "worker", "synthetic-password")).rejects.toThrow("could not be saved");
    expect(f.updateUser).toHaveBeenCalledTimes(1);
  });
});
