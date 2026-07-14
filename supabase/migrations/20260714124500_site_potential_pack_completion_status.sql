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
