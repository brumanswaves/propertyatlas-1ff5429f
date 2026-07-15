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

  UPDATE public.erf_design_pack_items AS item
  SET
    status = 'generating',
    worker_id = p_worker_id,
    claimed_at = p_now,
    heartbeat_at = p_now,
    lease_expires_at = p_lease_expires_at,
    attempt_count = item.attempt_count + 1,
    failure_code = NULL,
    failure_message = NULL
  WHERE item.id = claimed.id
  RETURNING item.attempt_count INTO v_attempt_count;

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