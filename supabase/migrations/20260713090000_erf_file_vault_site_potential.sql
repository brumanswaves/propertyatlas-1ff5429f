-- Easy Erf permanent file vault and Site Potential foundation.
-- Files live in the private Supabase Storage bucket `erf-files`; Postgres stores metadata only.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'erf-files',
  'erf-files',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/tiff',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.erf_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parcel_id text NOT NULL,
  asset_category text NOT NULL CHECK (
    asset_category IN (
      'official_document',
      'sg_diagram',
      'paid_report',
      'title_deed',
      'zoning_document',
      'topography',
      'site_photo',
      'existing_house_photo',
      'architectural_plan',
      'inspiration_image',
      'generated_design',
      'report_export',
      'other'
    )
  ),
  asset_type text NOT NULL,
  source_label text,
  storage_bucket text NOT NULL DEFAULT 'erf-files',
  storage_path text NOT NULL,
  original_file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  checksum_sha256 text,
  status text NOT NULL DEFAULT 'uploaded_reference_only' CHECK (
    status IN (
      'pending_upload',
      'uploaded_reference_only',
      'processing',
      'ready',
      'failed',
      'archived',
      'deleted'
    )
  ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  local_migration_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS erf_assets_user_parcel_idx
ON public.erf_assets (user_id, parcel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS erf_assets_user_parcel_category_idx
ON public.erf_assets (user_id, parcel_id, asset_category, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS erf_assets_local_migration_fingerprint_idx
ON public.erf_assets (user_id, parcel_id, local_migration_fingerprint)
WHERE local_migration_fingerprint IS NOT NULL;

ALTER TABLE public.erf_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own erf assets" ON public.erf_assets;
CREATE POLICY "users read own erf assets"
ON public.erf_assets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users insert own erf assets" ON public.erf_assets;
CREATE POLICY "users insert own erf assets"
ON public.erf_assets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own erf assets" ON public.erf_assets;
CREATE POLICY "users update own erf assets"
ON public.erf_assets FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users delete own erf assets" ON public.erf_assets;
CREATE POLICY "users delete own erf assets"
ON public.erf_assets FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.erf_site_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parcel_id text NOT NULL,
  mode text NOT NULL DEFAULT 'unknown' CHECK (
    mode IN ('vacant_land', 'renovation', 'other_building', 'unknown', 'skipped')
  ),
  design_brief text,
  selected_style text,
  renovation_level text CHECK (renovation_level IS NULL OR renovation_level IN ('cosmetic', 'moderate', 'major')),
  requested_rooms text[] NOT NULL DEFAULT '{}'::text[],
  requested_features text[] NOT NULL DEFAULT '{}'::text[],
  custom_instructions text,
  rights_confirmed_at timestamptz,
  generation_status text NOT NULL DEFAULT 'not_started' CHECK (
    generation_status IN (
      'not_started',
      'inputs_added',
      'ready_to_generate',
      'generating',
      'concepts_ready',
      'design_selected',
      'skipped',
      'failed'
    )
  ),
  selected_design_asset_id uuid REFERENCES public.erf_assets(id) ON DELETE SET NULL,
  skipped_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, parcel_id)
);

CREATE INDEX IF NOT EXISTS erf_site_projects_user_parcel_idx
ON public.erf_site_projects (user_id, parcel_id, updated_at DESC);

ALTER TABLE public.erf_site_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own site projects" ON public.erf_site_projects;
CREATE POLICY "users manage own site projects"
ON public.erf_site_projects FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.erf_site_project_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_project_id uuid NOT NULL REFERENCES public.erf_site_projects(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.erf_assets(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (
    role IN (
      'site_photo',
      'existing_house_photo',
      'topography',
      'plan',
      'inspiration',
      'generated_option',
      'selected_generated_option',
      'supporting_document'
    )
  ),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_project_id, asset_id, role)
);

CREATE INDEX IF NOT EXISTS erf_site_project_assets_project_idx
ON public.erf_site_project_assets (site_project_id, display_order);

ALTER TABLE public.erf_site_project_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own site project assets" ON public.erf_site_project_assets;
CREATE POLICY "users manage own site project assets"
ON public.erf_site_project_assets FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.erf_design_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parcel_id text NOT NULL,
  site_project_id uuid NOT NULL REFERENCES public.erf_site_projects(id) ON DELETE CASCADE,
  payment_provider text,
  payment_reference text,
  entitlement_status text NOT NULL DEFAULT 'pending_payment' CHECK (
    entitlement_status IN ('pending_payment', 'paid', 'refunded', 'cancelled')
  ),
  idempotency_key text NOT NULL,
  requested_count integer NOT NULL DEFAULT 6 CHECK (requested_count BETWEEN 1 AND 12),
  completed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_payment' CHECK (
    status IN ('pending_payment', 'queued', 'generating', 'complete', 'partial_failed', 'failed', 'cancelled')
  ),
  prompt_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS erf_design_packs_user_parcel_idx
ON public.erf_design_packs (user_id, parcel_id, created_at DESC);

ALTER TABLE public.erf_design_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own design packs" ON public.erf_design_packs;
CREATE POLICY "users read own design packs"
ON public.erf_design_packs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users insert own pending design packs" ON public.erf_design_packs;
CREATE POLICY "users insert own pending design packs"
ON public.erf_design_packs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own design packs" ON public.erf_design_packs;
CREATE POLICY "users update own design packs"
ON public.erf_design_packs FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.erf_asset_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.erf_assets(id) ON DELETE CASCADE,
  parcel_id text NOT NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS erf_asset_events_user_parcel_idx
ON public.erf_asset_events (user_id, parcel_id, created_at DESC);

ALTER TABLE public.erf_asset_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own asset events" ON public.erf_asset_events;
CREATE POLICY "users read own asset events"
ON public.erf_asset_events FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service role manages asset events" ON public.erf_asset_events;
CREATE POLICY "service role manages asset events"
ON public.erf_asset_events FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE TRIGGER erf_assets_set_updated_at
BEFORE UPDATE ON public.erf_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER erf_site_projects_set_updated_at
BEFORE UPDATE ON public.erf_site_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER erf_design_packs_set_updated_at
BEFORE UPDATE ON public.erf_design_packs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "users read own erf files" ON storage.objects;
CREATE POLICY "users read own erf files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'erf-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "users upload own erf files" ON storage.objects;
CREATE POLICY "users upload own erf files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'erf-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "users update own erf files" ON storage.objects;
CREATE POLICY "users update own erf files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'erf-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'erf-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "users delete own erf files" ON storage.objects;
CREATE POLICY "users delete own erf files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'erf-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
