-- Applying 7 approved Site Potential migrations in order.
-- Files kept verbatim; separators mark boundaries; schema_migrations rows recorded at end.
-- NOTE: erf-files storage bucket was created via supabase--storage_create_bucket
--       immediately before this migration (bucket-row writes are not allowed here).

-- ============================================================
-- BEGIN 20260713090000_erf_file_vault_site_potential.sql
-- ============================================================
-- Easy Erf permanent file vault and Site Potential foundation.
-- Files live in the private Supabase Storage bucket `erf-files`; Postgres stores metadata only.

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erf_assets TO authenticated;
GRANT ALL ON public.erf_assets TO service_role;

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erf_site_projects TO authenticated;
GRANT ALL ON public.erf_site_projects TO service_role;

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erf_site_project_assets TO authenticated;
GRANT ALL ON public.erf_site_project_assets TO service_role;

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

GRANT SELECT ON public.erf_design_packs TO authenticated;
GRANT ALL ON public.erf_design_packs TO service_role;

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

GRANT SELECT ON public.erf_asset_events TO authenticated;
GRANT ALL ON public.erf_asset_events TO service_role;

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

-- END 20260713090000_erf_file_vault_site_potential.sql

-- ============================================================
-- BEGIN 20260713100000_repair_site_potential_security_jobs.sql
-- ============================================================
-- Repair Site Potential entitlement writes, generation idempotency and asset ownership checks.

DROP POLICY IF EXISTS "users insert own pending design packs" ON public.erf_design_packs;
DROP POLICY IF EXISTS "users update own design packs" ON public.erf_design_packs;

CREATE TABLE IF NOT EXISTS public.erf_design_pack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  design_pack_id uuid NOT NULL REFERENCES public.erf_design_packs(id) ON DELETE CASCADE,
  option_index integer NOT NULL CHECK (option_index BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'generating', 'complete', 'failed', 'cancelled')
  ),
  generated_asset_id uuid REFERENCES public.erf_assets(id) ON DELETE SET NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (design_pack_id, option_index)
);

GRANT SELECT ON public.erf_design_pack_items TO authenticated;
GRANT ALL ON public.erf_design_pack_items TO service_role;

CREATE INDEX IF NOT EXISTS erf_design_pack_items_pack_idx
ON public.erf_design_pack_items (design_pack_id, option_index);

CREATE INDEX IF NOT EXISTS erf_design_pack_items_user_idx
ON public.erf_design_pack_items (user_id, status, updated_at DESC);

ALTER TABLE public.erf_design_pack_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own design pack items" ON public.erf_design_pack_items;
CREATE POLICY "users read own design pack items"
ON public.erf_design_pack_items FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS erf_design_pack_items_set_updated_at ON public.erf_design_pack_items;
CREATE TRIGGER erf_design_pack_items_set_updated_at
BEFORE UPDATE ON public.erf_design_pack_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ensure_site_project_selected_design()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  asset_row record;
BEGIN
  IF NEW.selected_design_asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id, parcel_id, asset_category
  INTO asset_row
  FROM public.erf_assets
  WHERE id = NEW.selected_design_asset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected design asset does not exist';
  END IF;

  IF asset_row.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Selected design asset does not belong to this user';
  END IF;

  IF asset_row.parcel_id <> NEW.parcel_id THEN
    RAISE EXCEPTION 'Selected design asset does not belong to this parcel';
  END IF;

  IF asset_row.asset_category <> 'generated_design' THEN
    RAISE EXCEPTION 'Selected design asset must be a generated design';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS erf_site_projects_selected_design_integrity ON public.erf_site_projects;
CREATE TRIGGER erf_site_projects_selected_design_integrity
BEFORE INSERT OR UPDATE OF selected_design_asset_id, user_id, parcel_id
ON public.erf_site_projects
FOR EACH ROW EXECUTE FUNCTION public.ensure_site_project_selected_design();

CREATE OR REPLACE FUNCTION public.ensure_site_project_asset_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_row record;
  asset_row record;
BEGIN
  SELECT user_id, parcel_id
  INTO project_row
  FROM public.erf_site_projects
  WHERE id = NEW.site_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Site Potential project does not exist';
  END IF;

  SELECT user_id, parcel_id
  INTO asset_row
  FROM public.erf_assets
  WHERE id = NEW.asset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Erf asset does not exist';
  END IF;

  IF NEW.user_id <> project_row.user_id OR NEW.user_id <> asset_row.user_id THEN
    RAISE EXCEPTION 'Project and asset must belong to the same user';
  END IF;

  IF project_row.parcel_id <> asset_row.parcel_id THEN
    RAISE EXCEPTION 'Project and asset must belong to the same parcel';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS erf_site_project_assets_integrity ON public.erf_site_project_assets;
CREATE TRIGGER erf_site_project_assets_integrity
BEFORE INSERT OR UPDATE OF user_id, site_project_id, asset_id
ON public.erf_site_project_assets
FOR EACH ROW EXECUTE FUNCTION public.ensure_site_project_asset_integrity();

-- END 20260713100000_repair_site_potential_security_jobs.sql

-- ============================================================
-- BEGIN 20260714090000_site_potential_durable_generation_jobs.sql
-- ============================================================
-- Durable Site Potential generation worker leases and transactional finalisation.

ALTER TABLE public.erf_design_packs
ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
ADD COLUMN IF NOT EXISTS worker_id text,
ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.erf_design_pack_items
ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
ADD COLUMN IF NOT EXISTS worker_id text,
ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS erf_design_pack_items_generated_asset_unique
ON public.erf_design_pack_items (generated_asset_id)
WHERE generated_asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS erf_design_pack_items_retry_idx
ON public.erf_design_pack_items (status, next_attempt_at, lease_expires_at, option_index);

CREATE INDEX IF NOT EXISTS erf_design_packs_retry_idx
ON public.erf_design_packs (status, next_attempt_at, lease_expires_at);

CREATE OR REPLACE FUNCTION public.recover_stale_site_potential_jobs(
  p_now timestamptz DEFAULT now(),
  p_max_attempts integer DEFAULT 3
)
RETURNS TABLE(recovered_items integer, recovered_packs integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_count integer := 0;
  pack_count integer := 0;
BEGIN
  UPDATE public.erf_design_pack_items
  SET
    status = CASE
      WHEN attempt_count >= p_max_attempts THEN 'failed'
      ELSE 'queued'
    END,
    worker_id = NULL,
    claimed_at = NULL,
    heartbeat_at = NULL,
    lease_expires_at = NULL,
    next_attempt_at = CASE
      WHEN attempt_count >= p_max_attempts THEN next_attempt_at
      ELSE p_now
    END,
    failure_code = CASE
      WHEN attempt_count >= p_max_attempts THEN COALESCE(failure_code, 'MAX_ATTEMPTS_EXCEEDED')
      ELSE failure_code
    END,
    failure_message = CASE
      WHEN attempt_count >= p_max_attempts THEN COALESCE(failure_message, 'Maximum generation attempts exceeded.')
      ELSE failure_message
    END
  WHERE status = 'generating'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at <= p_now;

  GET DIAGNOSTICS item_count = ROW_COUNT;

  UPDATE public.erf_design_packs pack
  SET
    status = CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.erf_design_pack_items item
        WHERE item.design_pack_id = pack.id
          AND item.status IN ('queued', 'failed')
          AND item.generated_asset_id IS NULL
          AND item.attempt_count < p_max_attempts
      ) THEN 'queued'
      WHEN EXISTS (
        SELECT 1
        FROM public.erf_design_pack_items item
        WHERE item.design_pack_id = pack.id
          AND item.status = 'complete'
      ) THEN 'partial_failed'
      ELSE 'failed'
    END,
    worker_id = NULL,
    claimed_at = NULL,
    heartbeat_at = NULL,
    lease_expires_at = NULL,
    next_attempt_at = p_now
  WHERE pack.status = 'generating'
    AND pack.lease_expires_at IS NOT NULL
    AND pack.lease_expires_at <= p_now;

  GET DIAGNOSTICS pack_count = ROW_COUNT;

  RETURN QUERY SELECT item_count, pack_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_next_site_potential_item(
  p_worker_id text,
  p_lease_expires_at timestamptz,
  p_now timestamptz DEFAULT now(),
  p_max_attempts integer DEFAULT 3
)
RETURNS TABLE(
  item_id uuid,
  user_id uuid,
  design_pack_id uuid,
  site_project_id uuid,
  parcel_id text,
  option_index integer,
  attempt_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed record;
BEGIN
  PERFORM public.recover_stale_site_potential_jobs(p_now, p_max_attempts);

  SELECT item.id,
         item.user_id,
         item.design_pack_id,
         pack.site_project_id,
         pack.parcel_id,
         item.option_index,
         item.attempt_count
  INTO claimed
  FROM public.erf_design_pack_items item
  JOIN public.erf_design_packs pack ON pack.id = item.design_pack_id
  WHERE item.generated_asset_id IS NULL
    AND item.status IN ('queued', 'failed')
    AND item.attempt_count < p_max_attempts
    AND item.next_attempt_at <= p_now
    AND pack.status IN ('queued', 'partial_failed', 'failed', 'generating')
    AND pack.entitlement_status = 'paid'
    AND pack.next_attempt_at <= p_now
    AND (
      item.option_index = 1
      OR EXISTS (
        SELECT 1
        FROM public.erf_design_pack_items primary_item
        WHERE primary_item.design_pack_id = item.design_pack_id
          AND primary_item.option_index = 1
          AND primary_item.status = 'complete'
          AND primary_item.generated_asset_id IS NOT NULL
      )
    )
  ORDER BY pack.created_at ASC, item.option_index ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.erf_design_packs
  SET
    status = 'generating',
    worker_id = p_worker_id,
    claimed_at = COALESCE(claimed_at, p_now),
    heartbeat_at = p_now,
    lease_expires_at = p_lease_expires_at,
    failure_code = NULL,
    failure_message = NULL
  WHERE id = claimed.design_pack_id;

  UPDATE public.erf_design_pack_items
  SET
    status = 'generating',
    worker_id = p_worker_id,
    claimed_at = p_now,
    heartbeat_at = p_now,
    lease_expires_at = p_lease_expires_at,
    failure_code = NULL,
    failure_message = NULL
  WHERE id = claimed.id;

  RETURN QUERY
  SELECT claimed.id,
         claimed.user_id,
         claimed.design_pack_id,
         claimed.site_project_id,
         claimed.parcel_id,
         claimed.option_index,
         claimed.attempt_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_site_potential_item(
  p_worker_id text,
  p_item_id uuid,
  p_asset_id uuid,
  p_user_id uuid,
  p_parcel_id text,
  p_site_project_id uuid,
  p_asset_type text,
  p_storage_bucket text,
  p_storage_path text,
  p_original_file_name text,
  p_mime_type text,
  p_size_bytes integer,
  p_metadata jsonb,
  p_source_label text DEFAULT 'Easy Erf Site Potential AI concept'
)
RETURNS public.erf_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_row record;
  asset_row public.erf_assets;
  v_completed_count integer := 0;
  v_total_count integer := 0;
  v_failed_count integer := 0;
BEGIN
  SELECT item.*, pack.site_project_id, pack.parcel_id
  INTO item_row
  FROM public.erf_design_pack_items item
  JOIN public.erf_design_packs pack ON pack.id = item.design_pack_id
  WHERE item.id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Design pack item not found';
  END IF;

  IF item_row.status <> 'generating' OR item_row.worker_id IS DISTINCT FROM p_worker_id THEN
    RAISE EXCEPTION 'Design pack item is not claimed by this worker';
  END IF;

  IF item_row.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Design pack item user mismatch';
  END IF;

  IF item_row.parcel_id <> p_parcel_id OR item_row.site_project_id <> p_site_project_id THEN
    RAISE EXCEPTION 'Design pack item project or parcel mismatch';
  END IF;

  IF item_row.generated_asset_id IS NOT NULL THEN
    SELECT *
    INTO asset_row
    FROM public.erf_assets
    WHERE id = item_row.generated_asset_id;
    RETURN asset_row;
  END IF;

  SELECT *
  INTO asset_row
  FROM public.erf_assets
  WHERE metadata->>'designPackItemId' = p_item_id::text
    AND asset_category = 'generated_design'
    AND user_id = p_user_id
    AND parcel_id = p_parcel_id
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.erf_assets (
      id,
      user_id,
      parcel_id,
      asset_category,
      asset_type,
      source_label,
      storage_bucket,
      storage_path,
      original_file_name,
      mime_type,
      size_bytes,
      status,
      metadata
    )
    VALUES (
      p_asset_id,
      p_user_id,
      p_parcel_id,
      'generated_design',
      p_asset_type,
      p_source_label,
      p_storage_bucket,
      p_storage_path,
      p_original_file_name,
      p_mime_type,
      p_size_bytes,
      'ready',
      p_metadata
    )
    RETURNING * INTO asset_row;
  END IF;

  INSERT INTO public.erf_site_project_assets (
    user_id,
    site_project_id,
    asset_id,
    role,
    display_order
  )
  VALUES (
    p_user_id,
    p_site_project_id,
    asset_row.id,
    'generated_option',
    item_row.option_index
  )
  ON CONFLICT (site_project_id, asset_id, role) DO NOTHING;

  UPDATE public.erf_design_pack_items
  SET
    status = 'complete',
    generated_asset_id = asset_row.id,
    worker_id = NULL,
    heartbeat_at = now(),
    lease_expires_at = NULL,
    failure_code = NULL,
    failure_message = NULL
  WHERE id = p_item_id;

  SELECT
    COUNT(*) FILTER (WHERE status = 'complete' AND generated_asset_id IS NOT NULL),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO v_completed_count, v_total_count, v_failed_count
  FROM public.erf_design_pack_items
  WHERE design_pack_id = item_row.design_pack_id;

  UPDATE public.erf_design_packs
  SET
    completed_count = v_completed_count,
    status = CASE
      WHEN v_completed_count >= requested_count THEN 'complete'
      WHEN v_failed_count > 0 THEN 'partial_failed'
      ELSE 'queued'
    END,
    worker_id = NULL,
    heartbeat_at = now(),
    lease_expires_at = NULL,
    failure_code = NULL,
    failure_message = NULL
  WHERE id = item_row.design_pack_id;

  UPDATE public.erf_site_projects
  SET generation_status = 'concepts_ready'
  WHERE id = p_site_project_id
    AND user_id = p_user_id;

  RETURN asset_row;
END;
$$;

-- END 20260714090000_site_potential_durable_generation_jobs.sql

-- ============================================================
-- BEGIN 20260714103000_lock_site_potential_worker_rpc_leases.sql
-- ============================================================
-- Lock worker-only Site Potential RPCs to service_role and count every claimed attempt.

CREATE OR REPLACE FUNCTION public.recover_stale_site_potential_jobs(
  p_now timestamptz DEFAULT now(),
  p_max_attempts integer DEFAULT 3
)
RETURNS TABLE(recovered_items integer, recovered_packs integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_count integer := 0;
  pack_count integer := 0;
BEGIN
  UPDATE public.erf_design_pack_items
  SET
    status = CASE
      WHEN attempt_count >= p_max_attempts THEN 'failed'
      ELSE 'queued'
    END,
    worker_id = NULL,
    claimed_at = NULL,
    heartbeat_at = NULL,
    lease_expires_at = NULL,
    next_attempt_at = CASE
      WHEN attempt_count >= p_max_attempts THEN next_attempt_at
      ELSE p_now
    END,
    failure_code = CASE
      WHEN attempt_count >= p_max_attempts THEN COALESCE(failure_code, 'MAX_ATTEMPTS_EXCEEDED')
      ELSE failure_code
    END,
    failure_message = CASE
      WHEN attempt_count >= p_max_attempts THEN COALESCE(failure_message, 'Maximum generation attempts exceeded.')
      ELSE failure_message
    END
  WHERE status = 'generating'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at <= p_now;

  GET DIAGNOSTICS item_count = ROW_COUNT;

  UPDATE public.erf_design_packs pack
  SET
    status = CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.erf_design_pack_items item
        WHERE item.design_pack_id = pack.id
          AND item.status IN ('queued', 'failed')
          AND item.generated_asset_id IS NULL
          AND item.attempt_count < p_max_attempts
      ) THEN 'queued'
      WHEN EXISTS (
        SELECT 1
        FROM public.erf_design_pack_items item
        WHERE item.design_pack_id = pack.id
          AND item.status = 'complete'
      ) THEN 'partial_failed'
      ELSE 'failed'
    END,
    worker_id = NULL,
    claimed_at = NULL,
    heartbeat_at = NULL,
    lease_expires_at = NULL,
    next_attempt_at = p_now
  WHERE pack.status = 'generating'
    AND pack.lease_expires_at IS NOT NULL
    AND pack.lease_expires_at <= p_now;

  GET DIAGNOSTICS pack_count = ROW_COUNT;

  RETURN QUERY SELECT item_count, pack_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_next_site_potential_item(
  p_worker_id text,
  p_lease_expires_at timestamptz,
  p_now timestamptz DEFAULT now(),
  p_max_attempts integer DEFAULT 3
)
RETURNS TABLE(
  item_id uuid,
  user_id uuid,
  design_pack_id uuid,
  site_project_id uuid,
  parcel_id text,
  option_index integer,
  attempt_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed record;
  v_attempt_count integer := 0;
BEGIN
  PERFORM public.recover_stale_site_potential_jobs(p_now, p_max_attempts);

  SELECT item.id,
         item.user_id,
         item.design_pack_id,
         pack.site_project_id,
         pack.parcel_id,
         item.option_index
  INTO claimed
  FROM public.erf_design_pack_items item
  JOIN public.erf_design_packs pack ON pack.id = item.design_pack_id
  WHERE item.generated_asset_id IS NULL
    AND item.status IN ('queued', 'failed')
    AND item.attempt_count < p_max_attempts
    AND item.next_attempt_at <= p_now
    AND pack.status IN ('queued', 'partial_failed', 'failed', 'generating')
    AND pack.entitlement_status = 'paid'
    AND pack.next_attempt_at <= p_now
    AND (
      item.option_index = 1
      OR EXISTS (
        SELECT 1
        FROM public.erf_design_pack_items primary_item
        WHERE primary_item.design_pack_id = item.design_pack_id
          AND primary_item.option_index = 1
          AND primary_item.status = 'complete'
          AND primary_item.generated_asset_id IS NOT NULL
      )
    )
  ORDER BY pack.created_at ASC, item.option_index ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.erf_design_packs
  SET
    status = 'generating',
    worker_id = p_worker_id,
    claimed_at = COALESCE(claimed_at, p_now),
    heartbeat_at = p_now,
    lease_expires_at = p_lease_expires_at,
    failure_code = NULL,
    failure_message = NULL
  WHERE id = claimed.design_pack_id;

  UPDATE public.erf_design_pack_items
  SET
    status = 'generating',
    worker_id = p_worker_id,
    claimed_at = p_now,
    heartbeat_at = p_now,
    lease_expires_at = p_lease_expires_at,
    attempt_count = attempt_count + 1,
    failure_code = NULL,
    failure_message = NULL
  WHERE id = claimed.id
  RETURNING attempt_count INTO v_attempt_count;

  RETURN QUERY
  SELECT claimed.id,
         claimed.user_id,
         claimed.design_pack_id,
         claimed.site_project_id,
         claimed.parcel_id,
         claimed.option_index,
         v_attempt_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_site_potential_item_lease(
  p_item_id uuid,
  p_worker_id text,
  p_lease_expires_at timestamptz,
  p_now timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_row record;
BEGIN
  SELECT item.id, item.design_pack_id
  INTO item_row
  FROM public.erf_design_pack_items item
  WHERE item.id = p_item_id
    AND item.status = 'generating'
    AND item.worker_id = p_worker_id
    AND item.lease_expires_at IS NOT NULL
    AND item.lease_expires_at > p_now
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.erf_design_pack_items
  SET
    heartbeat_at = p_now,
    lease_expires_at = p_lease_expires_at
  WHERE id = item_row.id;

  UPDATE public.erf_design_packs
  SET
    heartbeat_at = p_now,
    lease_expires_at = p_lease_expires_at,
    worker_id = p_worker_id
  WHERE id = item_row.design_pack_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_site_potential_item(
  p_worker_id text,
  p_item_id uuid,
  p_asset_id uuid,
  p_user_id uuid,
  p_parcel_id text,
  p_site_project_id uuid,
  p_asset_type text,
  p_storage_bucket text,
  p_storage_path text,
  p_original_file_name text,
  p_mime_type text,
  p_size_bytes integer,
  p_metadata jsonb,
  p_source_label text DEFAULT 'Easy Erf Site Potential AI concept'
)
RETURNS public.erf_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_row record;
  asset_row public.erf_assets;
  v_completed_count integer := 0;
  v_total_count integer := 0;
  v_failed_count integer := 0;
BEGIN
  SELECT item.*, pack.site_project_id, pack.parcel_id
  INTO item_row
  FROM public.erf_design_pack_items item
  JOIN public.erf_design_packs pack ON pack.id = item.design_pack_id
  WHERE item.id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Design pack item not found';
  END IF;

  IF item_row.status <> 'generating'
    OR item_row.worker_id IS DISTINCT FROM p_worker_id
    OR item_row.lease_expires_at IS NULL
    OR item_row.lease_expires_at <= now()
  THEN
    RAISE EXCEPTION 'Design pack item is not currently claimed by this worker';
  END IF;

  IF item_row.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Design pack item user mismatch';
  END IF;

  IF item_row.parcel_id <> p_parcel_id OR item_row.site_project_id <> p_site_project_id THEN
    RAISE EXCEPTION 'Design pack item project or parcel mismatch';
  END IF;

  IF item_row.generated_asset_id IS NOT NULL THEN
    SELECT *
    INTO asset_row
    FROM public.erf_assets
    WHERE id = item_row.generated_asset_id;
    RETURN asset_row;
  END IF;

  SELECT *
  INTO asset_row
  FROM public.erf_assets
  WHERE metadata->>'designPackItemId' = p_item_id::text
    AND asset_category = 'generated_design'
    AND user_id = p_user_id
    AND parcel_id = p_parcel_id
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.erf_assets (
      id,
      user_id,
      parcel_id,
      asset_category,
      asset_type,
      source_label,
      storage_bucket,
      storage_path,
      original_file_name,
      mime_type,
      size_bytes,
      status,
      metadata
    )
    VALUES (
      p_asset_id,
      p_user_id,
      p_parcel_id,
      'generated_design',
      p_asset_type,
      p_source_label,
      p_storage_bucket,
      p_storage_path,
      p_original_file_name,
      p_mime_type,
      p_size_bytes,
      'ready',
      p_metadata
    )
    RETURNING * INTO asset_row;
  END IF;

  INSERT INTO public.erf_site_project_assets (
    user_id,
    site_project_id,
    asset_id,
    role,
    display_order
  )
  VALUES (
    p_user_id,
    p_site_project_id,
    asset_row.id,
    'generated_option',
    item_row.option_index
  )
  ON CONFLICT (site_project_id, asset_id, role) DO NOTHING;

  UPDATE public.erf_design_pack_items
  SET
    status = 'complete',
    generated_asset_id = asset_row.id,
    worker_id = NULL,
    heartbeat_at = now(),
    lease_expires_at = NULL,
    failure_code = NULL,
    failure_message = NULL
  WHERE id = p_item_id;

  SELECT
    COUNT(*) FILTER (WHERE status = 'complete' AND generated_asset_id IS NOT NULL),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO v_completed_count, v_total_count, v_failed_count
  FROM public.erf_design_pack_items
  WHERE design_pack_id = item_row.design_pack_id;

  UPDATE public.erf_design_packs
  SET
    completed_count = v_completed_count,
    status = CASE
      WHEN v_completed_count >= requested_count THEN 'complete'
      WHEN v_failed_count > 0 THEN 'partial_failed'
      ELSE 'queued'
    END,
    worker_id = NULL,
    heartbeat_at = now(),
    lease_expires_at = NULL,
    failure_code = NULL,
    failure_message = NULL
  WHERE id = item_row.design_pack_id;

  UPDATE public.erf_site_projects
  SET generation_status = 'concepts_ready'
  WHERE id = p_site_project_id
    AND user_id = p_user_id;

  RETURN asset_row;
END;
$$;

REVOKE ALL ON FUNCTION public.recover_stale_site_potential_jobs(timestamptz, integer)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_next_site_potential_item(text, timestamptz, timestamptz, integer)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_site_potential_item_lease(uuid, text, timestamptz, timestamptz)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_site_potential_item(text, uuid, uuid, uuid, text, uuid, text, text, text, text, text, integer, jsonb, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.recover_stale_site_potential_jobs(timestamptz, integer)
TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_site_potential_item(text, timestamptz, timestamptz, integer)
TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_site_potential_item_lease(uuid, text, timestamptz, timestamptz)
TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_site_potential_item(text, uuid, uuid, uuid, text, uuid, text, text, text, text, text, integer, jsonb, text)
TO service_role;

-- END 20260714103000_lock_site_potential_worker_rpc_leases.sql

-- ============================================================
-- BEGIN 20260714113000_site_potential_beta_credits.sql
-- ============================================================
-- Private beta credits for Site Potential paid-equivalent design pack entitlements.

CREATE TABLE IF NOT EXISTS public.site_potential_beta_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_granted integer NOT NULL CHECK (credits_granted > 0),
  credits_used integer NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (credits_used <= credits_granted)
);

GRANT SELECT ON public.site_potential_beta_credits TO authenticated;
GRANT ALL ON public.site_potential_beta_credits TO service_role;

CREATE INDEX IF NOT EXISTS site_potential_beta_credits_user_idx
ON public.site_potential_beta_credits (user_id, expires_at, created_at DESC);

ALTER TABLE public.site_potential_beta_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own beta credit balance" ON public.site_potential_beta_credits;
CREATE POLICY "users read own beta credit balance"
ON public.site_potential_beta_credits FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS site_potential_beta_credits_set_updated_at ON public.site_potential_beta_credits;
CREATE TRIGGER site_potential_beta_credits_set_updated_at
BEFORE UPDATE ON public.site_potential_beta_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.site_potential_beta_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  parcel_id text,
  requested_mode text,
  reason text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.site_potential_beta_access_requests TO authenticated;
GRANT ALL ON public.site_potential_beta_access_requests TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS site_potential_beta_access_requests_one_open_idx
ON public.site_potential_beta_access_requests (user_id)
WHERE status = 'open';

ALTER TABLE public.site_potential_beta_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own beta access requests" ON public.site_potential_beta_access_requests;
CREATE POLICY "users read own beta access requests"
ON public.site_potential_beta_access_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users create own beta access request" ON public.site_potential_beta_access_requests;
CREATE POLICY "users create own beta access request"
ON public.site_potential_beta_access_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'open');

DROP TRIGGER IF EXISTS site_potential_beta_access_requests_set_updated_at ON public.site_potential_beta_access_requests;
CREATE TRIGGER site_potential_beta_access_requests_set_updated_at
BEFORE UPDATE ON public.site_potential_beta_access_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.consume_site_potential_beta_credit(
  p_user_id uuid,
  p_parcel_id text,
  p_site_project_id uuid,
  p_idempotency_prefix text,
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE(
  design_pack_id uuid,
  beta_credit_id uuid,
  credits_remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_row record;
  existing_pack record;
  credit_row record;
  v_remaining integer := 0;
  v_idempotency_key text;
BEGIN
  SELECT id, user_id, parcel_id, mode, generation_status
  INTO project_row
  FROM public.erf_site_projects
  WHERE id = p_site_project_id
    AND user_id = p_user_id
    AND parcel_id = p_parcel_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Site Potential project not found';
  END IF;

  IF project_row.mode NOT IN ('vacant_land', 'renovation') THEN
    RAISE EXCEPTION 'Site Potential project is not ready for concept generation';
  END IF;

  SELECT *
  INTO existing_pack
  FROM public.erf_design_packs
  WHERE user_id = p_user_id
    AND parcel_id = p_parcel_id
    AND site_project_id = p_site_project_id
    AND payment_provider = 'beta_credit'
    AND entitlement_status = 'paid'
    AND status <> 'cancelled'
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    SELECT COALESCE(SUM(credits_granted - credits_used), 0)
    INTO v_remaining
    FROM public.site_potential_beta_credits
    WHERE user_id = p_user_id
      AND credits_used < credits_granted
      AND (expires_at IS NULL OR expires_at > p_now);

    RETURN QUERY
    SELECT existing_pack.id,
           (existing_pack.prompt_snapshot->>'betaCreditId')::uuid,
           v_remaining;
    RETURN;
  END IF;

  SELECT *
  INTO credit_row
  FROM public.site_potential_beta_credits
  WHERE user_id = p_user_id
    AND credits_used < credits_granted
    AND (expires_at IS NULL OR expires_at > p_now)
  ORDER BY expires_at ASC NULLS LAST, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_BETA_CREDIT';
  END IF;

  v_idempotency_key := p_idempotency_prefix || ':' || credit_row.id::text;

  UPDATE public.site_potential_beta_credits
  SET credits_used = credits_used + 1
  WHERE id = credit_row.id
    AND credits_used < credits_granted;

  INSERT INTO public.erf_design_packs (
    user_id,
    parcel_id,
    site_project_id,
    payment_provider,
    payment_reference,
    entitlement_status,
    idempotency_key,
    requested_count,
    completed_count,
    status,
    prompt_snapshot
  )
  VALUES (
    p_user_id,
    p_parcel_id,
    p_site_project_id,
    'beta_credit',
    credit_row.id::text,
    'paid',
    v_idempotency_key,
    6,
    0,
    'queued',
    jsonb_build_object(
      'provider', 'beta_credit',
      'betaCreditId', credit_row.id,
      'amountCents', 0,
      'packSize', 6,
      'grantSource', credit_row.granted_by,
      'grantReason', credit_row.reason,
      'redeemedAt', p_now,
      'parcelId', p_parcel_id,
      'siteProjectId', p_site_project_id
    )
  )
  RETURNING * INTO existing_pack;

  SELECT COALESCE(SUM(credits_granted - credits_used), 0)
  INTO v_remaining
  FROM public.site_potential_beta_credits
  WHERE user_id = p_user_id
    AND credits_used < credits_granted
    AND (expires_at IS NULL OR expires_at > p_now);

  RETURN QUERY
  SELECT existing_pack.id, credit_row.id, v_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_site_potential_beta_credit(uuid, text, uuid, text, timestamptz)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_site_potential_beta_credit(uuid, text, uuid, text, timestamptz)
TO service_role;

-- END 20260714113000_site_potential_beta_credits.sql

-- ============================================================
-- BEGIN 20260714124500_site_potential_pack_completion_status.sql
-- ============================================================
-- Repair Site Potential pack reconciliation so one finalized concept does not mark
-- the entire project ready. Keep the worker-only lease checks and service-role-only
-- execution model from the locked worker RPC migration.

CREATE OR REPLACE FUNCTION public.finalize_site_potential_item(
  p_worker_id text,
  p_item_id uuid,
  p_asset_id uuid,
  p_user_id uuid,
  p_parcel_id text,
  p_site_project_id uuid,
  p_asset_type text,
  p_storage_bucket text,
  p_storage_path text,
  p_original_file_name text,
  p_mime_type text,
  p_size_bytes integer,
  p_metadata jsonb,
  p_source_label text DEFAULT 'Easy Erf Site Potential AI concept'
)
RETURNS public.erf_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_row record;
  asset_row public.erf_assets;
  v_completed_count integer := 0;
  v_total_count integer := 0;
  v_failed_count integer := 0;
  v_remaining_count integer := 0;
  v_requested_count integer := 0;
  v_pack_status text := 'queued';
  v_project_status text := 'generating';
BEGIN
  SELECT item.*, pack.site_project_id, pack.parcel_id, pack.requested_count
  INTO item_row
  FROM public.erf_design_pack_items item
  JOIN public.erf_design_packs pack ON pack.id = item.design_pack_id
  WHERE item.id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Design pack item not found';
  END IF;

  IF item_row.status <> 'generating'
    OR item_row.worker_id IS DISTINCT FROM p_worker_id
    OR item_row.lease_expires_at IS NULL
    OR item_row.lease_expires_at <= now()
  THEN
    RAISE EXCEPTION 'Design pack item is not currently claimed by this worker';
  END IF;

  IF item_row.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Design pack item user mismatch';
  END IF;

  IF item_row.parcel_id <> p_parcel_id OR item_row.site_project_id <> p_site_project_id THEN
    RAISE EXCEPTION 'Design pack item project or parcel mismatch';
  END IF;

  IF item_row.generated_asset_id IS NOT NULL THEN
    SELECT *
    INTO asset_row
    FROM public.erf_assets
    WHERE id = item_row.generated_asset_id;
    RETURN asset_row;
  END IF;

  SELECT *
  INTO asset_row
  FROM public.erf_assets
  WHERE metadata->>'designPackItemId' = p_item_id::text
    AND asset_category = 'generated_design'
    AND user_id = p_user_id
    AND parcel_id = p_parcel_id
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.erf_assets (
      id,
      user_id,
      parcel_id,
      asset_category,
      asset_type,
      source_label,
      storage_bucket,
      storage_path,
      original_file_name,
      mime_type,
      size_bytes,
      status,
      metadata
    )
    VALUES (
      p_asset_id,
      p_user_id,
      p_parcel_id,
      'generated_design',
      p_asset_type,
      p_source_label,
      p_storage_bucket,
      p_storage_path,
      p_original_file_name,
      p_mime_type,
      p_size_bytes,
      'ready',
      p_metadata
    )
    RETURNING * INTO asset_row;
  END IF;

  INSERT INTO public.erf_site_project_assets (
    user_id,
    site_project_id,
    asset_id,
    role,
    display_order
  )
  VALUES (
    p_user_id,
    p_site_project_id,
    asset_row.id,
    'generated_option',
    item_row.option_index
  )
  ON CONFLICT (site_project_id, asset_id, role) DO NOTHING;

  UPDATE public.erf_design_pack_items
  SET
    status = 'complete',
    generated_asset_id = asset_row.id,
    worker_id = NULL,
    heartbeat_at = now(),
    lease_expires_at = NULL,
    failure_code = NULL,
    failure_message = NULL
  WHERE id = p_item_id;

  SELECT
    COUNT(*) FILTER (WHERE status = 'complete' AND generated_asset_id IS NOT NULL),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (
      WHERE generated_asset_id IS NULL
        AND (
          status IN ('queued', 'generating')
          OR (status = 'failed' AND COALESCE(attempt_count, 0) < 3)
        )
    )
  INTO v_completed_count, v_total_count, v_failed_count, v_remaining_count
  FROM public.erf_design_pack_items
  WHERE design_pack_id = item_row.design_pack_id;

  v_requested_count := COALESCE(NULLIF(item_row.requested_count, 0), v_total_count);

  v_pack_status := CASE
    WHEN v_completed_count >= v_requested_count THEN 'complete'
    WHEN v_remaining_count > 0 AND v_failed_count > 0 THEN 'partial_failed'
    WHEN v_remaining_count > 0 THEN 'queued'
    WHEN v_failed_count > 0 AND v_completed_count > 0 THEN 'partial_failed'
    WHEN v_failed_count > 0 THEN 'failed'
    ELSE 'queued'
  END;

  v_project_status := CASE
    WHEN v_pack_status = 'complete' THEN 'concepts_ready'
    WHEN v_remaining_count > 0 THEN 'generating'
    WHEN v_pack_status IN ('failed', 'partial_failed') THEN 'failed'
    ELSE 'generating'
  END;

  UPDATE public.erf_design_packs
  SET
    completed_count = v_completed_count,
    status = v_pack_status,
    worker_id = NULL,
    heartbeat_at = now(),
    lease_expires_at = NULL,
    failure_code = CASE WHEN v_pack_status = 'complete' THEN NULL ELSE failure_code END,
    failure_message = CASE WHEN v_pack_status = 'complete' THEN NULL ELSE failure_message END
  WHERE id = item_row.design_pack_id;

  UPDATE public.erf_site_projects
  SET generation_status = v_project_status
  WHERE id = p_site_project_id
    AND user_id = p_user_id;

  RETURN asset_row;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_site_potential_item(text, uuid, uuid, uuid, text, uuid, text, text, text, text, text, integer, jsonb, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_site_potential_item(text, uuid, uuid, uuid, text, uuid, text, text, text, text, text, integer, jsonb, text)
TO service_role;

-- END 20260714124500_site_potential_pack_completion_status.sql

-- ============================================================
-- BEGIN 20260714133000_site_potential_retryable_pack_reconciliation.sql
-- ============================================================
-- Align database pack reconciliation with the retry-aware TypeScript worker logic.
-- A retryable failed slot keeps the pack/project in progress; only exhausted packs
-- become terminal failed/partial_failed.

CREATE OR REPLACE FUNCTION public.finalize_site_potential_item(
  p_worker_id text,
  p_item_id uuid,
  p_asset_id uuid,
  p_user_id uuid,
  p_parcel_id text,
  p_site_project_id uuid,
  p_asset_type text,
  p_storage_bucket text,
  p_storage_path text,
  p_original_file_name text,
  p_mime_type text,
  p_size_bytes integer,
  p_metadata jsonb,
  p_source_label text DEFAULT 'Easy Erf Site Potential AI concept'
)
RETURNS public.erf_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_row record;
  asset_row public.erf_assets;
  v_completed_count integer := 0;
  v_total_count integer := 0;
  v_failed_count integer := 0;
  v_generating_count integer := 0;
  v_eligible_count integer := 0;
  v_requested_count integer := 0;
  v_pack_status text := 'queued';
  v_project_status text := 'generating';
BEGIN
  SELECT item.*, pack.site_project_id, pack.parcel_id, pack.requested_count
  INTO item_row
  FROM public.erf_design_pack_items item
  JOIN public.erf_design_packs pack ON pack.id = item.design_pack_id
  WHERE item.id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Design pack item not found';
  END IF;

  IF item_row.status <> 'generating'
    OR item_row.worker_id IS DISTINCT FROM p_worker_id
    OR item_row.lease_expires_at IS NULL
    OR item_row.lease_expires_at <= now()
  THEN
    RAISE EXCEPTION 'Design pack item is not currently claimed by this worker';
  END IF;

  IF item_row.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Design pack item user mismatch';
  END IF;

  IF item_row.parcel_id <> p_parcel_id OR item_row.site_project_id <> p_site_project_id THEN
    RAISE EXCEPTION 'Design pack item project or parcel mismatch';
  END IF;

  IF item_row.generated_asset_id IS NOT NULL THEN
    SELECT *
    INTO asset_row
    FROM public.erf_assets
    WHERE id = item_row.generated_asset_id;
    RETURN asset_row;
  END IF;

  SELECT *
  INTO asset_row
  FROM public.erf_assets
  WHERE metadata->>'designPackItemId' = p_item_id::text
    AND asset_category = 'generated_design'
    AND user_id = p_user_id
    AND parcel_id = p_parcel_id
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.erf_assets (
      id,
      user_id,
      parcel_id,
      asset_category,
      asset_type,
      source_label,
      storage_bucket,
      storage_path,
      original_file_name,
      mime_type,
      size_bytes,
      status,
      metadata
    )
    VALUES (
      p_asset_id,
      p_user_id,
      p_parcel_id,
      'generated_design',
      p_asset_type,
      p_source_label,
      p_storage_bucket,
      p_storage_path,
      p_original_file_name,
      p_mime_type,
      p_size_bytes,
      'ready',
      p_metadata
    )
    RETURNING * INTO asset_row;
  END IF;

  INSERT INTO public.erf_site_project_assets (
    user_id,
    site_project_id,
    asset_id,
    role,
    display_order
  )
  VALUES (
    p_user_id,
    p_site_project_id,
    asset_row.id,
    'generated_option',
    item_row.option_index
  )
  ON CONFLICT (site_project_id, asset_id, role) DO NOTHING;

  UPDATE public.erf_design_pack_items
  SET
    status = 'complete',
    generated_asset_id = asset_row.id,
    worker_id = NULL,
    heartbeat_at = now(),
    lease_expires_at = NULL,
    failure_code = NULL,
    failure_message = NULL
  WHERE id = p_item_id;

  SELECT
    COUNT(*) FILTER (WHERE status = 'complete' AND generated_asset_id IS NOT NULL),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'generating'),
    COUNT(*) FILTER (
      WHERE generated_asset_id IS NULL
        AND (
          status IN ('queued', 'generating')
          OR (status = 'failed' AND COALESCE(attempt_count, 0) < 3)
        )
    )
  INTO
    v_completed_count,
    v_total_count,
    v_failed_count,
    v_generating_count,
    v_eligible_count
  FROM public.erf_design_pack_items
  WHERE design_pack_id = item_row.design_pack_id;

  v_requested_count := COALESCE(NULLIF(item_row.requested_count, 0), v_total_count);

  v_pack_status := CASE
    WHEN v_completed_count >= v_requested_count THEN 'complete'
    WHEN v_generating_count > 0 THEN 'generating'
    WHEN v_failed_count > 0 AND v_eligible_count > 0 THEN 'partial_failed'
    WHEN v_eligible_count > 0 THEN 'queued'
    WHEN v_failed_count > 0 AND v_completed_count > 0 THEN 'partial_failed'
    WHEN v_failed_count > 0 THEN 'failed'
    ELSE 'queued'
  END;

  v_project_status := CASE
    WHEN v_pack_status = 'complete' THEN 'concepts_ready'
    WHEN v_eligible_count > 0 OR v_pack_status IN ('queued', 'generating') THEN 'generating'
    WHEN v_pack_status IN ('failed', 'partial_failed') THEN 'failed'
    ELSE 'generating'
  END;

  UPDATE public.erf_design_packs
  SET
    completed_count = v_completed_count,
    status = v_pack_status,
    worker_id = NULL,
    heartbeat_at = now(),
    lease_expires_at = NULL,
    failure_code = CASE WHEN v_pack_status = 'complete' THEN NULL ELSE failure_code END,
    failure_message = CASE WHEN v_pack_status = 'complete' THEN NULL ELSE failure_message END
  WHERE id = item_row.design_pack_id;

  UPDATE public.erf_site_projects
  SET generation_status = v_project_status
  WHERE id = p_site_project_id
    AND user_id = p_user_id;

  RETURN asset_row;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_site_potential_item(text, uuid, uuid, uuid, text, uuid, text, text, text, text, text, integer, jsonb, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_site_potential_item(text, uuid, uuid, uuid, text, uuid, text, text, text, text, text, integer, jsonb, text)
TO service_role;

-- END 20260714133000_site_potential_retryable_pack_reconciliation.sql

-- Record each source migration version in migration history.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('20260713090000', 'erf_file_vault_site_potential', ARRAY[]::text[]),
  ('20260713100000', 'repair_site_potential_security_jobs', ARRAY[]::text[]),
  ('20260714090000', 'site_potential_durable_generation_jobs', ARRAY[]::text[]),
  ('20260714103000', 'lock_site_potential_worker_rpc_leases', ARRAY[]::text[]),
  ('20260714113000', 'site_potential_beta_credits', ARRAY[]::text[]),
  ('20260714124500', 'site_potential_pack_completion_status', ARRAY[]::text[]),
  ('20260714133000', 'site_potential_retryable_pack_reconciliation', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;
