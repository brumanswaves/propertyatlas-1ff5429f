// Runtime-neutral server environment access.
//
// The same Site Potential server logic runs in two trusted runtimes:
//   - the TanStack Start server runtime (process.env)
//   - Supabase Edge Functions / Deno (Deno.env.get)
//
// Supabase Edge Functions may hydrate encrypted Vault values into the
// in-memory override map before loading the worker module. Nothing here is
// browser code and no secret value is persisted by this helper.

type EnvRecord = Record<string, string | undefined>;

type EasyErfRuntimeGlobal = typeof globalThis & {
  __EASY_ERF_RUNTIME_ENV__?: EnvRecord;
};

interface DenoLike {
  env?: { get(key: string): string | undefined };
}

function overrideEnv(key: string) {
  return (globalThis as EasyErfRuntimeGlobal).__EASY_ERF_RUNTIME_ENV__?.[key];
}

function denoEnv(key: string) {
  const runtime = (globalThis as { Deno?: DenoLike }).Deno;
  if (!runtime?.env) return undefined;
  try {
    return runtime.env.get(key);
  } catch {
    return undefined;
  }
}

function processEnv(key: string) {
  const runtime = (globalThis as { process?: { env?: EnvRecord } }).process;
  return runtime?.env?.[key];
}

/** Reads one server environment value in any supported trusted runtime. */
export function readServerEnv(key: string): string | undefined {
  return overrideEnv(key) ?? denoEnv(key) ?? processEnv(key);
}

/**
 * Snapshot of the server environment for helpers that take an env object
 * (entitlement/readiness resolvers). Only the requested keys are read.
 */
export function readServerEnvRecord<K extends string>(keys: readonly K[]) {
  const snapshot: Record<string, string | undefined> = {};
  for (const key of keys) snapshot[key] = readServerEnv(key);
  return snapshot as Record<K, string | undefined>;
}

export const SITE_POTENTIAL_ENV_KEYS = [
  "SITE_POTENTIAL_BETA_ENABLED",
  "SITE_POTENTIAL_BETA_ADMIN_ALLOWLIST",
  "SITE_POTENTIAL_DEV_ENTITLEMENTS",
  "SITE_POTENTIAL_GENERATION_ENABLED",
  "SITE_POTENTIAL_WORKER_ENABLED",
  "SITE_POTENTIAL_WORKER_SECRET",
  "OPENAI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function sitePotentialServerEnv() {
  const snapshot = readServerEnvRecord(SITE_POTENTIAL_ENV_KEYS);
  return {
    ...snapshot,
    SUPABASE_PUBLISHABLE_KEY:
      snapshot.SUPABASE_PUBLISHABLE_KEY ?? readServerEnv("SUPABASE_ANON_KEY"),
  };
}
