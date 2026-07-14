export interface BetaCreditStatus {
  enabled: boolean;
  creditsRemaining: number;
  openRequestStatus: string | null;
}

export function isSitePotentialBetaEnabled(
  env: Pick<NodeJS.ProcessEnv, "SITE_POTENTIAL_BETA_ENABLED">,
) {
  return env.SITE_POTENTIAL_BETA_ENABLED === "true";
}

export function isSitePotentialBetaGenerationReady(
  env: Pick<
    NodeJS.ProcessEnv,
    | "SITE_POTENTIAL_BETA_ENABLED"
    | "SITE_POTENTIAL_WORKER_ENABLED"
    | "SITE_POTENTIAL_WORKER_SECRET"
    | "OPENAI_API_KEY"
    | "SUPABASE_SERVICE_ROLE_KEY"
  >,
) {
  return (
    isSitePotentialBetaEnabled(env) &&
    env.SITE_POTENTIAL_WORKER_ENABLED === "true" &&
    Boolean(env.SITE_POTENTIAL_WORKER_SECRET) &&
    Boolean(env.OPENAI_API_KEY) &&
    Boolean(env.SUPABASE_SERVICE_ROLE_KEY)
  );
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
