import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { GOOGLE_ACCOUNT_CHOICE, requestPasswordRecovery, saveAccountPassword, signOutCurrentSession, verifyPasswordAccount } from "../accountAccess";

function fixture() {
  const auth = {
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "google-owner", email: "owner@example.invalid" } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
  };
  return { auth, client: { auth } as unknown as SupabaseClient };
}

describe("account access repair", () => {
  it("awaits current-session sign-out and verifies removal without signing out other browsers", async () => {
    const f = fixture();
    await signOutCurrentSession(f.client);
    expect(f.auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(f.auth.getSession).toHaveBeenCalledTimes(1);
  });
  it("does not claim sign-out after a provider failure or retained session", async () => {
    const f = fixture();
    f.auth.signOut.mockResolvedValueOnce({ error: new Error("private provider details") });
    await expect(signOutCurrentSession(f.client)).rejects.toThrow("could not be completed");
    f.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: "owner" } } }, error: null });
    await expect(signOutCurrentSession(f.client)).rejects.toThrow("could not be confirmed");
  });
  it("requests Google account choice through both existing transports", () => {
    expect(GOOGLE_ACCOUNT_CHOICE).toEqual({ prompt: "select_account" });
    const source = readFileSync("src/routes/auth.tsx", "utf8");
    expect(source).toContain("queryParams: GOOGLE_ACCOUNT_CHOICE");
    expect(source).toContain("extraParams: GOOGLE_ACCOUNT_CHOICE");
  });
  it("sends a recovery link to the dedicated same-origin route, never creates an account", async () => {
    const f = fixture();
    await requestPasswordRecovery(f.client, " owner@example.invalid ", "https://easyerf.co.za");
    expect(f.auth.resetPasswordForEmail).toHaveBeenCalledExactlyOnceWith("owner@example.invalid", {
      redirectTo: "https://easyerf.co.za/account/password",
    });
    expect(f.auth.updateUser).not.toHaveBeenCalled();
  });
  it("surfaces recovery transport failure without disclosing provider details", async () => {
    const f = fixture();
    f.auth.resetPasswordForEmail.mockResolvedValue({ error: new Error("private details") });
    await expect(requestPasswordRecovery(f.client, "owner@example.invalid", "https://easyerf.co.za")).rejects.toThrow("could not be sent");
  });
  it("adds a password to the verified existing OAuth identity without changing roles or email", async () => {
    const f = fixture();
    await saveAccountPassword(f.client, "google-owner", "synthetic-long-password");
    expect(f.auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password: "synthetic-long-password" });
  });
  it("rejects expired, missing and changed accounts before updating a password", async () => {
    const f = fixture();
    f.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("expired") });
    await expect(verifyPasswordAccount(f.client)).rejects.toThrow("Sign in");
    await expect(saveAccountPassword(f.client, "different-account", "synthetic-long-password")).rejects.toThrow("account changed");
    expect(f.auth.updateUser).not.toHaveBeenCalled();
  });
  it("preserves server password policy and reports a rejected save without retry", async () => {
    const f = fixture();
    await expect(saveAccountPassword(f.client, "google-owner", "short")).rejects.toThrow("12 characters");
    expect(f.auth.updateUser).not.toHaveBeenCalled();
    f.auth.updateUser.mockResolvedValue({ error: new Error("reauthentication needed") });
    await expect(saveAccountPassword(f.client, "google-owner", "synthetic-long-password")).rejects.toThrow("could not be saved");
    expect(f.auth.updateUser).toHaveBeenCalledTimes(1);
  });
});
