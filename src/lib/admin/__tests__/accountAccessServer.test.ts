import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { changeFounderAccountAccess, readFounderAccountAccess } from "../accountAccessServer";
import { ApiRequestError } from "@/lib/sitePotential/serverAuth";

const actor = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";
const input = {
  userId: target,
  email: "fixture@example.com",
  action: "suspend",
  reason: "Owner requested access suspension",
};
const request = new Request("http://localhost/api/admin/support");
function fixture() {
  const update = vi
    .fn()
    .mockResolvedValue({
      data: { user: { id: target, banned_until: "2126-01-01T00:00:00Z", secret: "DO_NOT_RETURN" } },
      error: null,
    });
  const rpc = vi
    .fn()
    .mockImplementation(async (name) => ({
      data: name === "founder_begin_account_access" ? "attempt" : null,
      error: null,
    }));
  const serviceSupabase = {
    rpc,
    auth: {
      admin: {
        updateUserById: update,
        getUserById: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: target, email: input.email } }, error: null }),
      },
    },
    from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
  };
  const deps = {
    authenticate: vi.fn().mockResolvedValue({ actor: { id: actor }, serviceSupabase }),
  };
  return { update, rpc, deps, serviceSupabase };
}

describe("reversible Founder account access", () => {
  it("audits before one Auth ban and returns only allowlisted fields", async () => {
    const f = fixture();
    expect(await changeFounderAccountAccess(request, input, f.deps)).toEqual({
      userId: target,
      suspended: true,
    });
    expect(f.update).toHaveBeenCalledExactlyOnceWith(target, { ban_duration: "876000h" });
    expect(f.rpc.mock.invocationCallOrder[0]).toBeLessThan(f.update.mock.invocationCallOrder[0]);
    expect(f.rpc.mock.calls[0]).toEqual([
      "founder_begin_account_access",
      {
        p_actor: actor,
        p_target: target,
        p_email: input.email,
        p_action: "suspend",
        p_reason: input.reason,
      },
    ]);
    expect(f.rpc.mock.calls[1]).toEqual([
      "founder_finish_account_access",
      { p_attempt: "attempt" },
    ]);
  });
  it("restores with the Auth API without deleting users or changing roles", async () => {
    const f = fixture();
    f.update.mockResolvedValue({ data: { user: { id: target, banned_until: null } }, error: null });
    expect(
      await changeFounderAccountAccess(request, { ...input, action: "restore" }, f.deps),
    ).toEqual({ userId: target, suspended: false });
    expect(f.update).toHaveBeenCalledExactlyOnceWith(target, { ban_duration: "none" });
  });
  it("rejects unauthenticated or non-admin actors before mutation", async () => {
    const f = fixture();
    f.deps.authenticate.mockRejectedValue(new ApiRequestError("Forbidden", 403));
    await expect(changeFounderAccountAccess(request, input, f.deps)).rejects.toMatchObject({
      status: 403,
    });
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
  });
  it("blocks self-suspension", async () => {
    const f = fixture();
    await expect(
      changeFounderAccountAccess(request, { ...input, userId: actor }, f.deps),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.update).not.toHaveBeenCalled();
  });
  it("fails closed when the protected/stale/pending audit gate rejects", async () => {
    const f = fixture();
    f.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(changeFounderAccountAccess(request, input, f.deps)).rejects.toMatchObject({
      status: 409,
    });
    expect(f.update).not.toHaveBeenCalled();
  });
  it("does not retry or mark an ambiguous Auth result completed", async () => {
    const f = fixture();
    f.update.mockResolvedValue({ data: { user: null }, error: { message: "timeout" } });
    await expect(changeFounderAccountAccess(request, input, f.deps)).rejects.toMatchObject({
      status: 502,
    });
    expect(f.update).toHaveBeenCalledTimes(1);
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("reports an audit-confirmation failure without claiming no Auth change", async () => {
    const f = fixture();
    f.rpc
      .mockResolvedValueOnce({ data: "attempt", error: null })
      .mockResolvedValueOnce({ error: {} });
    await expect(changeFounderAccountAccess(request, input, f.deps)).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("Auth access changed"),
    });
    expect(f.update).toHaveBeenCalledTimes(1);
  });
  it("requires an explicit valid action and audit reason", async () => {
    for (const invalid of [{ action: "delete" }, { reason: "" }, { userId: "all" }]) {
      const f = fixture();
      await expect(
        changeFounderAccountAccess(request, { ...input, ...invalid }, f.deps),
      ).rejects.toMatchObject({ status: 400 });
      expect(f.deps.authenticate).not.toHaveBeenCalled();
    }
  });
  it("returns a sanitized access projection", async () => {
    const f = fixture();
    expect(await readFounderAccountAccess(request, target, f.deps)).toEqual({
      userId: target,
      email: input.email,
      suspended: false,
      protectedAccount: false,
    });
  });
  it("keeps old-token REST/RPC and Storage guards plus protected-account checks", () => {
    const sql = readFileSync(
      "supabase/migrations/20260913161422_founder_account_access.sql",
      "utf8",
    );
    expect(sql).toContain("pgrst.db_pre_request");
    expect(sql).toContain("Existing pre-request hook must be reviewed");
    expect(sql).toContain("as restrictive for all to authenticated");
    expect(sql).toContain("banned_until > now()");
    expect(sql).toContain("p_actor = p_target");
    expect(sql).toContain("protect_admin_from_suspension");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).not.toMatch(/delete from|drop table|on delete cascade/i);
  });
});
