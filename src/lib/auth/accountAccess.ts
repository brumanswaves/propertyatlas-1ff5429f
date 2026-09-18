import type { SupabaseClient } from "@supabase/supabase-js";

type AccountClient = Pick<SupabaseClient, "auth">;

export const PASSWORD_PATH = "/account/password";
export const GOOGLE_ACCOUNT_CHOICE = { prompt: "select_account" } as const;

export async function signOutCurrentSession(client: AccountClient) {
  // Do not revoke another browser's session or remove account-scoped drafts.
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error("Sign-out could not be completed. Check your connection and try again.");
  const { data, error: readError } = await client.auth.getSession();
  if (readError || data.session) throw new Error("Sign-out could not be confirmed. Please try again.");
}

export async function requestPasswordRecovery(client: AccountClient, email: string, origin: string) {
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: new URL(PASSWORD_PATH, origin).href,
  });
  if (error) throw new Error("The reset request could not be sent. Please wait and try again.");
}

export async function verifyPasswordAccount(client: AccountClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Sign in or open a new password reset link to continue.");
  return data.user;
}

export async function saveAccountPassword(client: AccountClient, expectedUserId: string, password: string, signal?: AbortSignal) {
  if (password.length < 12) throw new Error("Use at least 12 characters.");
  let invalidated = false;
  const { data: listener } = client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || session?.user.id !== expectedUserId) invalidated = true;
  });
  const assertCurrent = () => {
    if (invalidated || signal?.aborted) throw new Error("The signed-in account changed. Open Account again.");
  };
  try {
    const { data, error } = await client.auth.getSession();
    assertCurrent();
    const session = data.session;
    if (error || !session || session.user.id !== expectedUserId) throw new Error("The signed-in account changed. Open Account again.");
    const credential = session.access_token;
    const verified = await client.auth.getUser(credential);
    assertCurrent();
    if (verified.error || verified.data.user?.id !== expectedUserId) throw new Error("Sign in or open a new password reset link to continue.");
    const current = await client.auth.getSession();
    assertCurrent();
    if (current.error || current.data.session?.user.id !== expectedUserId) throw new Error("The signed-in account changed. Open Account again.");

    const url = import.meta.env.VITE_SUPABASE_URL;
    const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !publicKey) throw new Error("Password service is unavailable. Please try again later.");
    // updateUser re-reads shared auth and writes its response into shared storage.
    // Use the same verified bearer for this one request, without touching session state.
    let response: Response;
    try {
      response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
        method: "PUT", credentials: "omit", redirect: "error",
        headers: { apikey: publicKey, Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch {
      throw new Error("The password change could not be confirmed. Check your account before trying again.");
    }
    if (!response.ok) throw new Error("Your password could not be saved. Sign in again or request a new reset link.");
    const updated = await response.json().catch(() => null);
    if (updated?.id !== expectedUserId) throw new Error("The password change could not be confirmed. Check your account before trying again.");
    assertCurrent();
  } finally {
    listener.subscription.unsubscribe();
  }
}
