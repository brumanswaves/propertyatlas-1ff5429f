import { SITE_POTENTIAL_PACK_SIZE } from "./config";
import { betaIdempotencyPrefix } from "./betaEntitlements";
import type { createServiceRoleSupabaseClient } from "./serverAuth";

type ServiceSupabase = ReturnType<typeof createServiceRoleSupabaseClient>;

type QueryResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

type LooseQuery = {
  select: (columns?: string) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  insert: (value: unknown) => LooseQuery;
  maybeSingle: () => QueryResult<Record<string, unknown> | null>;
  single: () => QueryResult<Record<string, unknown>>;
};

type LooseSupabase = {
  from: (table: string) => LooseQuery;
  rpc: <T>(
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: T | null; error: { message: string } | null }>;
  auth: {
    admin: {
      getUserById: (id: string) => Promise<{
        data: { user: { id: string; email?: string | null } | null };
        error: { message: string } | null;
      }>;
    };
  };
};

function loose(client: ServiceSupabase) {
  return client as unknown as LooseSupabase;
}

export async function readBetaCreditStatus(input: {
  serviceSupabase: ServiceSupabase;
  userId: string;
}) {
  const db = loose(input.serviceSupabase);
  const { data: credits, error: creditError } = await db
    .from("site_potential_beta_credits")
    .select("credits_granted,credits_used,expires_at")
    .eq("user_id", input.userId);
  if (creditError) throw new Error(creditError.message);

  const now = Date.now();
  const creditsRemaining = (credits ?? []).reduce((sum: number, row: Record<string, unknown>) => {
    const expiresAt = row.expires_at ? new Date(String(row.expires_at)).getTime() : null;
    if (expiresAt && Number.isFinite(expiresAt) && expiresAt <= now) return sum;
    return sum + Math.max(0, Number(row.credits_granted ?? 0) - Number(row.credits_used ?? 0));
  }, 0);

  const { data: request, error: requestError } = await db
    .from("site_potential_beta_access_requests")
    .select("status")
    .eq("user_id", input.userId)
    .eq("status", "open")
    .maybeSingle();
  if (requestError) throw new Error(requestError.message);

  return {
    creditsRemaining,
    openRequestStatus: request?.status ? String(request.status) : null,
  };
}

export async function grantBetaCredits(input: {
  serviceSupabase: ServiceSupabase;
  targetUserId: string;
  grantedBy: string;
  credits: number;
  reason: string;
  expiresAt?: string | null;
}) {
  const db = loose(input.serviceSupabase);
  const { data: target, error: targetError } = await db.auth.admin.getUserById(input.targetUserId);
  if (targetError || !target.user) {
    return { ok: false as const, status: 404, error: "Target user does not exist." };
  }
  const { data, error } = await db
    .from("site_potential_beta_credits")
    .insert({
      user_id: input.targetUserId,
      credits_granted: Math.max(1, Math.min(12, Math.floor(input.credits))),
      credits_used: 0,
      granted_by: input.grantedBy,
      reason: input.reason,
      expires_at: input.expiresAt ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true as const, credit: data };
}

export async function requestBetaAccess(input: {
  serviceSupabase: ServiceSupabase;
  userId: string;
  email?: string | null;
  parcelId?: string | null;
  requestedMode?: string | null;
  reason?: string | null;
}) {
  const db = loose(input.serviceSupabase);
  const { data: existing, error: existingError } = await db
    .from("site_potential_beta_access_requests")
    .select("*")
    .eq("user_id", input.userId)
    .eq("status", "open")
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return { created: false, request: existing };

  const { data, error } = await db
    .from("site_potential_beta_access_requests")
    .insert({
      user_id: input.userId,
      email: input.email ?? null,
      parcel_id: input.parcelId ?? null,
      requested_mode: input.requestedMode ?? null,
      reason: input.reason ?? null,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { created: true, request: data };
}

export async function consumeBetaCreditForDesignPack(input: {
  serviceSupabase: ServiceSupabase;
  userId: string;
  parcelId: string;
  siteProjectId: string;
}) {
  const db = loose(input.serviceSupabase);
  const { data, error } = await db.rpc<
    Array<{ design_pack_id: string; beta_credit_id: string; credits_remaining: number }>
  >("consume_site_potential_beta_credit", {
    p_user_id: input.userId,
    p_parcel_id: input.parcelId,
    p_site_project_id: input.siteProjectId,
    p_idempotency_prefix: betaIdempotencyPrefix(input),
  });
  if (error) {
    if (error.message.includes("NO_BETA_CREDIT")) {
      return { ok: false as const, status: 402, error: "No beta credits available." };
    }
    throw new Error(error.message);
  }
  const row = data?.[0];
  if (!row?.design_pack_id) {
    throw new Error("Beta credit redemption did not return a design pack.");
  }
  return {
    ok: true as const,
    designPackId: row.design_pack_id,
    betaCreditId: row.beta_credit_id,
    creditsRemaining: Number(row.credits_remaining ?? 0),
    requestedCount: SITE_POTENTIAL_PACK_SIZE,
  };
}
