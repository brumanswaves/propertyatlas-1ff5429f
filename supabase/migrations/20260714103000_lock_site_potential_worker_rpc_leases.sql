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
