import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AccountPreferences = Record<
  "first_name" | "last_name" | "display_name" | "full_name" | "phone" | "profile_type" | "default_market",
  string
>;

// Keep this request bound to its original account. The shared SDK updateUser
// re-reads session state and persists its response into shared auth storage.
export async function saveAccountPreferences(
  client: Pick<SupabaseClient, "auth">,
  expectedUserId: string,
  preferences: AccountPreferences,
  signal?: AbortSignal,
): Promise<User> {
  let invalidated = false;
  const { data: listener } = client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || session?.user.id !== expectedUserId) invalidated = true;
  });
  const assertCurrent = () => {
    if (invalidated || signal?.aborted) throw new Error("Your signed-in account changed. Reopen Account before saving.");
  };
  try {
    const { data, error } = await client.auth.getSession();
    assertCurrent();
    if (error || data.session?.user.id !== expectedUserId) throw new Error("Your signed-in account changed. Reopen Account before saving.");
    const credential = data.session.access_token;
    const verified = await client.auth.getUser(credential);
    assertCurrent();
    if (verified.error || verified.data.user?.id !== expectedUserId) throw new Error("Sign in again before saving your account.");
    const current = await client.auth.getSession();
    assertCurrent();
    if (current.error || current.data.session?.user.id !== expectedUserId) throw new Error("Your signed-in account changed. Reopen Account before saving.");
    const url = import.meta.env.VITE_SUPABASE_URL;
    const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !publicKey) throw new Error("Account service is unavailable. Your edits are still here.");
    // Send only editable preferences. Auth merges these keys; do not replay a
    // stale copy of unrelated metadata, email, password or role information.
    const dataPatch = Object.fromEntries([
      "first_name", "last_name", "display_name", "full_name", "phone", "profile_type", "default_market",
    ].map((key) => [key, preferences[key as keyof AccountPreferences]]));
    let response: Response;
    try {
      response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
        method: "PUT", credentials: "omit", redirect: "error",
        headers: { apikey: publicKey, Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: dataPatch }),
      });
    } catch {
      throw new Error("The save could not be confirmed. Reopen Account to check before trying again.");
    }
    if (!response.ok) throw new Error("Your account could not be saved. Your edits are still here.");
    const updated = await response.json().catch(() => null);
    assertCurrent();
    if (updated?.id !== expectedUserId) throw new Error("The save could not be confirmed. Reopen Account to check before trying again.");
    return updated as User;
  } finally {
    listener.subscription.unsubscribe();
  }
}
