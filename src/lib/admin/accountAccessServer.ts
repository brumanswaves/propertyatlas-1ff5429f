import type { User } from "@supabase/supabase-js";
import { ApiRequestError } from "@/lib/sitePotential/serverAuth";
import { authenticateFounderSupportRequest } from "./founderSupportServer";

type Dependencies = { authenticate: typeof authenticateFounderSupportRequest };
const dependencies: Dependencies = { authenticate: authenticateFounderSupportRequest };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function accountIsSuspended(user: User) {
  const until = (user as User & { banned_until?: string }).banned_until;
  return Boolean(until && Date.parse(until) > Date.now());
}

export async function readFounderAccountAccess(
  request: Request,
  userId: string,
  deps = dependencies,
) {
  if (!UUID.test(userId)) throw new ApiRequestError("Choose a valid account.", 400);
  const { actor, serviceSupabase } = await deps.authenticate(request);
  const { data, error } = await serviceSupabase.auth.admin.getUserById(userId);
  if (error || !data.user) throw new ApiRequestError("Could not verify this account.", 404);
  const roles = await serviceSupabase.from("user_roles").select("role").eq("user_id", userId);
  if (roles.error) throw new ApiRequestError("Could not verify account privileges.", 503);
  return {
    userId,
    email: data.user.email ?? null,
    suspended: accountIsSuspended(data.user),
    protectedAccount: actor.id === userId || (roles.data ?? []).some((row) => row.role === "admin"),
  };
}

export async function changeFounderAccountAccess(
  request: Request,
  input: { userId: string; email: string; action: string; reason: string },
  deps = dependencies,
) {
  if (!UUID.test(input.userId) || !["suspend", "restore"].includes(input.action)) {
    throw new ApiRequestError("Choose a valid account and access action.", 400);
  }
  const reason = input.reason.trim();
  if (reason.length < 8 || reason.length > 500)
    throw new ApiRequestError("Enter a reason between 8 and 500 characters.", 400);
  const { actor, serviceSupabase } = await deps.authenticate(request);
  if (actor.id === input.userId)
    throw new ApiRequestError("You cannot suspend your own account.", 403);

  // The server-only RPC checks current identity/role/state and records intent
  // before the Auth API is allowed to change access. No automatic retries.
  const attempt = await serviceSupabase.rpc("founder_begin_account_access", {
    p_actor: actor.id,
    p_target: input.userId,
    p_email: input.email,
    p_action: input.action,
    p_reason: reason,
  });
  if (attempt.error || !attempt.data)
    throw new ApiRequestError(
      "Access change was not started. Refresh the account; it may be protected, changed, or awaiting reconciliation.",
      409,
    );

  const result = await serviceSupabase.auth.admin.updateUserById(input.userId, {
    ban_duration: input.action === "suspend" ? "876000h" : "none",
  });
  // On an ambiguous provider response the pending audit prevents another click
  // from issuing a second consequential request. Founder support reconciles it.
  if (
    result.error ||
    !result.data.user ||
    accountIsSuspended(result.data.user) !== (input.action === "suspend")
  ) {
    throw new ApiRequestError(
      "The access change could not be confirmed. Do not retry; an administrator must reconcile the recorded attempt.",
      502,
    );
  }
  const recorded = await serviceSupabase.rpc("founder_finish_account_access", {
    p_attempt: attempt.data,
  });
  if (recorded.error)
    throw new ApiRequestError(
      "Auth access changed, but audit confirmation is pending. Do not retry; contact the administrator.",
      503,
    );
  return { userId: input.userId, suspended: accountIsSuspended(result.data.user) };
}
