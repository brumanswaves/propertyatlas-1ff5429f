declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
    OPENAI_API_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    SITE_POTENTIAL_BETA_ENABLED?: string;
    SITE_POTENTIAL_BETA_ADMIN_ALLOWLIST?: string;
    SITE_POTENTIAL_DEV_ENTITLEMENTS?: string;
    SITE_POTENTIAL_DEV_ADMIN_ALLOWLIST?: string;
    SITE_POTENTIAL_WORKER_ENABLED?: string;
    SITE_POTENTIAL_WORKER_SECRET?: string;
  }
}
