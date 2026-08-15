import {
  sitePotentialRuntimeMessage,
  type SitePotentialRuntimeStatus,
} from "./betaEntitlements";
import { buildSitePotentialApiRequest } from "./sitePotentialApiClient";

export type AllowanceStatusLifecycle = "loading" | "ready" | "error";

export interface BetaCreditUiStatus {
  enabled: boolean;
  creditsRemaining: number;
  betaCreditsRemaining?: number;
  purchasedCredits?: number;
  freeEligible?: boolean;
  canGenerate?: boolean;
  nextEntitlementSource?: string | null;
  free?: {
    used24Hours: number;
    used7Days: number;
    used30Days: number;
    remaining24Hours: number;
    remaining7Days: number;
    remaining30Days: number;
  };
  openRequestStatus?: string | null;
  runtimeStatus?: SitePotentialRuntimeStatus;
}

export type SitePotentialGenerationAvailabilityStatus =
  | "CHECKING"
  | "UI_DISABLED"
  | "SIGNED_OUT"
  | "ENTITLEMENT_UNAVAILABLE"
  | "STATUS_UNAVAILABLE"
  | SitePotentialRuntimeStatus;

export interface SitePotentialGenerationAvailability {
  status: SitePotentialGenerationAvailabilityStatus;
  message: string;
  canGenerate: boolean;
}

export type BetaStatusRequestResult =
  | { kind: "ready"; status: BetaCreditUiStatus }
  | { kind: "signed_out"; message: string }
  | { kind: "error"; message: string }
  | { kind: "stale" };

interface LoadParcelBetaStatusOptions {
  parcelId: string;
  signal?: AbortSignal;
  getSession: () => Promise<{ data: { session: { access_token?: string | null } | null } }>;
  fetchImpl: typeof fetch;
  isCurrentRequest: () => boolean;
}

export const SITE_POTENTIAL_ALLOWANCE_SIGN_IN_MESSAGE =
  "Sign in to check Site Potential allowance.";

export const SITE_POTENTIAL_ALLOWANCE_ERROR_MESSAGE =
  "Could not check Site Potential allowance.";

export function resolveSitePotentialGenerationAvailability(input: {
  uiEnabled: boolean;
  lifecycle: AllowanceStatusLifecycle;
  status: BetaCreditUiStatus | null;
  error?: string | null;
}): SitePotentialGenerationAvailability {
  if (!input.uiEnabled) {
    return {
      status: "UI_DISABLED",
      message: "AI concept generation is not enabled on this deployment yet.",
      canGenerate: false,
    };
  }
  if (input.lifecycle === "loading") {
    return { status: "CHECKING", message: "Checking availability…", canGenerate: false };
  }
  if (input.lifecycle === "error") {
    if (input.error === SITE_POTENTIAL_ALLOWANCE_SIGN_IN_MESSAGE) {
      return { status: "SIGNED_OUT", message: input.error, canGenerate: false };
    }
    return {
      status: "STATUS_UNAVAILABLE",
      message: input.error || SITE_POTENTIAL_ALLOWANCE_ERROR_MESSAGE,
      canGenerate: false,
    };
  }
  const runtimeStatus = input.status?.runtimeStatus;
  if (runtimeStatus && runtimeStatus !== "READY") {
    return {
      status: runtimeStatus,
      message: sitePotentialRuntimeMessage(runtimeStatus),
      canGenerate: false,
    };
  }
  if (!input.status?.enabled || !input.status?.canGenerate) {
    return {
      status: "ENTITLEMENT_UNAVAILABLE",
      message: sitePotentialGenerationUnavailableReason(input.status),
      canGenerate: false,
    };
  }
  return {
    status: "READY",
    message: sitePotentialRuntimeMessage("READY"),
    canGenerate: true,
  };
}

export function sitePotentialGenerationUnavailableReason(status: BetaCreditUiStatus | null) {
  if (status?.runtimeStatus && status.runtimeStatus !== "READY") {
    return sitePotentialRuntimeMessage(status.runtimeStatus);
  }
  if (!status?.enabled) return "Site Potential generation is disabled in this environment.";
  if (status.canGenerate || status.freeEligible) return "Generation is available from the free allowance.";
  if (status.free && status.free.remaining24Hours <= 0) return "Daily free allowance used.";
  if (status.free && status.free.remaining7Days <= 0) return "Weekly free allowance used.";
  if (status.free && status.free.remaining30Days <= 0) return "Monthly free allowance used.";
  if ((status.purchasedCredits ?? 0) <= 0 && (status.betaCreditsRemaining ?? 0) <= 0) {
    return "No purchased or beta/test credits are available.";
  }
  return "Generation is unavailable for this erf right now.";
}

export async function loadParcelBetaStatus({
  parcelId,
  signal,
  getSession,
  fetchImpl,
  isCurrentRequest,
}: LoadParcelBetaStatusOptions): Promise<BetaStatusRequestResult> {
  try {
    const { data } = await getSession();
    if (!isCurrentRequest()) return { kind: "stale" };

    const token = data.session?.access_token;
    if (!token) {
      return {
        kind: "signed_out",
        message: SITE_POTENTIAL_ALLOWANCE_SIGN_IN_MESSAGE,
      };
    }

    const request = buildSitePotentialApiRequest({
      route: "beta-status",
      token,
      searchParams: new URLSearchParams({ parcelId }),
      init: { signal },
    });
    const response = await fetchImpl(request.url, request.init);
    if (!isCurrentRequest()) return { kind: "stale" };

    const payload = await response.json().catch(() => null);
    if (!isCurrentRequest()) return { kind: "stale" };

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || SITE_POTENTIAL_ALLOWANCE_ERROR_MESSAGE);
    }

    return {
      kind: "ready",
      status: {
        enabled: Boolean(payload.enabled),
        creditsRemaining: Number(payload.creditsRemaining ?? 0),
        betaCreditsRemaining: Number(payload.betaCreditsRemaining ?? payload.creditsRemaining ?? 0),
        purchasedCredits: Number(payload.purchasedCredits ?? 0),
        freeEligible: Boolean(payload.freeEligible),
        canGenerate: Boolean(payload.canGenerate),
        nextEntitlementSource: payload.nextEntitlementSource ?? null,
        free: payload.free ?? undefined,
        openRequestStatus: payload.openRequestStatus ?? null,
        runtimeStatus:
          payload.runtimeStatus === "READY" ||
          payload.runtimeStatus === "GENERATION_DISABLED" ||
          payload.runtimeStatus === "WORKER_DISABLED" ||
          payload.runtimeStatus === "SERVER_CONFIGURATION_ERROR" ||
          payload.runtimeStatus === "PROVIDER_UNAVAILABLE"
            ? payload.runtimeStatus
            : payload.enabled
              ? "READY"
              : "GENERATION_DISABLED",
      },
    };
  } catch (error) {
    if (signal?.aborted || !isCurrentRequest()) return { kind: "stale" };
    return {
      kind: "error",
      message: SITE_POTENTIAL_ALLOWANCE_ERROR_MESSAGE,
    };
  }
}
