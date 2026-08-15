import { ApiRequestError } from "@/lib/sitePotential/serverAuth";
import { authenticateFounderSupportRequest } from "./founderSupportServer";
import type { FounderOperationsSitePotentialJob } from "./founderSupportTypes";

function nullableString(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function readFounderOperationsJobs(request: Request) {
  const { serviceSupabase } = await authenticateFounderSupportRequest(request);
  const { data: packs, error } = await serviceSupabase
    .from("erf_design_packs")
    .select(
      "id,user_id,parcel_id,site_project_id,payment_provider,entitlement_status,status,requested_count,completed_count,failure_code,failure_message,next_attempt_at,heartbeat_at,created_at,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) throw new ApiRequestError("Could not load Site Potential jobs.", 500);

  const userIds = [...new Set((packs ?? []).map((pack) => String(pack.user_id)))];
  const userLabels = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await serviceSupabase
      .from("profiles")
      .select("id,email,full_name")
      .in("id", userIds)
      .limit(100);
    for (const profile of profiles ?? []) {
      const id = String(profile.id);
      const label = nullableString(profile.full_name) ?? nullableString(profile.email) ?? id;
      userLabels.set(id, label);
    }
  }

  return (packs ?? []).map((pack): FounderOperationsSitePotentialJob => {
    const userId = String(pack.user_id);
    return {
      designPackId: String(pack.id),
      userId,
      userLabel: userLabels.get(userId) ?? null,
      parcelId: String(pack.parcel_id),
      siteProjectId: String(pack.site_project_id),
      provider: nullableString(pack.payment_provider),
      entitlementStatus: String(pack.entitlement_status),
      status: String(pack.status),
      requestedCount: numberValue(pack.requested_count),
      completedCount: numberValue(pack.completed_count),
      failureCode: nullableString(pack.failure_code),
      failureMessage: nullableString(pack.failure_message),
      nextAttemptAt: nullableString(pack.next_attempt_at),
      workerHeartbeatAt: nullableString(pack.heartbeat_at),
      createdAt: String(pack.created_at),
      updatedAt: String(pack.updated_at),
    };
  });
}
