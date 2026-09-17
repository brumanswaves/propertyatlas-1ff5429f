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

export async function saveAccountPassword(client: AccountClient, expectedUserId: string, password: string) {
  if (password.length < 12) throw new Error("Use at least 12 characters.");
  const user = await verifyPasswordAccount(client);
  if (user.id !== expectedUserId) throw new Error("The signed-in account changed. Open Account again.");
  const { error } = await client.auth.updateUser({ password });
  if (error) throw new Error("Your password could not be saved. Sign in again or request a new reset link.");
}
