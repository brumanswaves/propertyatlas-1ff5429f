import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GOOGLE_ACCOUNT_CHOICE, requestPasswordRecovery, saveAccountPassword, signOutCurrentSession, verifyPasswordAccount } from "../accountAccess";

function fixture() {
  let listener: (event: string, session: { user: { id: string } } | null) => void = () => {};
  const session = { user: { id: "google-owner" }, access_token: "synthetic-owner-credential" };
  const unsubscribe = vi.fn();
  const request = vi.fn().mockResolvedValue(Response.json({ id: "google-owner" }));
  vi.stubGlobal("fetch", request);
  vi.stubEnv("VITE_SUPABASE_URL", "https://fixture.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "synthetic-public-key");
  const auth = {
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "google-owner", email: "owner@example.invalid" } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockImplementation(callback => {
      listener = callback;
      return { data: { subscription: { unsubscribe } } };
    }),
  };
  return { auth, request, unsubscribe, emit: (id: string | null) => listener(id ? "SIGNED_IN" : "SIGNED_OUT", id ? { user: { id } } : null), client: { auth } as unknown as SupabaseClient };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("account access repair", () => {
  it("awaits current-session sign-out and verifies removal without signing out other browsers", async () => {
    const f = fixture();
    f.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
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
    expect(f.auth.getUser).toHaveBeenCalledExactlyOnceWith("synthetic-owner-credential");
    expect(f.request).toHaveBeenCalledExactlyOnceWith("https://fixture.supabase.co/auth/v1/user", {
      method: "PUT", credentials: "omit", redirect: "error",
      headers: { apikey: "synthetic-public-key", Authorization: "Bearer synthetic-owner-credential", "Content-Type": "application/json" },
      body: JSON.stringify({ password: "synthetic-long-password" }),
    });
    expect(f.auth.updateUser).not.toHaveBeenCalled();
    expect(f.unsubscribe).toHaveBeenCalledOnce();
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
    f.request.mockResolvedValue(new Response(null, { status: 422 }));
    await expect(saveAccountPassword(f.client, "google-owner", "synthetic-long-password")).rejects.toThrow("could not be saved");
    expect(f.request).toHaveBeenCalledTimes(1);
  });
  it.each(["other", null])("invalidates delayed verification after switch/logout to %s", async id => {
    const f = fixture();
    let release!: (value: unknown) => void;
    f.auth.getUser.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const result = saveAccountPassword(f.client, "google-owner", "synthetic-long-password");
    const rejected = expect(result).rejects.toThrow("account changed");
    await vi.waitFor(() => expect(f.auth.getUser).toHaveBeenCalled());
    f.emit(id);
    release({ data: { user: { id: "google-owner" } }, error: null });
    await rejected;
    expect(f.request).not.toHaveBeenCalled();
    expect(f.unsubscribe).toHaveBeenCalledOnce();
  });
  it("does not retarget a dispatched request or mutate shared session state", async () => {
    const f = fixture();
    let release!: (response: Response) => void;
    f.request.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const result = saveAccountPassword(f.client, "google-owner", "synthetic-long-password");
    const rejected = expect(result).rejects.toThrow("account changed");
    await vi.waitFor(() => expect(f.request).toHaveBeenCalled());
    f.emit("other");
    release(Response.json({ id: "google-owner" }));
    await rejected;
    expect(f.request.mock.calls[0][1].headers.Authorization).toBe("Bearer synthetic-owner-credential");
    expect(f.request).toHaveBeenCalledOnce();
    expect(f.auth.updateUser).not.toHaveBeenCalled();
  });
  it("does not retry an ambiguous write or claim the password was saved", async () => {
    const f = fixture();
    f.request.mockRejectedValue(new Error("private transport detail"));
    await expect(saveAccountPassword(f.client, "google-owner", "synthetic-long-password")).rejects.toThrow("could not be confirmed");
    expect(f.request).toHaveBeenCalledOnce();
  });
});
