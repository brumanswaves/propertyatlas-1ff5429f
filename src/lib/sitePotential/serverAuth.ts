import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new ApiRequestError("Supabase server environment is not configured.", 500);
  }
  return supabaseUrl;
}

export async function authenticateApiRequest(request: Request) {
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new ApiRequestError("Supabase server environment is not configured.", 500);
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    throw new ApiRequestError("Sign in is required.", 401);
  }
  const token = authorization.slice("Bearer ".length).trim();
  const supabase = createClient<Database>(serverSupabaseUrl(), publishableKey, {
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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new ApiRequestError("Trusted Supabase service role is not configured.", 500);
  }
  return createClient<Database>(serverSupabaseUrl(), serviceRoleKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function isDevelopmentEntitlementAllowed(
  env: Pick<
    NodeJS.ProcessEnv,
    "NODE_ENV" | "SITE_POTENTIAL_DEV_ENTITLEMENTS" | "SITE_POTENTIAL_DEV_ADMIN_ALLOWLIST"
  >,
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
