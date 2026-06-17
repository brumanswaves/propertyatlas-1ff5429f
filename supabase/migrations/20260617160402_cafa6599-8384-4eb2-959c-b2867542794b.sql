
-- Provider integration readiness tables + report_orders hardening

-- 1) Enums
DO $$ BEGIN
  CREATE TYPE public.provider_id AS ENUM ('demo','surveyor-general','municipal-gis','windeed','lightstone');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_order_status AS ENUM ('pending','paid','fulfilling','complete','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.provider_audit_action AS ENUM (
    'search','get_property','get_geometry','get_ownership','get_valuation','get_transfers','get_reports','order_report','health'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) provider_cache: server-side TTL cache for provider responses
CREATE TABLE IF NOT EXISTS public.provider_cache (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      public.provider_id NOT NULL,
  resource_type text NOT NULL,
  resource_id   text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, resource_type, resource_id)
);
CREATE INDEX IF NOT EXISTS idx_provider_cache_expires ON public.provider_cache(expires_at);

GRANT ALL ON public.provider_cache TO service_role;
GRANT SELECT ON public.provider_cache TO authenticated;
ALTER TABLE public.provider_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read provider cache" ON public.provider_cache
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_provider_cache_updated_at
  BEFORE UPDATE ON public.provider_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) provider_audit_log: POPIA-grade audit trail for every provider lookup
CREATE TABLE IF NOT EXISTS public.provider_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider    public.provider_id NOT NULL,
  action      public.provider_audit_action NOT NULL,
  resource_id text,
  purpose     text,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  latency_ms  integer,
  status      text NOT NULL DEFAULT 'ok',
  error_code  text,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_user_at ON public.provider_audit_log(user_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_provider_at ON public.provider_audit_log(provider, at DESC);

GRANT ALL ON public.provider_audit_log TO service_role;
GRANT SELECT ON public.provider_audit_log TO authenticated;
ALTER TABLE public.provider_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own audit rows" ON public.provider_audit_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "admins read all audit rows" ON public.provider_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) provider_settings: per-tenant active provider + encrypted credential metadata
CREATE TABLE IF NOT EXISTS public.provider_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        public.provider_id NOT NULL UNIQUE,
  enabled         boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT false,
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_ref      text,
  last_health     text,
  last_checked_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.provider_settings TO service_role;
GRANT SELECT ON public.provider_settings TO authenticated;
ALTER TABLE public.provider_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read provider settings" ON public.provider_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins write provider settings" ON public.provider_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_provider_settings_updated_at
  BEFORE UPDATE ON public.provider_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.provider_settings (provider, enabled, is_active)
VALUES
  ('demo', true, true),
  ('surveyor-general', false, false),
  ('municipal-gis', false, false),
  ('windeed', false, false),
  ('lightstone', false, false)
ON CONFLICT (provider) DO NOTHING;

-- 5) report_orders hardening: status enum + provider linkage + fulfilment columns
ALTER TABLE public.report_orders
  ADD COLUMN IF NOT EXISTS status_enum       public.report_order_status,
  ADD COLUMN IF NOT EXISTS provider_id       public.provider_id,
  ADD COLUMN IF NOT EXISTS provider_order_ref text,
  ADD COLUMN IF NOT EXISTS pdf_storage_path  text,
  ADD COLUMN IF NOT EXISTS failure_reason    text,
  ADD COLUMN IF NOT EXISTS completed_at      timestamptz;

UPDATE public.report_orders
SET status_enum = CASE
  WHEN status IN ('pending','paid','fulfilling','complete','failed','cancelled') THEN status::public.report_order_status
  ELSE 'pending'::public.report_order_status
END
WHERE status_enum IS NULL;

UPDATE public.report_orders
SET provider_id = COALESCE(provider_id,
  CASE WHEN provider IN ('demo','surveyor-general','municipal-gis','windeed','lightstone')
       THEN provider::public.provider_id
       ELSE 'demo'::public.provider_id END)
WHERE provider_id IS NULL;

ALTER TABLE public.report_orders
  ALTER COLUMN status_enum SET NOT NULL,
  ALTER COLUMN status_enum SET DEFAULT 'pending'::public.report_order_status,
  ALTER COLUMN provider_id SET NOT NULL,
  ALTER COLUMN provider_id SET DEFAULT 'demo'::public.provider_id;
