import postgres from "npm:postgres@3.4.7";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Site-Potential-Worker-Secret",
};

type WorkerModule = {
  handleProcessSitePotentialRequest(request: Request): Promise<Response>;
};
type RuntimeGlobal = typeof globalThis & {
  __EASY_ERF_RUNTIME_ENV__?: Record<string, string | undefined>;
};

const WORKER_SOURCE_REVISION = "692c040ea1be2488c832071e0e129474a490d9c7";

async function loadWorkerModule(): Promise<WorkerModule> {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) throw new Error("Supabase database runtime is unavailable.");

  const sql = postgres(dbUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 8,
    idle_timeout: 2,
  });

  try {
    const rows = await sql`
      select name, decrypted_secret
      from vault.decrypted_secrets
      where name in (
        'easy_erf_openai_api_key',
        'easy_erf_openai_image_model',
        'easy_erf_openai_image_output_format',
        'easy_erf_openai_image_quality',
        'easy_erf_openai_image_size',
        'easy_erf_site_potential_generation_enabled',
        'easy_erf_site_potential_worker_enabled',
        'easy_erf_site_potential_worker_secret'
      )
    `;
    const values = new Map(
      rows.map((row) => [String(row.name), String(row.decrypted_secret ?? "")]),
    );
    const runtime: Record<string, string | undefined> = {};
    const mappings = [
      ["easy_erf_openai_api_key", "OPENAI_API_KEY"],
      ["easy_erf_openai_image_model", "OPENAI_IMAGE_MODEL"],
      ["easy_erf_openai_image_output_format", "OPENAI_IMAGE_OUTPUT_FORMAT"],
      ["easy_erf_openai_image_quality", "OPENAI_IMAGE_QUALITY"],
      ["easy_erf_openai_image_size", "OPENAI_IMAGE_SIZE"],
      ["easy_erf_site_potential_generation_enabled", "SITE_POTENTIAL_GENERATION_ENABLED"],
      ["easy_erf_site_potential_worker_enabled", "SITE_POTENTIAL_WORKER_ENABLED"],
      ["easy_erf_site_potential_worker_secret", "SITE_POTENTIAL_WORKER_SECRET"],
    ] as const;
    for (const [vaultName, envName] of mappings) {
      const value = values.get(vaultName) ?? "";
      if (value) runtime[envName] = value;
    }
    (globalThis as RuntimeGlobal).__EASY_ERF_RUNTIME_ENV__ = runtime;
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }

  return import(
    `https://raw.githubusercontent.com/brumanswaves/propertyatlas-1ff5429f/${WORKER_SOURCE_REVISION}/src/lib/sitePotential/processWorkerRequest.ts`
  );
}

const workerModulePromise = loadWorkerModule();

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const workerModule = await workerModulePromise;
    return workerModule.handleProcessSitePotentialRequest(request);
  } catch (error) {
    console.error("Site Potential worker startup failed", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Site Potential worker failed. Check private worker logs for details.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      },
    );
  }
});
