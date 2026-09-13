import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type InviteClient = Pick<SupabaseClient<Database>, "auth" | "from">;

// Auth verifies the session; the URL and user-editable metadata grant no roles.
export async function verifyInvestigatorInvite(client: InviteClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.invited_at) {
    throw new Error("This invitation is missing or expired. Ask your founder for help.");
  }
  const { data: roles, error: roleError } = await client.from("user_roles")
    .select("role").eq("user_id", data.user.id);
  if (roleError || !roles?.some((row) => row.role === "moderator")
      || roles.some((row) => row.role === "admin")) {
    throw new Error("Investigator access is not available for this account. Contact your founder.");
  }
  return data.user;
}

export async function setInvestigatorPassword(client: InviteClient, expectedUserId: string, password: string) {
  if (password.length < 12) throw new Error("Use at least 12 characters.");
  const user = await verifyInvestigatorInvite(client);
  if (user.id !== expectedUserId) throw new Error("The signed-in account changed. Open your invitation again.");
  const { error } = await client.auth.updateUser({ password });
  if (error) throw new Error("Your password could not be saved. Your session may have expired. Open your invitation again or contact your founder.");
}
