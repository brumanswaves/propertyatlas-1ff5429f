import { ApiRequestError, authenticateApiRequest, createServiceRoleSupabaseClient } from "@/lib/sitePotential/serverAuth";
import { readSavedInvestigationProjection } from "@/lib/workbench/savedInvestigationProjection";
import type {
  FounderSupportAssetSummary,
  FounderSupportBetaCreditGrant,
  FounderSupportDesignPackSummary,
  FounderSupportProviderEventSummary,
  FounderSupportReportOrderSummary,
  FounderSupportSavedProperty,
  FounderSupportSitePotentialSummary,
  FounderSupportUserDetail,
  FounderSupportUserSummary,
} from "./founderSupportTypes";

const PROFILE_FIELDS = "id,email,full_name,account_type,created_at,updated_at";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableString(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function propertyField(userData: unknown, ...keys: string[]) {
  const record = asRecord(userData);
  if (!record) return null;
  for (const key of keys) {
    const value = nullableString(record[key]);
    if (value) return value;
  }
  return null;
}

function propertyTitle(parcelId: string, userData: unknown) {
  return (
    propertyField(userData, "displayTitle", "address", "researchQuery") ??
    (propertyField(userData, "erfNumber", "erf")
      ? `Erf ${propertyField(userData, "erfNumber", "erf")}`
      : parcelId)
  );
}

function safeSearchTerm(value: string) {
  return value
    .trim()
    .replace(/[%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function profileSummary(
  profile: Record<string, unknown>,
  savedPropertyCount = 0,
  reportOrderCount = 0,
): FounderSupportUserSummary {
  return {
    id: String(profile.id ?? ""),
    email: nullableString(profile.email),
    fullName: nullableString(profile.full_name),
    accountType: nullableString(profile.account_type),
    createdAt: nullableString(profile.created_at),
    updatedAt: nullableString(profile.updated_at),
    savedPropertyCount,
    reportOrderCount,
  };
}

export async function authenticateFounderSupportRequest(request: Request) {
  const { user } = await authenticateApiRequest(request);
  const serviceSupabase = createServiceRoleSupabaseClient();
  const { data: adminRole, error } = await serviceSupabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (error) throw new ApiRequestError("Could not verify Founder Operations access.", 500);
  if (!adminRole) throw new ApiRequestError("Founder Operations access is required.", 403);

  return { actor: user, serviceSupabase };
}

export async function searchFounderSupportUsers(request: Request, rawQuery: string) {
  const { serviceSupabase } = await authenticateFounderSupportRequest(request);
  const query = safeSearchTerm(rawQuery);
  if (!query) return [] as FounderSupportUserSummary[];
  if (!UUID_PATTERN.test(query) && query.length < 2) {
    throw new ApiRequestError("Enter at least 2 characters to search users.", 400);
  }

  const profiles = new Map<string, Record<string, unknown>>();

  if (UUID_PATTERN.test(query)) {
    const { data, error } = await serviceSupabase
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("id", query)
      .limit(1);
    if (error) throw new ApiRequestError("Could not search Easy Erf users.", 500);
    for (const row of data ?? []) profiles.set(String(row.id), row as Record<string, unknown>);
  } else {
    const pattern = `%${query}%`;
    const [emailResult, nameResult] = await Promise.all([
      serviceSupabase
        .from("profiles")
        .select(PROFILE_FIELDS)
        .ilike("email", pattern)
        .order("updated_at", { ascending: false })
        .limit(15),
      serviceSupabase
        .from("profiles")
        .select(PROFILE_FIELDS)
        .ilike("full_name", pattern)
        .order("updated_at", { ascending: false })
        .limit(15),
    ]);
    if (emailResult.error || nameResult.error) {
      throw new ApiRequestError("Could not search Easy Erf users.", 500);
    }
    for (const row of [...(emailResult.data ?? []), ...(nameResult.data ?? [])]) {
      profiles.set(String(row.id), row as Record<string, unknown>);
    }
  }

  const ids = [...profiles.keys()].slice(0, 20);
  if (!ids.length) return [];

  const [savedResult, orderResult] = await Promise.all([
    serviceSupabase.from("saved_properties").select("user_id").in("user_id", ids).limit(1000),
    serviceSupabase.from("report_orders").select("user_id").in("user_id", ids).limit(1000),
  ]);
  if (savedResult.error || orderResult.error) {
    throw new ApiRequestError("Could not summarize Easy Erf user activity.", 500);
  }

  const savedCounts = new Map<string, number>();
  for (const row of savedResult.data ?? []) {
    savedCounts.set(String(row.user_id), (savedCounts.get(String(row.user_id)) ?? 0) + 1);
  }
  const orderCounts = new Map<string, number>();
  for (const row of orderResult.data ?? []) {
    orderCounts.set(String(row.user_id), (orderCounts.get(String(row.user_id)) ?? 0) + 1);
  }

  return ids.map((id) => profileSummary(profiles.get(id)!, savedCounts.get(id) ?? 0, orderCounts.get(id) ?? 0));
}

export async function readFounderSupportUser(request: Request, targetUserId: string) {
  if (!UUID_PATTERN.test(targetUserId)) throw new ApiRequestError("A valid user id is required.", 400);
  const { serviceSupabase } = await authenticateFounderSupportRequest(request);

  const [
    profileResult,
    savedResult,
    assetResult,
    siteResult,
    packResult,
    walletResult,
    betaCreditsResult,
    orderResult,
    providerResult,
  ] = await Promise.all([
    serviceSupabase.from("profiles").select(PROFILE_FIELDS).eq("id", targetUserId).maybeSingle(),
    serviceSupabase
      .from("saved_properties")
      .select("parcel_id,created_at,research_status,status,tags,user_data")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(60),
    serviceSupabase
      .from("erf_assets")
      .select("id,parcel_id,asset_category,asset_type,source_label,original_file_name,mime_type,status,created_at,updated_at")
      .eq("user_id", targetUserId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(80),
    serviceSupabase
      .from("erf_site_projects")
      .select("id,parcel_id,mode,generation_status,selected_design_asset_id,updated_at")
      .eq("user_id", targetUserId)
      .order("updated_at", { ascending: false })
      .limit(40),
    serviceSupabase
      .from("erf_design_packs")
      .select("id,parcel_id,site_project_id,entitlement_status,status,requested_count,completed_count,failure_code,failure_message,created_at,updated_at")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(40),
    serviceSupabase
      .from("site_potential_credit_wallets")
      .select("balance,lifetime_purchased,lifetime_consumed")
      .eq("user_id", targetUserId)
      .maybeSingle(),
    serviceSupabase
      .from("site_potential_beta_credits")
      .select("id,credits_granted,credits_used,granted_by,reason,expires_at,created_at")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(50),
    serviceSupabase
      .from("report_orders")
      .select("id,parcel_id,report_type,provider_id,status,status_enum,price_cents,failure_reason,created_at,updated_at")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(50),
    serviceSupabase
      .from("provider_audit_log")
      .select("id,provider,action,resource_id,status,error_code,latency_ms,at")
      .eq("user_id", targetUserId)
      .order("at", { ascending: false })
      .limit(60),
  ]);

  const failure = [
    profileResult.error,
    savedResult.error,
    assetResult.error,
    siteResult.error,
    packResult.error,
    walletResult.error,
    betaCreditsResult.error,
    orderResult.error,
    providerResult.error,
  ].find(Boolean);
  if (failure) throw new ApiRequestError("Could not load this Easy Erf support record.", 500);
  if (!profileResult.data) throw new ApiRequestError("Easy Erf user not found.", 404);

  const grantActorIds = [
    ...new Set(
      (betaCreditsResult.data ?? [])
        .map((row) => nullableString(row.granted_by))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const grantActorLabels = new Map<string, string>();
  if (grantActorIds.length) {
    const { data: actorProfiles } = await serviceSupabase
      .from("profiles")
      .select("id,email,full_name")
      .in("id", grantActorIds)
      .limit(50);
    for (const profile of actorProfiles ?? []) {
      const id = String(profile.id);
      const label = nullableString(profile.full_name) ?? nullableString(profile.email) ?? id;
      grantActorLabels.set(id, label);
    }
  }

  const savedProperties: FounderSupportSavedProperty[] = (savedResult.data ?? []).map((row) => ({
    parcelId: String(row.parcel_id),
    title: propertyTitle(String(row.parcel_id), row.user_data),
    erfNumber: propertyField(row.user_data, "erfNumber", "erf"),
    portion: propertyField(row.user_data, "portion"),
    municipality: propertyField(row.user_data, "municipality", "town", "majorRegion"),
    province: propertyField(row.user_data, "province"),
    researchStatus: nullableString(row.research_status),
    status: nullableString(row.status),
    createdAt: nullableString(row.created_at),
    investigation: readSavedInvestigationProjection(row.user_data),
  }));

  const assets: FounderSupportAssetSummary[] = (assetResult.data ?? []).map((row) => ({
    id: String(row.id),
    parcelId: String(row.parcel_id),
    category: String(row.asset_category),
    type: String(row.asset_type),
    sourceLabel: nullableString(row.source_label),
    fileName: String(row.original_file_name),
    mimeType: String(row.mime_type),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));

  const sitePotentialProjects: FounderSupportSitePotentialSummary[] = (siteResult.data ?? []).map((row) => ({
    id: String(row.id),
    parcelId: String(row.parcel_id),
    mode: String(row.mode),
    generationStatus: String(row.generation_status),
    selectedDesignAssetId: nullableString(row.selected_design_asset_id),
    updatedAt: String(row.updated_at),
  }));

  const designPacks: FounderSupportDesignPackSummary[] = (packResult.data ?? []).map((row) => ({
    id: String(row.id),
    parcelId: String(row.parcel_id),
    siteProjectId: String(row.site_project_id),
    entitlementStatus: String(row.entitlement_status),
    status: String(row.status),
    requestedCount: numberValue(row.requested_count),
    completedCount: numberValue(row.completed_count),
    failureCode: nullableString(row.failure_code),
    failureMessage: nullableString(row.failure_message),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));

  const reportOrders: FounderSupportReportOrderSummary[] = (orderResult.data ?? []).map((row) => ({
    id: String(row.id),
    parcelId: String(row.parcel_id),
    reportType: String(row.report_type),
    providerId: nullableString(row.provider_id),
    status: String(row.status_enum ?? row.status ?? "unknown"),
    priceCents: numberValue(row.price_cents),
    failureReason: nullableString(row.failure_reason),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));

  const providerEvents: FounderSupportProviderEventSummary[] = (providerResult.data ?? []).map((row) => ({
    id: String(row.id),
    provider: String(row.provider),
    action: String(row.action),
    resourceId: nullableString(row.resource_id),
    status: String(row.status),
    errorCode: nullableString(row.error_code),
    latencyMs: row.latency_ms == null ? null : numberValue(row.latency_ms),
    at: String(row.at),
  }));

  const now = Date.now();
  const betaCreditGrants: FounderSupportBetaCreditGrant[] = (betaCreditsResult.data ?? []).map((row) => {
    const grantedBy = nullableString(row.granted_by);
    const expiresAt = nullableString(row.expires_at);
    const creditsGranted = numberValue(row.credits_granted);
    const creditsUsed = numberValue(row.credits_used);
    return {
      id: String(row.id),
      creditsGranted,
      creditsUsed,
      remainingCredits: Math.max(0, creditsGranted - creditsUsed),
      grantedBy,
      grantedByLabel: grantedBy ? (grantActorLabels.get(grantedBy) ?? grantedBy) : null,
      reason: nullableString(row.reason),
      expiresAt,
      createdAt: String(row.created_at),
      isExpired: Boolean(expiresAt && new Date(expiresAt).getTime() <= now),
    };
  });
  const activeBetaCredits = betaCreditGrants.reduce(
    (total, grant) => total + (grant.isExpired ? 0 : grant.remainingCredits),
    0,
  );

  const detail: FounderSupportUserDetail = {
    user: profileSummary(profileResult.data as Record<string, unknown>, savedProperties.length, reportOrders.length),
    savedProperties,
    assets,
    sitePotentialProjects,
    designPacks,
    entitlements: {
      purchasedCredits: walletResult.data
        ? {
            balance: numberValue(walletResult.data.balance),
            lifetimePurchased: numberValue(walletResult.data.lifetime_purchased),
            lifetimeConsumed: numberValue(walletResult.data.lifetime_consumed),
          }
        : null,
      activeBetaCredits,
      betaCreditGrants,
    },
    reportOrders,
    providerEvents,
  };

  return detail;
}
