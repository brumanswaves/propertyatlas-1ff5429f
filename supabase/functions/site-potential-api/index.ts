import postgres from "npm:postgres@3.4.7";
import { handleSitePotentialEdgeApiRequest } from "https://raw.githubusercontent.com/brumanswaves/propertyatlas-1ff5429f/66640ce499f5be9bab1385e2edb8fb6c29b5b083/supabase/functions/site-potential-api/handler.bundle.mjs";
import { pinLatestPaidDesignPackRequest } from "./latestPaidPack.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

type RuntimeGlobal = typeof globalThis & {
  __EASY_ERF_RUNTIME_ENV__?: Record<string, string | undefined>;
};

class StartupError extends Error {
  constructor(public readonly code: "RUNTIME_ENV" | "VAULT_LOAD") {
    super(code);
    this.name = "StartupError";
  }
}

function openRuntimeDatabase(dbUrl: string) {
  return postgres(dbUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 8,
    idle_timeout: 2,
  });
}

async function loadRuntimeConfiguration() {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) throw new StartupError("RUNTIME_ENV");

  const sql = openRuntimeDatabase(dbUrl);

  try {
    try {
      const rows = await sql`
        select name, decrypted_secret
        from vault.decrypted_secrets
        where name in (
          'easy_erf_openai_api_key',
          'easy_erf_site_potential_beta_admin_allowlist',
          'easy_erf_site_potential_beta_enabled',
          'easy_erf_site_potential_dev_entitlements',
          'easy_erf_site_potential_generation_enabled',
          'easy_erf_site_potential_worker_enabled',
          'easy_erf_site_potential_worker_secret'
        )
      `;
      const values = new Map(
        rows.map((row) => [String(row.name), String(row.decrypted_secret ?? "")]),
      );
      const runtime: Record<string, string | undefined> = {
        NODE_ENV: "production",
      };
      const mappings = [
        ["easy_erf_openai_api_key", "OPENAI_API_KEY"],
        ["easy_erf_site_potential_beta_admin_allowlist", "SITE_POTENTIAL_BETA_ADMIN_ALLOWLIST"],
        ["easy_erf_site_potential_beta_enabled", "SITE_POTENTIAL_BETA_ENABLED"],
        ["easy_erf_site_potential_dev_entitlements", "SITE_POTENTIAL_DEV_ENTITLEMENTS"],
        ["easy_erf_site_potential_generation_enabled", "SITE_POTENTIAL_GENERATION_ENABLED"],
        ["easy_erf_site_potential_worker_enabled", "SITE_POTENTIAL_WORKER_ENABLED"],
        ["easy_erf_site_potential_worker_secret", "SITE_POTENTIAL_WORKER_SECRET"],
      ] as const;
      for (const [vaultName, envName] of mappings) {
        const value = values.get(vaultName) ?? "";
        if (value) runtime[envName] = value;
      }
      (globalThis as RuntimeGlobal).__EASY_ERF_RUNTIME_ENV__ = runtime;
    } catch (error) {
      console.error("Site Potential API Vault load failed", error);
      throw new StartupError("VAULT_LOAD");
    }
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

async function resolveLatestPaidDesignPackId(parcelId: string, siteProjectId: string) {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) throw new StartupError("RUNTIME_ENV");
  const sql = openRuntimeDatabase(dbUrl);

  try {
    const rows = await sql`
      select id
      from erf_design_packs
      where parcel_id = ${parcelId}
        and site_project_id = ${siteProjectId}
        and entitlement_status = 'paid'
        and status in ('queued', 'generating', 'partial_failed', 'failed', 'complete')
      order by created_at desc
      limit 1
    `;
    const id = rows[0]?.id;
    return id ? String(id) : null;
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

const runtimeConfigurationPromise = loadRuntimeConfiguration();

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    await runtimeConfigurationPromise;
    const routedRequest = await pinLatestPaidDesignPackRequest(
      request,
      resolveLatestPaidDesignPackId,
    );
    return handleSitePotentialEdgeApiRequest(routedRequest);
  } catch (error) {
    console.error("Site Potential API startup failed", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Site Potential service is temporarily unavailable.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      },
    );
  }
});
