import { SITE_POTENTIAL_PACK_SIZE } from "./config";
import { SITE_POTENTIAL_MAX_ATTEMPTS, designPackStatusFromItems } from "./generationJobs";
import { betaIdempotencyPrefix } from "./betaEntitlements";
import {
  SITE_POTENTIAL_STALLED_AFTER_MS,
  SITE_POTENTIAL_WORKER_ACTIVE_MS,
  mapSitePotentialFailureForPublic,
} from "./generationProgress";
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
  lt: (column: string, value: unknown) => LooseQuery;
  lte: (column: string, value: unknown) => LooseQuery;
  is: (column: string, value: unknown) => LooseQuery;
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

function workerActiveFromHeartbeat(value: unknown, now = new Date()) {
  if (!value) return false;
  const heartbeat = new Date(String(value)).getTime();
  return Number.isFinite(heartbeat) && now.getTime() - heartbeat <= SITE_POTENTIAL_WORKER_ACTIVE_MS;
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function publicFailureCode(code: unknown, message: unknown) {
  return mapSitePotentialFailureForPublic(code, message)?.code ?? null;
}

function publicFailureMessage(code: unknown, message: unknown) {
  return mapSitePotentialFailureForPublic(code, message)?.message ?? null;
}

function isFutureDate(value: unknown, now: Date) {
  const date = parseDate(value);
  return Boolean(date && date.getTime() > now.getTime());
}

function newestDate(values: Array<Date | null>) {
  return values
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
}

function queuedRetryAnchor(item: Record<string, unknown>, pack: Record<string, unknown>) {
  return newestDate([
    parseDate(item.updated_at),
    parseDate(item.next_attempt_at),
    parseDate(pack.updated_at),
    parseDate(pack.next_attempt_at),
    parseDate(pack.created_at),
  ]);
}

function rowHasLiveWorker(record: Record<string, unknown>, now: Date) {
  if (workerActiveFromHeartbeat(record.heartbeat_at, now)) return true;
  const leaseExpiresAt = parseDate(record.lease_expires_at);
  const leaseActive = Boolean(leaseExpiresAt && leaseExpiresAt.getTime() > now.getTime());
  if (leaseActive) return true;
  const hasWorker = typeof record.worker_id === "string" && record.worker_id.trim().length > 0;
  return String(record.status) === "generating" && hasWorker && !leaseExpiresAt;
}

function packHasActiveWorker(
  items: Array<Record<string, unknown>>,
  pack: Record<string, unknown> | null | undefined,
  now: Date,
) {
  if (pack && rowHasLiveWorker(pack, now)) return true;
  return items.some((item) => rowHasLiveWorker(item, now));
}

function queuedItemIsStalled(
  item: Record<string, unknown>,
  pack: Record<string, unknown>,
  now: Date,
  workerActive: boolean,
) {
  if (String(item.status) !== "queued") return false;
  if (workerActive) return false;
  if (isFutureDate(item.next_attempt_at, now) || isFutureDate(pack.next_attempt_at, now)) return false;
  const anchor = queuedRetryAnchor(item, pack);
  return Boolean(anchor && now.getTime() - anchor.getTime() >= SITE_POTENTIAL_STALLED_AFTER_MS);
}

function generatingLeaseExpired(item: Record<string, unknown>, now: Date) {
  if (String(item.status) !== "generating") return false;
  const expiresAt = parseDate(item.lease_expires_at);
  return Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
}

function itemCanRetry(
  item: Record<string, unknown>,
  pack: Record<string, unknown>,
  now: Date,
  workerActive: boolean,
) {
  if (item.generated_asset_id) return false;
  if (workerActive) return false;
  const status = String(item.status ?? "queued");
  const attemptCount = Number(item.attempt_count ?? 0);
  if (status === "failed") return attemptCount < SITE_POTENTIAL_MAX_ATTEMPTS;
  if (status === "queued") return queuedItemIsStalled(item, pack, now, workerActive);
  if (status === "generating") return generatingLeaseExpired(item, now);
  return false;
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

export interface SitePotentialFreePackRow {
  created_at: string;
}

export interface SitePotentialFreeAllowance {
  used24Hours: number;
  used7Days: number;
  used30Days: number;
  remaining24Hours: number;
  remaining7Days: number;
  remaining30Days: number;
}

export function calculateSitePotentialFreePackUsage(
  rows: SitePotentialFreePackRow[],
  now = new Date(),
) {
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const recentRows = rows.filter((row) => String(row.created_at) >= since30);
  return {
    used24Hours: recentRows.filter((row) => String(row.created_at) >= since24).length,
    used7Days: recentRows.filter((row) => String(row.created_at) >= since7).length,
    used30Days: recentRows.length,
  };
}

export function buildSitePotentialFreeAllowance(input: {
  used24Hours: number;
  used7Days: number;
  used30Days: number;
}): SitePotentialFreeAllowance {
  return {
    ...input,
    remaining24Hours: Math.max(0, 1 - input.used24Hours),
    remaining7Days: Math.max(0, 3 - input.used7Days),
    remaining30Days: Math.max(0, 6 - input.used30Days),
  };
}

export function isSitePotentialFreeEligible(free: SitePotentialFreeAllowance) {
  return free.remaining24Hours > 0 && free.remaining7Days > 0 && free.remaining30Days > 0;
}

export function chooseSitePotentialEntitlementSource(input: {
  freeEligible: boolean;
  betaCreditsRemaining: number;
  purchasedCredits: number;
}) {
  if (input.freeEligible) return "free_allowance";
  if (input.betaCreditsRemaining > 0) return "beta_credit";
  if (input.purchasedCredits > 0) return "site_potential_credit";
  return null;
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

  const { data: freePacks, error: packError } = await db
    .from("erf_design_packs")
    .select("created_at")
    .eq("user_id", input.userId)
    .eq("payment_provider", "free_allowance")
    .eq("entitlement_status", "paid")
    .gte("created_at", since30);
  if (packError) throw new Error(packError.message);
  const freeUsage = calculateSitePotentialFreePackUsage(
    (freePacks ?? []).map((row) => ({ created_at: String(row.created_at ?? "") })),
    now,
  );

  const { data: wallet, error: walletError } = await db
    .from("site_potential_credit_wallets")
    .select("balance")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (walletError) throw new Error(walletError.message);

  const beta = await readBetaCreditStatus(input);
  const free = buildSitePotentialFreeAllowance(freeUsage);
  const freeEligible = isSitePotentialFreeEligible(free);
  const purchasedCredits = Number(wallet?.balance ?? 0);
  const nextEntitlementSource = chooseSitePotentialEntitlementSource({
    freeEligible,
    betaCreditsRemaining: beta.creditsRemaining,
    purchasedCredits,
  });
  return {
    ...beta,
    betaCreditsRemaining: beta.creditsRemaining,
    purchasedCredits,
    free,
    freeEligible,
    canGenerate: nextEntitlementSource !== null,
    nextEntitlementSource,
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
  now?: Date;
}) {
  const db = loose(input.serviceSupabase);
  const now = input.now ?? new Date();
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
      "id,user_id,parcel_id,site_project_id,payment_provider,status,requested_count,completed_count,failure_code,failure_message,created_at,updated_at,worker_id,heartbeat_at,lease_expires_at,next_attempt_at",
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
      "id,option_index,status,generated_asset_id,attempt_count,failure_code,failure_message,next_attempt_at,heartbeat_at,lease_expires_at,updated_at",
    )
    .eq("design_pack_id", pack.id)
    .eq("user_id", input.userId)
    .order("option_index", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);

  const preliminaryWorkerActive = packHasActiveWorker(items ?? [], pack, now);
  const safeItems = (items ?? []).map((item: Record<string, unknown>) => ({
    id: String(item.id),
    optionIndex: Number(item.option_index),
    status: String(item.status),
    generatedAssetReady: Boolean(item.generated_asset_id),
    attemptCount: Number(item.attempt_count ?? 0),
    failureCode: publicFailureCode(item.failure_code, item.failure_message),
    failureMessage: publicFailureMessage(item.failure_code, item.failure_message),
    nextAttemptAt: item.next_attempt_at ? String(item.next_attempt_at) : null,
    updatedAt: item.updated_at ? String(item.updated_at) : null,
    workerHeartbeatAt: item.heartbeat_at ? String(item.heartbeat_at) : null,
    workerActive: rowHasLiveWorker(item, now),
    canRetry: itemCanRetry(item, pack, now, preliminaryWorkerActive),
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
  const workerActive = packHasActiveWorker(items ?? [], pack, now);
  const canRetry = safeItems.some((item) => item.canRetry);

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
      canRetry,
      hasRetryableWork: status.hasRetryableWork,
      terminal: status.terminal,
      failureCode: publicFailureCode(pack.failure_code, pack.failure_message),
      failureMessage: publicFailureMessage(pack.failure_code, pack.failure_message),
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
  if (
    ownership.pack.status === "complete" ||
    ownership.pack.completedCount >= ownership.pack.requestedCount
  ) {
    return { ok: true as const, pack: ownership.pack, retried: false };
  }

  const { data: rawItems, error: itemsError } = await db
    .from("erf_design_pack_items")
    .select(
      "id,option_index,status,generated_asset_id,attempt_count,worker_id,lease_expires_at,next_attempt_at,updated_at,heartbeat_at",
    )
    .eq("design_pack_id", input.designPackId)
    .eq("user_id", input.userId)
    .order("option_index", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);

  const { data: rawPack, error: rawPackError } = await db
    .from("erf_design_packs")
    .select(
      "id,user_id,parcel_id,site_project_id,status,worker_id,heartbeat_at,lease_expires_at,created_at,updated_at,next_attempt_at",
    )
    .eq("id", input.designPackId)
    .eq("user_id", input.userId)
    .eq("parcel_id", input.parcelId)
    .eq("site_project_id", input.siteProjectId)
    .maybeSingle();
  if (rawPackError) throw new Error(rawPackError.message);
  if (!rawPack) return { ok: true as const, pack: ownership.pack, retried: false };

  const workerActive = packHasActiveWorker(rawItems ?? [], rawPack, now);
  if (workerActive) {
    const refreshed = await readSitePotentialPackStatus(input);
    if (!refreshed.ok) return refreshed;
    return { ok: true as const, pack: refreshed.pack, retried: false };
  }
  const retryableItems = (rawItems ?? []).filter((item) =>
    itemCanRetry(item, rawPack, now, workerActive),
  );

  const requeuedIds = new Set<string>();
  for (const item of retryableItems) {
    const { data: updatedRows, error } = await requeueDesignPackItemIfStillEligible({
      db,
      item,
      input,
      now,
      pack: rawPack,
      workerActive,
    });
    if (error) throw new Error(error.message);
    for (const row of updatedRows ?? []) {
      if (row?.id) requeuedIds.add(String(row.id));
    }
  }

  if (requeuedIds.size) {
    const { data: latestPack, error: latestPackError } = await db
      .from("erf_design_packs")
      .select(
        "id,user_id,parcel_id,site_project_id,status,worker_id,heartbeat_at,lease_expires_at,updated_at",
      )
      .eq("id", input.designPackId)
      .eq("user_id", input.userId)
      .eq("parcel_id", input.parcelId)
      .eq("site_project_id", input.siteProjectId)
      .maybeSingle();
    if (latestPackError) throw new Error(latestPackError.message);

    if (packHasActiveWorker([], latestPack, now)) {
      const refreshed = await readSitePotentialPackStatus(input);
      if (!refreshed.ok) return refreshed;
      return { ok: true as const, pack: refreshed.pack, retried: true };
    }

    let packUpdateQuery = db
      .from("erf_design_packs")
      .update({
        status: "queued",
        failure_code: null,
        failure_message: null,
        next_attempt_at: now.toISOString(),
      })
      .eq("id", input.designPackId)
      .eq("user_id", input.userId)
      .eq("parcel_id", input.parcelId)
      .eq("site_project_id", input.siteProjectId);
    if (latestPack) {
      packUpdateQuery = addCurrentValueGuard(packUpdateQuery, "updated_at", latestPack.updated_at)
        .eq("status", latestPack.status);
      packUpdateQuery = addCurrentValueGuard(packUpdateQuery, "worker_id", latestPack.worker_id);
      packUpdateQuery = addCurrentValueGuard(
        packUpdateQuery,
        "heartbeat_at",
        latestPack.heartbeat_at,
      );
      packUpdateQuery = addCurrentValueGuard(
        packUpdateQuery,
        "lease_expires_at",
        latestPack.lease_expires_at,
      );
    }
    const { data: updatedPackRows, error: packError } = await packUpdateQuery.select("id");
    if (packError) throw new Error(packError.message);
    if (updatedPackRows?.length) {
      const { error: projectError } = await db
        .from("erf_site_projects")
        .update({ generation_status: "generating" })
        .eq("id", input.siteProjectId)
        .eq("user_id", input.userId)
        .eq("parcel_id", input.parcelId);
      if (projectError) throw new Error(projectError.message);
    }
  }

  const refreshed = await readSitePotentialPackStatus(input);
  if (!refreshed.ok) return refreshed;
  return { ok: true as const, pack: refreshed.pack, retried: requeuedIds.size > 0 };
}

async function requeueDesignPackItemIfStillEligible(input: {
  db: LooseSupabase;
  item: Record<string, unknown>;
  input: {
    userId: string;
    parcelId: string;
    siteProjectId: string;
    designPackId: string;
  };
  now: Date;
  pack: Record<string, unknown>;
  workerActive: boolean;
}) {
  const status = String(input.item.status ?? "queued");
  let query = input.db
    .from("erf_design_pack_items")
    .update({
      status: "queued",
      worker_id: null,
      heartbeat_at: null,
      lease_expires_at: null,
      failure_code: null,
      failure_message: null,
      next_attempt_at: input.now.toISOString(),
    })
    .eq("id", input.item.id)
    .eq("user_id", input.input.userId)
    .eq("design_pack_id", input.input.designPackId)
    .eq("status", status)
    .is("generated_asset_id", null);

  if (status === "failed") {
    query = query.lt("attempt_count", SITE_POTENTIAL_MAX_ATTEMPTS);
  } else if (status === "queued") {
    if (!queuedItemIsStalled(input.item, input.pack, input.now, input.workerActive)) {
      return { data: [], error: null };
    }
    query = addCurrentValueGuard(query, "updated_at", input.item.updated_at);
  } else if (status === "generating") {
    if (!generatingLeaseExpired(input.item, input.now)) {
      return { data: [], error: null };
    }
    query = query.lte("lease_expires_at", input.now.toISOString());
  } else {
    return { data: [], error: null };
  }

  return query.select("id");
}

function addCurrentValueGuard(query: LooseQuery, column: string, value: unknown) {
  if (value === null || value === undefined) return query.is(column, null);
  return query.eq(column, value);
}
