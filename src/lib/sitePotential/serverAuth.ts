import { createClient } from "@supabase/supabase-js";
import { readServerEnv } from "./runtimeEnv";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function serverSupabaseUrl() {
  const supabaseUrl = readServerEnv("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new ApiRequestError("Supabase server environment is not configured.", 500);
  }
  return supabaseUrl;
}

export async function authenticateApiRequest(request: Request) {
  const publishableKey =
    readServerEnv("SUPABASE_PUBLISHABLE_KEY") ?? readServerEnv("SUPABASE_ANON_KEY");
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
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new ApiRequestError("Sign in is required.", 401);
  return { supabase, user: data.user, token };
}

export function createServiceRoleSupabaseClient() {
  const serviceRoleKey = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    throw new ApiRequestError("Trusted Supabase service role is not configured.", 500);
  }
  return createClient(serverSupabaseUrl(), serviceRoleKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

type DevelopmentEntitlementEnv = {
  NODE_ENV?: string;
  SITE_POTENTIAL_DEV_ENTITLEMENTS?: string;
  SITE_POTENTIAL_DEV_ADMIN_ALLOWLIST?: string;
};

export function isDevelopmentEntitlementAllowed(
  env: DevelopmentEntitlementEnv,
  user: { id: string; email?: string | null },
) {
  if (env.NODE_ENV === "production") {
    return { allowed: false, reason: "Development entitlement is disabled in production." };
  }
  if (env.SITE_POTENTIAL_DEV_ENTITLEMENTS !== "true") {
    return { allowed: false, reason: "Development entitlement is disabled in this environment." };
  }
  const allowlist = String(env.SITE_POTENTIAL_DEV_ADMIN_ALLOWLIST ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!allowlist.length) return { allowed: true, reason: null };
  const email = String(user.email ?? "").toLowerCase();
  const id = user.id.toLowerCase();
  const allowed = allowlist.includes(email) || allowlist.includes(id);
  return {
    allowed,
    reason: allowed ? null : "This account is not allowed to grant development entitlements.",
  };
}
