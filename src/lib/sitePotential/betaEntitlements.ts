export interface BetaCreditStatus {
  enabled: boolean;
  creditsRemaining: number;
  openRequestStatus: string | null;
}

/**
 * Safe, public readiness information for the entitlement UI. These codes
 * deliberately describe capability rather than exposing configuration values.
 */
export type SitePotentialRuntimeStatus =
  | "READY"
  | "GENERATION_DISABLED"
  | "WORKER_DISABLED"
  | "SERVER_CONFIGURATION_ERROR"
  | "PROVIDER_UNAVAILABLE";

export interface SitePotentialRuntimeReadiness {
  status: SitePotentialRuntimeStatus;
  ready: boolean;
}

type SitePotentialRuntimeEnvironment = Partial<
  Record<
    | "SITE_POTENTIAL_BETA_ENABLED"
    | "SITE_POTENTIAL_WORKER_ENABLED"
    | "SITE_POTENTIAL_WORKER_SECRET"
    | "OPENAI_API_KEY"
    | "SUPABASE_URL"
    | "SUPABASE_PUBLISHABLE_KEY"
    | "SUPABASE_SERVICE_ROLE_KEY",
    string | undefined
  >
>;

export function sitePotentialRuntimeMessage(status: SitePotentialRuntimeStatus) {
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

export function isSitePotentialBetaEnabled(
  env: Pick<NodeJS.ProcessEnv, "SITE_POTENTIAL_BETA_ENABLED">,
) {
  return env.SITE_POTENTIAL_BETA_ENABLED === "true";
}

export function resolveSitePotentialRuntimeReadiness(
  env: SitePotentialRuntimeEnvironment,
): SitePotentialRuntimeReadiness {
  if (!isSitePotentialBetaEnabled(env)) {
    return { status: "GENERATION_DISABLED", ready: false };
  }
  if (env.SITE_POTENTIAL_WORKER_ENABLED !== "true") {
    return { status: "WORKER_DISABLED", ready: false };
  }
  if (
    !env.SITE_POTENTIAL_WORKER_SECRET ||
    !env.OPENAI_API_KEY ||
    !env.SUPABASE_URL ||
    !env.SUPABASE_PUBLISHABLE_KEY ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return { status: "SERVER_CONFIGURATION_ERROR", ready: false };
  }
  return { status: "READY", ready: true };
}

export function isSitePotentialBetaGenerationReady(
  env: SitePotentialRuntimeEnvironment,
) {
  return resolveSitePotentialRuntimeReadiness(env).ready;
}

export function isBetaAdminAllowed(
  env: Pick<
    NodeJS.ProcessEnv,
    "SITE_POTENTIAL_BETA_ENABLED" | "SITE_POTENTIAL_BETA_ADMIN_ALLOWLIST"
  >,
  user: { id: string; email?: string | null },
) {
  if (!isSitePotentialBetaEnabled(env)) {
    return { allowed: false, reason: "Site Potential beta access is disabled." };
  }
  const allowlist = String(env.SITE_POTENTIAL_BETA_ADMIN_ALLOWLIST ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!allowlist.length) {
    return { allowed: false, reason: "No beta administrators are configured." };
  }
  const email = String(user.email ?? "").toLowerCase();
  const id = user.id.toLowerCase();
  const allowed = allowlist.includes(email) || allowlist.includes(id);
  return {
    allowed,
    reason: allowed ? null : "This account is not allowed to grant beta credits.",
  };
}

export function betaIdempotencyPrefix(input: {
  userId: string;
  parcelId: string;
  siteProjectId: string;
}) {
  return `beta:${input.userId}:${input.parcelId}:${input.siteProjectId}`;
}
