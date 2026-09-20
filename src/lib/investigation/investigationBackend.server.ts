import { founderSupportBackendConfig } from "@/lib/admin/founderSupportServer";
import { authenticateApiRequest, createServiceRoleSupabaseClient, type ServerSupabaseConfig } from "@/lib/sitePotential/serverAuth";
import { readServerEnv } from "@/lib/sitePotential/runtimeEnv";

interface InvestigationBackendOverrides {
  authenticate?: typeof authenticateApiRequest;
  serviceClient?: typeof createServiceRoleSupabaseClient;
  env?: typeof readServerEnv;
}

/** One validated credential set for this request, including downstream functions. */
export function investigationBackend(overrides: InvestigationBackendOverrides = {}) {
  let config: ServerSupabaseConfig | undefined;
  const selected = () => config ??= founderSupportBackendConfig();
  return {
    authenticate: overrides.authenticate ?? (async (request: Request) => authenticateApiRequest(request, selected())),
    serviceClient: overrides.serviceClient ?? (() => createServiceRoleSupabaseClient(selected())),
    env: overrides.env ?? ((name: string) => {
      if (name === "SUPABASE_URL") return selected().url;
      if (name === "SUPABASE_PUBLISHABLE_KEY" || name === "SUPABASE_ANON_KEY") return selected().publishableKey;
      if (name === "SUPABASE_SERVICE_ROLE_KEY") return selected().serviceRoleKey;
      return readServerEnv(name);
    }),
  };
}
