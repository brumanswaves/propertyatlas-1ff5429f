// Runtime-neutral server environment access.
//
// The same Site Potential server logic runs in two trusted runtimes:
//   - the TanStack Start server runtime (process.env)
//   - Supabase Edge Functions / Deno (Deno.env.get)
//
// Nothing here is browser code: every caller is a server route handler, a
// trusted worker, or an Edge Function handler. Values are read at CALL time,
// never at module scope, because both runtimes bind env per request.

type EnvRecord = Record<string, string | undefined>;

interface DenoLike {
  env?: { get(key: string): string | undefined };
}

function denoEnv(key: string) {
  const runtime = (globalThis as { Deno?: DenoLike }).Deno;
  if (!runtime?.env) return undefined;
  try {
    return runtime.env.get(key);
  } catch {
    // Deno without --allow-env: treat as unset rather than crashing.
    return undefined;
  }
}

function processEnv(key: string) {
  const runtime = (globalThis as { process?: { env?: EnvRecord } }).process;
  return runtime?.env?.[key];
}

/** Reads one server environment variable in either supported runtime. */
export function readServerEnv(key: string): string | undefined {
  return denoEnv(key) ?? processEnv(key);
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

/**
 * Environment keys Site Potential server code inspects for entitlement and
 * runtime-readiness decisions.
 */
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

/**
 * Runtime-neutral replacement for `process.env` in Site Potential server
 * handlers. Entitlement rules are unchanged: identical key values produce
 * identical decisions. Supabase Edge Functions expose the publishable key as
 * SUPABASE_ANON_KEY, so that is accepted as a fallback for
 * SUPABASE_PUBLISHABLE_KEY only.
 */
export function sitePotentialServerEnv() {
  const snapshot = readServerEnvRecord(SITE_POTENTIAL_ENV_KEYS);
  return {
    ...snapshot,
    SUPABASE_PUBLISHABLE_KEY:
      snapshot.SUPABASE_PUBLISHABLE_KEY ?? readServerEnv("SUPABASE_ANON_KEY"),
  };
}
