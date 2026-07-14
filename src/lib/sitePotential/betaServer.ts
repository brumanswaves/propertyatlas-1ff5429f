import { SITE_POTENTIAL_PACK_SIZE } from "./config";
import { betaIdempotencyPrefix } from "./betaEntitlements";
import type { createServiceRoleSupabaseClient } from "./serverAuth";

type ServiceSupabase = ReturnType<typeof createServiceRoleSupabaseClient>;

type QueryResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

type LooseQuery = {
  then: PromiseLike<{
    data: Record<string, unknown>[] | null;
    error: { message: string } | null;
  }>["then"];
  select: (columns?: string) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  in: (column: string, values: unknown[]) => LooseQuery;
  order: (column: string, options?: Record<string, unknown>) => LooseQuery;
  limit: (count: number) => LooseQuery;
  insert: (value: unknown) => LooseQuery;
  update: (value: unknown) => LooseQuery;
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

function safeFailureMessage(value: unknown) {
  if (!value) return null;
  return String(value)
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 240);
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

  const { error: requestError } = await db
    .from("site_potential_beta_access_requests")
    .update({
      status: "approved",
    })
    .eq("user_id", input.targetUserId)
    .eq("status", "open");
  if (requestError) throw new Error(requestError.message);

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

export async function readSitePotentialPackStatus(input: {
  serviceSupabase: ServiceSupabase;
  userId: string;
  parcelId: string;
  siteProjectId: string;
  designPackId?: string | null;
}) {
  const db = loose(input.serviceSupabase);
  const { data: project, error: projectError } = await db
    .from("erf_site_projects")
    .select("id,user_id,parcel_id,generation_status")
    .eq("id", input.siteProjectId)
    .eq("parcel_id", input.parcelId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project) {
    return { ok: false as const, status: 404, error: "Site Potential project not found." };
  }

  let packQuery = db
    .from("erf_design_packs")
    .select(
      "id,user_id,parcel_id,site_project_id,payment_provider,status,requested_count,completed_count,failure_code,failure_message,created_at",
    )
    .eq("user_id", input.userId)
    .eq("parcel_id", input.parcelId)
    .eq("site_project_id", input.siteProjectId);
  if (input.designPackId) {
    packQuery = packQuery.eq("id", input.designPackId);
  } else {
    packQuery = packQuery
      .in("status", ["queued", "generating", "partial_failed", "failed", "complete"])
      .order("created_at", { ascending: false })
      .limit(1);
  }
  const { data: pack, error: packError } = await packQuery.maybeSingle();
  if (packError) throw new Error(packError.message);
  if (!pack) {
    return { ok: false as const, status: 404, error: "Design pack not found." };
  }
  if (
    pack.user_id !== input.userId ||
    pack.parcel_id !== input.parcelId ||
    pack.site_project_id !== input.siteProjectId
  ) {
    return { ok: false as const, status: 404, error: "Design pack not found." };
  }

  const { data: items, error: itemsError } = await db
    .from("erf_design_pack_items")
    .select(
      "id,option_index,status,generated_asset_id,attempt_count,failure_code,failure_message,next_attempt_at",
    )
    .eq("design_pack_id", pack.id)
    .eq("user_id", input.userId)
    .order("option_index", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);

  const safeItems = (items ?? []).map((item: Record<string, unknown>) => ({
    id: String(item.id),
    optionIndex: Number(item.option_index),
    status: String(item.status),
    generatedAssetId: item.generated_asset_id ? String(item.generated_asset_id) : null,
    attemptCount: Number(item.attempt_count ?? 0),
    failureCode: item.failure_code ? String(item.failure_code) : null,
    failureMessage: safeFailureMessage(item.failure_message),
    nextAttemptAt: item.next_attempt_at ? String(item.next_attempt_at) : null,
  }));
  const completedCount = safeItems.filter(
    (item) => item.status === "complete" && item.generatedAssetId,
  ).length;

  return {
    ok: true as const,
    pack: {
      designPackId: String(pack.id),
      provider: String(pack.payment_provider ?? "unknown"),
      status: String(pack.status ?? "queued"),
      requestedCount: Number(pack.requested_count ?? SITE_POTENTIAL_PACK_SIZE),
      completedCount,
      failureCode: pack.failure_code ? String(pack.failure_code) : null,
      failureMessage: safeFailureMessage(pack.failure_message),
      items: safeItems,
    },
  };
}
