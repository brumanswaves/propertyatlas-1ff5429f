import { SITE_POTENTIAL_PACK_SIZE } from "./config";
import { SITE_POTENTIAL_MAX_ATTEMPTS, designPackStatusFromItems } from "./generationJobs";
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
  gte: (column: string, value: unknown) => LooseQuery;
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

function workerActiveFromHeartbeat(value: unknown, now = new Date()) {
  if (!value) return false;
  const heartbeat = new Date(String(value)).getTime();
  return Number.isFinite(heartbeat) && now.getTime() - heartbeat <= 90_000;
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

export async function readSitePotentialAccessStatus(input: {
  serviceSupabase: ServiceSupabase;
  userId: string;
  parcelId?: string | null;
  now?: Date;
}) {
  const db = loose(input.serviceSupabase);
  const now = input.now ?? new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: freePacks, error: packError } = await db
    .from("erf_design_packs")
    .select("parcel_id,created_at")
    .eq("user_id", input.userId)
    .eq("payment_provider", "free_allowance")
    .eq("entitlement_status", "paid")
    .gte("created_at", since30);
  if (packError) throw new Error(packError.message);
  const rows = freePacks ?? [];
  const used24Hours = rows.filter((row) => String(row.created_at) >= since24).length;
  const used7Days = rows.filter((row) => String(row.created_at) >= since7).length;
  const used30Days = rows.length;
  const sameParcelUsed30Days = input.parcelId
    ? rows.filter((row) => String(row.parcel_id) === input.parcelId).length
    : 0;

  const { data: wallet, error: walletError } = await db
    .from("site_potential_credit_wallets")
    .select("balance")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (walletError) throw new Error(walletError.message);

  const beta = await readBetaCreditStatus(input);
  const free = {
    used24Hours,
    used7Days,
    used30Days,
    remaining24Hours: Math.max(0, 1 - used24Hours),
    remaining7Days: Math.max(0, 3 - used7Days),
    remaining30Days: Math.max(0, 6 - used30Days),
    sameParcelEligible: !input.parcelId || sameParcelUsed30Days < 1,
  };
  const freeEligible =
    free.remaining24Hours > 0 &&
    free.remaining7Days > 0 &&
    free.remaining30Days > 0 &&
    free.sameParcelEligible;
  const purchasedCredits = Number(wallet?.balance ?? 0);
  return {
    ...beta,
    betaCreditsRemaining: beta.creditsRemaining,
    purchasedCredits,
    free,
    freeEligible,
    canGenerate: freeEligible || beta.creditsRemaining > 0 || purchasedCredits > 0,
    nextEntitlementSource: freeEligible
      ? "free_allowance"
      : beta.creditsRemaining > 0
        ? "beta_credit"
        : purchasedCredits > 0
          ? "site_potential_credit"
          : null,
  };
}

export async function consumeSitePotentialEntitlement(input: {
  serviceSupabase: ServiceSupabase;
  userId: string;
  parcelId: string;
  siteProjectId: string;
  requestId: string;
}) {
  const db = loose(input.serviceSupabase);
  const { data, error } = await db.rpc<
    Array<{
      design_pack_id: string;
      entitlement_source: string;
      purchased_credits_remaining: number;
      beta_credits_remaining: number;
      free_used_24h: number;
      free_used_7d: number;
      free_used_30d: number;
    }>
  >("redeem_site_potential_pack_v2", {
    p_user_id: input.userId,
    p_parcel_id: input.parcelId,
    p_site_project_id: input.siteProjectId,
    p_request_id: input.requestId,
  });
  if (error) {
    if (error.message.includes("NO_SITE_POTENTIAL_ENTITLEMENT")) {
      return {
        ok: false as const,
        status: 402,
        error: "Free Site Potential allowance used and no purchased credits are available.",
      };
    }
    throw new Error(error.message);
  }
  const row = data?.[0];
  if (!row?.design_pack_id) throw new Error("Entitlement redemption did not return a design pack.");
  return {
    ok: true as const,
    designPackId: row.design_pack_id,
    entitlementSource: row.entitlement_source,
    purchasedCreditsRemaining: Number(row.purchased_credits_remaining ?? 0),
    betaCreditsRemaining: Number(row.beta_credits_remaining ?? 0),
    requestedCount: SITE_POTENTIAL_PACK_SIZE,
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
      "id,user_id,parcel_id,site_project_id,payment_provider,status,requested_count,completed_count,failure_code,failure_message,created_at,updated_at,heartbeat_at,next_attempt_at",
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
      "id,option_index,status,generated_asset_id,attempt_count,failure_code,failure_message,next_attempt_at,heartbeat_at",
    )
    .eq("design_pack_id", pack.id)
    .eq("user_id", input.userId)
    .order("option_index", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);

  const safeItems = (items ?? []).map((item: Record<string, unknown>) => ({
    id: String(item.id),
    optionIndex: Number(item.option_index),
    status: String(item.status),
    generatedAssetReady: Boolean(item.generated_asset_id),
    attemptCount: Number(item.attempt_count ?? 0),
    failureCode: item.failure_code ? String(item.failure_code) : null,
    failureMessage: safeFailureMessage(item.failure_message),
    nextAttemptAt: item.next_attempt_at ? String(item.next_attempt_at) : null,
    workerHeartbeatAt: item.heartbeat_at ? String(item.heartbeat_at) : null,
    workerActive:
      String(item.status) === "generating" || workerActiveFromHeartbeat(item.heartbeat_at),
  }));
  const completedCount = safeItems.filter(
    (item) => item.status === "complete" && item.generatedAssetReady,
  ).length;
  const status = designPackStatusFromItems(
    safeItems.map((item) => ({
      id: item.id,
      option_index: item.optionIndex,
      status: item.status as never,
      generated_asset_id: item.generatedAssetReady ? "ready" : null,
      attempt_count: item.attemptCount,
      next_attempt_at: item.nextAttemptAt,
    })),
    Number(pack.requested_count ?? SITE_POTENTIAL_PACK_SIZE),
  );
  const workerActive =
    workerActiveFromHeartbeat(pack.heartbeat_at) || safeItems.some((item) => item.workerActive);

  return {
    ok: true as const,
    pack: {
      designPackId: String(pack.id),
      provider: String(pack.payment_provider ?? "unknown"),
      status: status.status,
      requestedCount: Number(pack.requested_count ?? SITE_POTENTIAL_PACK_SIZE),
      completedCount,
      createdAt: pack.created_at ? String(pack.created_at) : null,
      updatedAt: pack.updated_at ? String(pack.updated_at) : null,
      workerHeartbeatAt: pack.heartbeat_at ? String(pack.heartbeat_at) : null,
      workerActive,
      nextAttemptAt: pack.next_attempt_at ? String(pack.next_attempt_at) : null,
      hasRetryableWork: status.hasRetryableWork,
      terminal: status.terminal,
      failureCode: pack.failure_code ? String(pack.failure_code) : null,
      failureMessage: safeFailureMessage(pack.failure_message),
      items: safeItems,
    },
  };
}

export async function retrySitePotentialPack(input: {
  serviceSupabase: ServiceSupabase;
  userId: string;
  parcelId: string;
  siteProjectId: string;
  designPackId: string;
  now?: Date;
}) {
  const db = loose(input.serviceSupabase);
  const now = input.now ?? new Date();
  const ownership = await readSitePotentialPackStatus(input);
  if (!ownership.ok) return ownership;
  if (ownership.pack.status === "complete" || ownership.pack.completedCount >= ownership.pack.requestedCount) {
    return { ok: true as const, pack: ownership.pack, retried: false };
  }

  const { data: rawItems, error: itemsError } = await db
    .from("erf_design_pack_items")
    .select(
      "id,option_index,status,generated_asset_id,attempt_count,lease_expires_at,next_attempt_at",
    )
    .eq("design_pack_id", input.designPackId)
    .eq("user_id", input.userId)
    .order("option_index", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);

  const retryableItems = (rawItems ?? []).filter((item) => {
    if (item.generated_asset_id) return false;
    const status = String(item.status ?? "queued");
    const attemptCount = Number(item.attempt_count ?? 0);
    if (status === "failed") return attemptCount < SITE_POTENTIAL_MAX_ATTEMPTS;
    if (status === "queued") return true;
    if (status !== "generating") return false;
    const expiresAt = item.lease_expires_at ? new Date(String(item.lease_expires_at)).getTime() : null;
    return Boolean(expiresAt && Number.isFinite(expiresAt) && expiresAt <= now.getTime());
  });

  for (const item of retryableItems) {
    const { error } = await db
      .from("erf_design_pack_items")
      .update({
        status: "queued",
        worker_id: null,
        heartbeat_at: null,
        lease_expires_at: null,
        failure_code: null,
        failure_message: null,
        next_attempt_at: now.toISOString(),
      })
      .eq("id", item.id)
      .eq("user_id", input.userId);
    if (error) throw new Error(error.message);
  }

  if (retryableItems.length) {
    const { error: packError } = await db
      .from("erf_design_packs")
      .update({
        status: "queued",
        worker_id: null,
        heartbeat_at: null,
        lease_expires_at: null,
        failure_code: null,
        failure_message: null,
        next_attempt_at: now.toISOString(),
      })
      .eq("id", input.designPackId)
      .eq("user_id", input.userId)
      .eq("parcel_id", input.parcelId)
      .eq("site_project_id", input.siteProjectId);
    if (packError) throw new Error(packError.message);
    const { error: projectError } = await db
      .from("erf_site_projects")
      .update({ generation_status: "generating" })
      .eq("id", input.siteProjectId)
      .eq("user_id", input.userId)
      .eq("parcel_id", input.parcelId);
    if (projectError) throw new Error(projectError.message);
  }

  const refreshed = await readSitePotentialPackStatus(input);
  if (!refreshed.ok) return refreshed;
  return { ok: true as const, pack: refreshed.pack, retried: retryableItems.length > 0 };
}
