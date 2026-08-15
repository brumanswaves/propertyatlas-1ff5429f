// GENERATED from src/lib/sitePotential/edgeApiRequest.ts. Do not hand-edit.

// src/lib/sitePotential/betaEntitlements.ts
function sitePotentialRuntimeMessage(status) {
  switch (status) {
    case "READY":
      return "Site Potential generation is operational.";
    case "GENERATION_DISABLED":
      return "AI concept generation is not enabled on this deployment yet.";
    case "WORKER_DISABLED":
      return "Concept generation is temporarily offline because the generation worker is not enabled.";
    case "PROVIDER_UNAVAILABLE":
      return "The image generation provider is temporarily unavailable. Please retry later.";
    case "SERVER_CONFIGURATION_ERROR":
      return "Concept generation is temporarily unavailable on this deployment.";
  }
}
function isSitePotentialBetaEnabled(env) {
  return env.SITE_POTENTIAL_BETA_ENABLED === "true";
}
function resolveSitePotentialRuntimeReadiness(env) {
  if (!isSitePotentialBetaEnabled(env)) {
    return { status: "GENERATION_DISABLED", ready: false };
  }
  if (env.SITE_POTENTIAL_WORKER_ENABLED !== "true") {
    return { status: "WORKER_DISABLED", ready: false };
  }
  if (!env.SITE_POTENTIAL_WORKER_SECRET || !env.OPENAI_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: "SERVER_CONFIGURATION_ERROR", ready: false };
  }
  return { status: "READY", ready: true };
}

// src/lib/sitePotential/config.ts
var SITE_POTENTIAL_PACK_SIZE = 3;

// src/lib/sitePotential/generationJobs.ts
var DESIGN_PACK_OPTION_INDEXES = Array.from(
  { length: SITE_POTENTIAL_PACK_SIZE },
  (_, index) => index + 1
);
var SITE_POTENTIAL_LEASE_MS = 10 * 60 * 1e3;
var SITE_POTENTIAL_LEASE_RENEWAL_MS = 60 * 1e3;
var SITE_POTENTIAL_OPENAI_TIMEOUT_MS = SITE_POTENTIAL_LEASE_MS - 60 * 1e3;
var SITE_POTENTIAL_MAX_ATTEMPTS = 3;
function designPackItemRows(input) {
  const count = input.optionCount ?? SITE_POTENTIAL_PACK_SIZE;
  return Array.from({ length: count }, (_, index) => ({
    user_id: input.userId,
    design_pack_id: input.designPackId,
    option_index: index + 1,
    status: "queued"
  }));
}
function isDesignPackItemEligibleForCompletion(item, maxAttempts = SITE_POTENTIAL_MAX_ATTEMPTS) {
  return !item.generated_asset_id && (item.status === "queued" || item.status === "generating" || item.status === "failed" && (item.attempt_count ?? 0) < maxAttempts);
}
function designPackStatusFromItems(items, requestedCount = SITE_POTENTIAL_PACK_SIZE, maxAttempts = SITE_POTENTIAL_MAX_ATTEMPTS) {
  const completedCount = items.filter(
    (item) => item.status === "complete" && item.generated_asset_id
  ).length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const generatingCount = items.filter((item) => item.status === "generating").length;
  const eligibleCount = items.filter(
    (item) => isDesignPackItemEligibleForCompletion(item, maxAttempts)
  ).length;
  if (completedCount >= requestedCount) {
    return { status: "complete", completedCount, hasRetryableWork: false, terminal: true };
  }
  if (generatingCount > 0) {
    return { status: "generating", completedCount, hasRetryableWork: true, terminal: false };
  }
  if (failedCount > 0 && eligibleCount > 0) {
    return { status: "partial_failed", completedCount, hasRetryableWork: true, terminal: false };
  }
  if (eligibleCount > 0) {
    return { status: "queued", completedCount, hasRetryableWork: true, terminal: false };
  }
  if (failedCount > 0 && completedCount > 0) {
    return { status: "partial_failed", completedCount, hasRetryableWork: false, terminal: true };
  }
  if (failedCount > 0) {
    return { status: "failed", completedCount, hasRetryableWork: false, terminal: true };
  }
  return { status: "queued", completedCount, hasRetryableWork: false, terminal: false };
}
function isUsableImageAsset(asset) {
  const mime = String(asset.mime_type ?? "").toLowerCase();
  const name = String(asset.original_file_name ?? "").toLowerCase();
  return mime === "image/png" || mime === "image/jpeg" || mime === "image/webp" || /\.(png|jpe?g|webp)$/.test(name);
}
var SITE_CONTEXT_ASSET_PRIORITY = {
  existing_house_photo: 0,
  site_photo: 1,
  topography: 2,
  architectural_plan: 3,
  inspiration_image: 4
};
function sourceAssetsForGenerationMode(mode, assets) {
  const active = assets.filter((asset) => asset.storage_path && isUsableImageAsset(asset)).filter((asset) => asset.asset_category in SITE_CONTEXT_ASSET_PRIORITY).sort((a, b) => {
    const aPriority = SITE_CONTEXT_ASSET_PRIORITY[a.asset_category] ?? 99;
    const bPriority = SITE_CONTEXT_ASSET_PRIORITY[b.asset_category] ?? 99;
    if (mode === "renovation") {
      if (a.asset_category === "existing_house_photo") return -1;
      if (b.asset_category === "existing_house_photo") return 1;
    }
    if (aPriority !== bPriority) return aPriority - bPriority;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
  return active.slice(0, 5);
}
function sanitizedGenerationError(error) {
  const raw = error instanceof Error ? error.message : "Concept generation failed.";
  return raw.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]").slice(0, 500);
}

// src/lib/sitePotential/generationProgress.ts
var SITE_POTENTIAL_WORKER_ACTIVE_MS = 9e4;
var SITE_POTENTIAL_STALLED_AFTER_MS = 9e4;
var PUBLIC_FAILURE_MESSAGES = {
  generator_unavailable: "The image generator is temporarily unavailable. Refresh the status or retry this pack later.",
  source_image_unavailable: "One or more source images could not be used. Check the uploaded files and retry if needed.",
  generation_timeout: "The generator took too long to finish this concept. You can retry eligible concepts.",
  image_save_failed: "The concept image could not be saved to the Erf File Vault. Refresh the vault or retry.",
  maximum_attempts_reached: "Maximum retry attempts were reached for this concept pack.",
  unknown_generation_failure: "Generation stopped before all concepts were created. Refresh the status or retry eligible concepts."
};
function mapSitePotentialFailureForPublic(code, message) {
  const rawCode = String(code ?? "").toLowerCase();
  const rawMessage = String(message ?? "").toLowerCase();
  const joined = `${rawCode} ${rawMessage}`;
  if (!joined.trim()) return null;
  if (/max(imum)?[_\s-]?attempt|attempts?[_\s-]?exhausted/.test(joined)) {
    return publicFailure("maximum_attempts_reached");
  }
  if (/timeout|timed[_\s-]?out|lease[_\s-]?expired/.test(joined)) {
    return publicFailure("generation_timeout");
  }
  if (/save|storage|bucket|upload/.test(joined)) {
    return publicFailure("image_save_failed");
  }
  if (/source|input[_\s-]?image|photo|asset[_\s-]?unavailable/.test(joined)) {
    return publicFailure("source_image_unavailable");
  }
  if (/openai|generator|provider|rate[_\s-]?limit|unavailable/.test(joined)) {
    return publicFailure("generator_unavailable");
  }
  return publicFailure("unknown_generation_failure");
}
function publicFailure(code) {
  return { code, message: PUBLIC_FAILURE_MESSAGES[code] };
}

// src/lib/sitePotential/betaServer.ts
function loose(client) {
  return client;
}
function calculateSitePotentialFreePackUsage(rows, now = /* @__PURE__ */ new Date()) {
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3).toISOString();
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3).toISOString();
  const since24 = new Date(now.getTime() - 24 * 60 * 60 * 1e3).toISOString();
  const recentRows = rows.filter((row) => String(row.created_at) >= since30);
  return {
    used24Hours: recentRows.filter((row) => String(row.created_at) >= since24).length,
    used7Days: recentRows.filter((row) => String(row.created_at) >= since7).length,
    used30Days: recentRows.length
  };
}
function buildSitePotentialFreeAllowance(input) {
  return {
    ...input,
    remaining24Hours: Math.max(0, 1 - input.used24Hours),
    remaining7Days: Math.max(0, 3 - input.used7Days),
    remaining30Days: Math.max(0, 6 - input.used30Days)
  };
}
function isSitePotentialFreeEligible(free) {
  return free.remaining24Hours > 0 && free.remaining7Days > 0 && free.remaining30Days > 0;
}
function chooseSitePotentialEntitlementSource(input) {
  if (input.freeEligible) return "free_allowance";
  if (input.betaCreditsRemaining > 0) return "beta_credit";
  if (input.purchasedCredits > 0) return "site_potential_credit";
  return null;
}
function workerActiveFromHeartbeat(value, now = /* @__PURE__ */ new Date()) {
  if (!value) return false;
  const heartbeat = new Date(String(value)).getTime();
  return Number.isFinite(heartbeat) && now.getTime() - heartbeat <= SITE_POTENTIAL_WORKER_ACTIVE_MS;
}
function parseDate(value) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}
function publicFailureCode(code, message) {
  return mapSitePotentialFailureForPublic(code, message)?.code ?? null;
}
function publicFailureMessage(code, message) {
  return mapSitePotentialFailureForPublic(code, message)?.message ?? null;
}
function isFutureDate(value, now) {
  const date = parseDate(value);
  return Boolean(date && date.getTime() > now.getTime());
}
function newestDate(values) {
  return values.filter((value) => Boolean(value)).sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
}
function queuedRetryAnchor(item, pack) {
  return newestDate([
    parseDate(item.updated_at),
    parseDate(item.next_attempt_at),
    parseDate(pack.updated_at),
    parseDate(pack.next_attempt_at),
    parseDate(pack.created_at)
  ]);
}
function rowHasLiveWorker(record, now) {
  if (workerActiveFromHeartbeat(record.heartbeat_at, now)) return true;
  const leaseExpiresAt2 = parseDate(record.lease_expires_at);
  const leaseActive = Boolean(leaseExpiresAt2 && leaseExpiresAt2.getTime() > now.getTime());
  if (leaseActive) return true;
  const hasWorker = typeof record.worker_id === "string" && record.worker_id.trim().length > 0;
  return String(record.status) === "generating" && hasWorker && !leaseExpiresAt2;
}
function packHasActiveWorker(items, pack, now) {
  if (pack && rowHasLiveWorker(pack, now)) return true;
  return items.some((item) => rowHasLiveWorker(item, now));
}
function queuedItemIsStalled(item, pack, now, workerActive) {
  if (String(item.status) !== "queued") return false;
  if (workerActive) return false;
  if (isFutureDate(item.next_attempt_at, now) || isFutureDate(pack.next_attempt_at, now)) return false;
  const anchor = queuedRetryAnchor(item, pack);
  return Boolean(anchor && now.getTime() - anchor.getTime() >= SITE_POTENTIAL_STALLED_AFTER_MS);
}
function generatingLeaseExpired(item, now) {
  if (String(item.status) !== "generating") return false;
  const expiresAt = parseDate(item.lease_expires_at);
  return Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
}
function itemCanRetry(item, pack, now, workerActive) {
  if (item.generated_asset_id) return false;
  if (workerActive) return false;
  const status = String(item.status ?? "queued");
  const attemptCount = Number(item.attempt_count ?? 0);
  if (status === "failed") return attemptCount < SITE_POTENTIAL_MAX_ATTEMPTS;
  if (status === "queued") return queuedItemIsStalled(item, pack, now, workerActive);
  if (status === "generating") return generatingLeaseExpired(item, now);
  return false;
}
async function readBetaCreditStatus(input) {
  const db = loose(input.serviceSupabase);
  const { data: credits, error: creditError } = await db.from("site_potential_beta_credits").select("credits_granted,credits_used,expires_at").eq("user_id", input.userId);
  if (creditError) throw new Error(creditError.message);
  const now = Date.now();
  const creditsRemaining = (credits ?? []).reduce((sum, row) => {
    const expiresAt = row.expires_at ? new Date(String(row.expires_at)).getTime() : null;
    if (expiresAt && Number.isFinite(expiresAt) && expiresAt <= now) return sum;
    return sum + Math.max(0, Number(row.credits_granted ?? 0) - Number(row.credits_used ?? 0));
  }, 0);
  const { data: request, error: requestError } = await db.from("site_potential_beta_access_requests").select("status").eq("user_id", input.userId).eq("status", "open").maybeSingle();
  if (requestError) throw new Error(requestError.message);
  return {
    creditsRemaining,
    openRequestStatus: request?.status ? String(request.status) : null
  };
}
async function readSitePotentialAccessStatus(input) {
  const db = loose(input.serviceSupabase);
  const now = input.now ?? /* @__PURE__ */ new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3).toISOString();
  const { data: freePacks, error: packError } = await db.from("erf_design_packs").select("created_at").eq("user_id", input.userId).eq("payment_provider", "free_allowance").eq("entitlement_status", "paid").gte("created_at", since30);
  if (packError) throw new Error(packError.message);
  const freeUsage = calculateSitePotentialFreePackUsage(
    (freePacks ?? []).map((row) => ({ created_at: String(row.created_at ?? "") })),
    now
  );
  const { data: wallet, error: walletError } = await db.from("site_potential_credit_wallets").select("balance").eq("user_id", input.userId).maybeSingle();
  if (walletError) throw new Error(walletError.message);
  const beta = await readBetaCreditStatus(input);
  const free = buildSitePotentialFreeAllowance(freeUsage);
  const freeEligible = isSitePotentialFreeEligible(free);
  const purchasedCredits = Number(wallet?.balance ?? 0);
  const nextEntitlementSource = chooseSitePotentialEntitlementSource({
    freeEligible,
    betaCreditsRemaining: beta.creditsRemaining,
    purchasedCredits
  });
  return {
    ...beta,
    betaCreditsRemaining: beta.creditsRemaining,
    purchasedCredits,
    free,
    freeEligible,
    canGenerate: nextEntitlementSource !== null,
    nextEntitlementSource
  };
}
async function consumeSitePotentialEntitlement(input) {
  const db = loose(input.serviceSupabase);
  const { data, error } = await db.rpc("redeem_site_potential_pack_v2", {
    p_user_id: input.userId,
    p_parcel_id: input.parcelId,
    p_site_project_id: input.siteProjectId,
    p_request_id: input.requestId
  });
  if (error) {
    if (error.message.includes("NO_SITE_POTENTIAL_ENTITLEMENT")) {
      return {
        ok: false,
        status: 402,
        error: "Free Site Potential allowance used and no purchased credits are available."
      };
    }
    throw new Error(error.message);
  }
  const row = data?.[0];
  if (!row?.design_pack_id) throw new Error("Entitlement redemption did not return a design pack.");
  return {
    ok: true,
    designPackId: row.design_pack_id,
    entitlementSource: row.entitlement_source,
    purchasedCreditsRemaining: Number(row.purchased_credits_remaining ?? 0),
    betaCreditsRemaining: Number(row.beta_credits_remaining ?? 0),
    requestedCount: SITE_POTENTIAL_PACK_SIZE
  };
}
async function readSitePotentialPackStatus(input) {
  const db = loose(input.serviceSupabase);
  const now = input.now ?? /* @__PURE__ */ new Date();
  const { data: project, error: projectError } = await db.from("erf_site_projects").select("id,user_id,parcel_id,generation_status").eq("id", input.siteProjectId).eq("parcel_id", input.parcelId).eq("user_id", input.userId).maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project) {
    return { ok: false, status: 404, error: "Site Potential project not found." };
  }
  let packQuery = db.from("erf_design_packs").select(
    "id,user_id,parcel_id,site_project_id,payment_provider,status,requested_count,completed_count,failure_code,failure_message,created_at,updated_at,worker_id,heartbeat_at,lease_expires_at,next_attempt_at"
  ).eq("user_id", input.userId).eq("parcel_id", input.parcelId).eq("site_project_id", input.siteProjectId);
  if (input.designPackId) {
    packQuery = packQuery.eq("id", input.designPackId);
  } else {
    packQuery = packQuery.in("status", ["queued", "generating", "partial_failed", "failed", "complete"]).order("created_at", { ascending: false }).limit(1);
  }
  const { data: pack, error: packError } = await packQuery.maybeSingle();
  if (packError) throw new Error(packError.message);
  if (!pack) {
    return { ok: false, status: 404, error: "Design pack not found." };
  }
  if (pack.user_id !== input.userId || pack.parcel_id !== input.parcelId || pack.site_project_id !== input.siteProjectId) {
    return { ok: false, status: 404, error: "Design pack not found." };
  }
  const { data: items, error: itemsError } = await db.from("erf_design_pack_items").select(
    "id,option_index,status,generated_asset_id,attempt_count,failure_code,failure_message,next_attempt_at,heartbeat_at,lease_expires_at,updated_at"
  ).eq("design_pack_id", pack.id).eq("user_id", input.userId).order("option_index", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);
  const preliminaryWorkerActive = packHasActiveWorker(items ?? [], pack, now);
  const safeItems = (items ?? []).map((item) => ({
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
    canRetry: itemCanRetry(item, pack, now, preliminaryWorkerActive)
  }));
  const completedCount = safeItems.filter(
    (item) => item.status === "complete" && item.generatedAssetReady
  ).length;
  const status = designPackStatusFromItems(
    safeItems.map((item) => ({
      id: item.id,
      option_index: item.optionIndex,
      status: item.status,
      generated_asset_id: item.generatedAssetReady ? "ready" : null,
      attempt_count: item.attemptCount,
      next_attempt_at: item.nextAttemptAt
    })),
    Number(pack.requested_count ?? SITE_POTENTIAL_PACK_SIZE)
  );
  const workerActive = packHasActiveWorker(items ?? [], pack, now);
  const canRetry = safeItems.some((item) => item.canRetry);
  return {
    ok: true,
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
      items: safeItems
    }
  };
}
async function retrySitePotentialPack(input) {
  const db = loose(input.serviceSupabase);
  const now = input.now ?? /* @__PURE__ */ new Date();
  const ownership = await readSitePotentialPackStatus(input);
  if (!ownership.ok) return ownership;
  if (ownership.pack.status === "complete" || ownership.pack.completedCount >= ownership.pack.requestedCount) {
    return { ok: true, pack: ownership.pack, retried: false };
  }
  const { data: rawItems, error: itemsError } = await db.from("erf_design_pack_items").select(
    "id,option_index,status,generated_asset_id,attempt_count,worker_id,lease_expires_at,next_attempt_at,updated_at,heartbeat_at"
  ).eq("design_pack_id", input.designPackId).eq("user_id", input.userId).order("option_index", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);
  const { data: rawPack, error: rawPackError } = await db.from("erf_design_packs").select(
    "id,user_id,parcel_id,site_project_id,status,worker_id,heartbeat_at,lease_expires_at,created_at,updated_at,next_attempt_at"
  ).eq("id", input.designPackId).eq("user_id", input.userId).eq("parcel_id", input.parcelId).eq("site_project_id", input.siteProjectId).maybeSingle();
  if (rawPackError) throw new Error(rawPackError.message);
  if (!rawPack) return { ok: true, pack: ownership.pack, retried: false };
  const workerActive = packHasActiveWorker(rawItems ?? [], rawPack, now);
  if (workerActive) {
    const refreshed2 = await readSitePotentialPackStatus(input);
    if (!refreshed2.ok) return refreshed2;
    return { ok: true, pack: refreshed2.pack, retried: false };
  }
  const retryableItems = (rawItems ?? []).filter(
    (item) => itemCanRetry(item, rawPack, now, workerActive)
  );
  const requeuedIds = /* @__PURE__ */ new Set();
  for (const item of retryableItems) {
    const { data: updatedRows, error } = await requeueDesignPackItemIfStillEligible({
      db,
      item,
      input,
      now,
      pack: rawPack,
      workerActive
    });
    if (error) throw new Error(error.message);
    for (const row of updatedRows ?? []) {
      if (row?.id) requeuedIds.add(String(row.id));
    }
  }
  if (requeuedIds.size) {
    const { data: latestPack, error: latestPackError } = await db.from("erf_design_packs").select(
      "id,user_id,parcel_id,site_project_id,status,worker_id,heartbeat_at,lease_expires_at,updated_at"
    ).eq("id", input.designPackId).eq("user_id", input.userId).eq("parcel_id", input.parcelId).eq("site_project_id", input.siteProjectId).maybeSingle();
    if (latestPackError) throw new Error(latestPackError.message);
    if (packHasActiveWorker([], latestPack, now)) {
      const refreshed2 = await readSitePotentialPackStatus(input);
      if (!refreshed2.ok) return refreshed2;
      return { ok: true, pack: refreshed2.pack, retried: true };
    }
    let packUpdateQuery = db.from("erf_design_packs").update({
      status: "queued",
      failure_code: null,
      failure_message: null,
      next_attempt_at: now.toISOString()
    }).eq("id", input.designPackId).eq("user_id", input.userId).eq("parcel_id", input.parcelId).eq("site_project_id", input.siteProjectId);
    if (latestPack) {
      packUpdateQuery = addCurrentValueGuard(packUpdateQuery, "updated_at", latestPack.updated_at).eq("status", latestPack.status);
      packUpdateQuery = addCurrentValueGuard(packUpdateQuery, "worker_id", latestPack.worker_id);
      packUpdateQuery = addCurrentValueGuard(
        packUpdateQuery,
        "heartbeat_at",
        latestPack.heartbeat_at
      );
      packUpdateQuery = addCurrentValueGuard(
        packUpdateQuery,
        "lease_expires_at",
        latestPack.lease_expires_at
      );
    }
    const { data: updatedPackRows, error: packError } = await packUpdateQuery.select("id");
    if (packError) throw new Error(packError.message);
    if (updatedPackRows?.length) {
      const { error: projectError } = await db.from("erf_site_projects").update({ generation_status: "generating" }).eq("id", input.siteProjectId).eq("user_id", input.userId).eq("parcel_id", input.parcelId);
      if (projectError) throw new Error(projectError.message);
    }
  }
  const refreshed = await readSitePotentialPackStatus(input);
  if (!refreshed.ok) return refreshed;
  return { ok: true, pack: refreshed.pack, retried: requeuedIds.size > 0 };
}
async function requeueDesignPackItemIfStillEligible(input) {
  const status = String(input.item.status ?? "queued");
  let query = input.db.from("erf_design_pack_items").update({
    status: "queued",
    worker_id: null,
    heartbeat_at: null,
    lease_expires_at: null,
    failure_code: null,
    failure_message: null,
    next_attempt_at: input.now.toISOString()
  }).eq("id", input.item.id).eq("user_id", input.input.userId).eq("design_pack_id", input.input.designPackId).eq("status", status).is("generated_asset_id", null);
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
function addCurrentValueGuard(query, column, value) {
  if (value === null || value === void 0) return query.is(column, null);
  return query.eq(column, value);
}

// src/lib/sitePotential/runtimeEnv.ts
function overrideEnv(key) {
  return globalThis.__EASY_ERF_RUNTIME_ENV__?.[key];
}
function denoEnv(key) {
  const runtime = globalThis.Deno;
  if (!runtime?.env) return void 0;
  try {
    return runtime.env.get(key);
  } catch {
    return void 0;
  }
}
function processEnv(key) {
  const runtime = globalThis.process;
  return runtime?.env?.[key];
}
function readServerEnv(key) {
  return overrideEnv(key) ?? denoEnv(key) ?? processEnv(key);
}
function readServerEnvRecord(keys) {
  const snapshot = {};
  for (const key of keys) snapshot[key] = readServerEnv(key);
  return snapshot;
}
var SITE_POTENTIAL_ENV_KEYS = [
  "SITE_POTENTIAL_BETA_ENABLED",
  "SITE_POTENTIAL_BETA_ADMIN_ALLOWLIST",
  "SITE_POTENTIAL_DEV_ENTITLEMENTS",
  "SITE_POTENTIAL_GENERATION_ENABLED",
  "SITE_POTENTIAL_WORKER_ENABLED",
  "SITE_POTENTIAL_WORKER_SECRET",
  "OPENAI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];
function sitePotentialServerEnv() {
  const snapshot = readServerEnvRecord(SITE_POTENTIAL_ENV_KEYS);
  return {
    ...snapshot,
    SUPABASE_PUBLISHABLE_KEY: snapshot.SUPABASE_PUBLISHABLE_KEY ?? readServerEnv("SUPABASE_ANON_KEY")
  };
}

// src/lib/sitePotential/generationSupabaseWorker.ts
async function queueSitePotentialGeneration(input) {
  const { data: pack, error: packError } = await input.serviceSupabase.from("erf_design_packs").select("*").eq("id", input.designPackId).eq("site_project_id", input.siteProjectId).eq("user_id", input.userId).single();
  if (packError || !pack) {
    return { ok: false, status: 404, error: "Design entitlement not found." };
  }
  const designPack = pack;
  if (designPack.entitlement_status !== "paid") {
    return {
      ok: false,
      status: 402,
      error: "Verified payment or test entitlement is required."
    };
  }
  const { error: itemError } = await input.serviceSupabase.from("erf_design_pack_items").upsert(designPackItemRows({ userId: input.userId, designPackId: input.designPackId }), {
    onConflict: "design_pack_id,option_index",
    ignoreDuplicates: true
  });
  if (itemError) throw new Error(itemError.message);
  const items = await readDesignPackItems(input.serviceSupabase, input.designPackId, input.userId);
  const status = designPackStatusFromItems(items);
  if (status.status !== "complete" && status.status !== "generating") {
    const packUpdate = {
      status: status.status,
      next_attempt_at: (/* @__PURE__ */ new Date()).toISOString(),
      ...status.hasRetryableWork ? { failure_code: null, failure_message: null } : {}
    };
    await input.serviceSupabase.from("erf_design_packs").update(packUpdate).eq("id", input.designPackId).eq("user_id", input.userId);
  }
  await input.serviceSupabase.from("erf_site_projects").update({ generation_status: status.status === "complete" ? "concepts_ready" : "generating" }).eq("id", input.siteProjectId).eq("user_id", input.userId);
  return {
    ok: true,
    status: status.status === "complete" ? "complete" : "queued",
    items,
    completedCount: status.completedCount
  };
}
async function readDesignPackItems(serviceSupabase, designPackId, userId) {
  const { data, error } = await serviceSupabase.from("erf_design_pack_items").select("*").eq("design_pack_id", designPackId).eq("user_id", userId).order("option_index", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
function formatQueueStatus(items) {
  const status = designPackStatusFromItems(items);
  return {
    status: status.status,
    completedCount: status.completedCount,
    hasRetryableWork: status.hasRetryableWork,
    terminal: status.terminal,
    requestedCount: SITE_POTENTIAL_PACK_SIZE,
    items: items.map((item) => ({
      id: item.id,
      optionIndex: item.option_index,
      status: item.status,
      generatedAssetId: item.generated_asset_id,
      attemptCount: item.attempt_count,
      failureCode: item.failure_code,
      failureMessage: sanitizedGenerationError(item.failure_message ?? "")
    }))
  };
}

// src/lib/sitePotential/serverAuth.ts
import { createClient } from "@supabase/supabase-js";
var ApiRequestError = class extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
    this.name = "ApiRequestError";
  }
};
function serverSupabaseUrl() {
  const supabaseUrl = readServerEnv("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new ApiRequestError("Supabase server environment is not configured.", 500);
  }
  return supabaseUrl;
}
async function authenticateApiRequest(request) {
  const publishableKey = readServerEnv("SUPABASE_PUBLISHABLE_KEY") ?? readServerEnv("SUPABASE_ANON_KEY");
  if (!publishableKey) {
    throw new ApiRequestError("Supabase server environment is not configured.", 500);
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    throw new ApiRequestError("Sign in is required.", 401);
  }
  const token = authorization.slice("Bearer ".length).trim();
  const supabase = createClient(serverSupabaseUrl(), publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      storage: void 0,
      persistSession: false,
      autoRefreshToken: false
    }
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new ApiRequestError("Sign in is required.", 401);
  return { supabase, user: data.user, token };
}
function createServiceRoleSupabaseClient() {
  const serviceRoleKey = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    throw new ApiRequestError("Trusted Supabase service role is not configured.", 500);
  }
  return createClient(serverSupabaseUrl(), serviceRoleKey, {
    auth: {
      storage: void 0,
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

// src/lib/sitePotential/edgeApiRequest.ts
var SITE_POTENTIAL_EDGE_API_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info"
};
function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...SITE_POTENTIAL_EDGE_API_CORS_HEADERS
    }
  });
}
function methodNotAllowed() {
  return json({ success: false, error: "Method not allowed." }, 405);
}
function runtimeReadiness() {
  return resolveSitePotentialRuntimeReadiness(sitePotentialServerEnv());
}
function isGenerationMode(value) {
  return value === "vacant_land" || value === "renovation" || value === "other_building";
}
async function handleEdgeBetaStatusRequest(request) {
  if (request.method !== "GET") return methodNotAllowed();
  try {
    const runtime = runtimeReadiness();
    if (!runtime.ready) {
      return json(
        {
          success: true,
          enabled: runtime.status !== "GENERATION_DISABLED",
          creditsRemaining: 0,
          canGenerate: false,
          runtimeStatus: runtime.status
        },
        200
      );
    }
    const { user } = await authenticateApiRequest(request);
    const parcelId = new URL(request.url).searchParams.get("parcelId");
    const status = await readSitePotentialAccessStatus({
      serviceSupabase: createServiceRoleSupabaseClient(),
      userId: user.id,
      parcelId
    });
    return json({ success: true, enabled: true, runtimeStatus: runtime.status, ...status }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    console.error("Site Potential beta status failed", error);
    return json({ success: false, error: "Could not read Site Potential access status." }, 500);
  }
}
async function handleEdgeBetaRedeemRequest(request) {
  if (request.method !== "POST") return methodNotAllowed();
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Request body must be valid JSON." }, 400);
  }
  if (!body.parcelId || !body.siteProjectId) {
    return json({ success: false, error: "parcelId and siteProjectId are required." }, 400);
  }
  try {
    const runtime = runtimeReadiness();
    if (!runtime.ready) {
      return json(
        {
          success: false,
          code: runtime.status,
          error: `${sitePotentialRuntimeMessage(runtime.status)} No free allowance or credit has been used.`
        },
        runtime.status === "GENERATION_DISABLED" ? 403 : 503
      );
    }
    const { supabase, user } = await authenticateApiRequest(request);
    const serviceSupabase = createServiceRoleSupabaseClient();
    const { data: project, error: projectError } = await supabase.from("erf_site_projects").select("*").eq("id", body.siteProjectId).eq("parcel_id", body.parcelId).eq("user_id", user.id).single();
    if (projectError || !project) {
      return json({ success: false, error: "Site Potential project not found." }, 404);
    }
    if (!isGenerationMode(project.mode) || project.mode === "other_building") {
      return json(
        { success: false, error: "Choose a Site Potential mode before generating." },
        400
      );
    }
    if (project.mode === "renovation" && !project.rights_confirmed_at) {
      return json(
        { success: false, error: "Confirm image rights before generating renovation concepts." },
        400
      );
    }
    const { data: inputAssets, error: assetsError } = await serviceSupabase.from("erf_assets").select("*").eq("user_id", user.id).eq("parcel_id", body.parcelId).neq("status", "deleted");
    if (assetsError) throw new Error(assetsError.message);
    const sourceAssets = sourceAssetsForGenerationMode(
      project.mode,
      inputAssets ?? []
    );
    if (project.mode === "renovation" && !sourceAssets.some((asset) => asset.asset_category === "existing_house_photo")) {
      return json(
        { success: false, error: "Upload at least one permitted property photo first." },
        400
      );
    }
    const entitlement = await consumeSitePotentialEntitlement({
      serviceSupabase,
      userId: user.id,
      parcelId: body.parcelId,
      siteProjectId: body.siteProjectId,
      requestId: body.requestId || crypto.randomUUID()
    });
    if (!entitlement.ok) {
      return json({ success: false, error: entitlement.error }, entitlement.status);
    }
    const queued = await queueSitePotentialGeneration({
      serviceSupabase,
      userId: user.id,
      parcelId: body.parcelId,
      siteProjectId: body.siteProjectId,
      designPackId: entitlement.designPackId
    });
    if (!queued.ok) return json({ success: false, error: queued.error }, queued.status);
    return json(
      {
        success: true,
        accepted: queued.status !== "complete",
        durableJobQueued: queued.status !== "complete",
        paymentProvider: entitlement.entitlementSource,
        designPackId: entitlement.designPackId,
        creditsRemaining: entitlement.betaCreditsRemaining,
        betaCreditsRemaining: entitlement.betaCreditsRemaining,
        purchasedCreditsRemaining: entitlement.purchasedCreditsRemaining,
        message: queued.status === "complete" ? "Concept pack is already complete." : "Three independent property concepts have been queued for generation.",
        ...formatQueueStatus(queued.items)
      },
      queued.status === "complete" ? 200 : 202
    );
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    console.error("Site Potential beta redemption failed", error);
    return json({ success: false, error: "Beta credit redemption failed." }, 500);
  }
}
async function handleEdgePackStatusRequest(request) {
  if (request.method !== "GET") return methodNotAllowed();
  const url = new URL(request.url);
  const parcelId = url.searchParams.get("parcelId");
  const siteProjectId = url.searchParams.get("siteProjectId");
  const designPackId = url.searchParams.get("designPackId");
  if (!parcelId || !siteProjectId) {
    return json({ success: false, error: "parcelId and siteProjectId are required." }, 400);
  }
  try {
    const { user } = await authenticateApiRequest(request);
    const result = await readSitePotentialPackStatus({
      serviceSupabase: createServiceRoleSupabaseClient(),
      userId: user.id,
      parcelId,
      siteProjectId,
      designPackId
    });
    if (!result.ok) return json({ success: false, error: result.error }, result.status);
    return json({ success: true, ...result.pack }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    console.error("Site Potential pack status failed", error);
    return json({ success: false, error: "Could not read Site Potential pack status." }, 500);
  }
}
async function handleEdgeRetryPackRequest(request) {
  if (request.method !== "POST") return methodNotAllowed();
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Request body must be valid JSON." }, 400);
  }
  if (!body.parcelId || !body.siteProjectId || !body.designPackId) {
    return json(
      { success: false, error: "parcelId, siteProjectId and designPackId are required." },
      400
    );
  }
  try {
    const { user } = await authenticateApiRequest(request);
    const result = await retrySitePotentialPack({
      serviceSupabase: createServiceRoleSupabaseClient(),
      userId: user.id,
      parcelId: body.parcelId,
      siteProjectId: body.siteProjectId,
      designPackId: body.designPackId
    });
    if (!result.ok) return json({ success: false, error: result.error }, result.status);
    return json({ success: true, retried: result.retried, ...result.pack }, 200);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    console.error("Site Potential retry failed", error);
    return json({ success: false, error: "Could not retry Site Potential generation." }, 500);
  }
}
async function handleSitePotentialEdgeApiRequest(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: SITE_POTENTIAL_EDGE_API_CORS_HEADERS
    });
  }
  const path = new URL(request.url).pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  switch (path) {
    case "beta-status":
      return handleEdgeBetaStatusRequest(request);
    case "beta-redeem":
      return handleEdgeBetaRedeemRequest(request);
    case "pack-status":
      return handleEdgePackStatusRequest(request);
    case "retry-pack":
      return handleEdgeRetryPackRequest(request);
    default:
      return json({ success: false, error: "Site Potential endpoint not found." }, 404);
  }
}
export {
  SITE_POTENTIAL_EDGE_API_CORS_HEADERS,
  handleEdgeBetaRedeemRequest,
  handleEdgeBetaStatusRequest,
  handleEdgePackStatusRequest,
  handleEdgeRetryPackRequest,
  handleSitePotentialEdgeApiRequest
};
