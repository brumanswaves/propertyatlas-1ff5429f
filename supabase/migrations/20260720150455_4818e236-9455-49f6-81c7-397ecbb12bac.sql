-- Historical portability: Lovable Cloud provides sandbox_exec, while standard
-- Supabase projects do not. Preserve the legacy grants only where the role exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    GRANT USAGE ON SCHEMA private TO sandbox_exec;
    GRANT SELECT, INSERT, UPDATE, DELETE ON private.worker_secrets TO sandbox_exec;
  END IF;
END;
$$;
