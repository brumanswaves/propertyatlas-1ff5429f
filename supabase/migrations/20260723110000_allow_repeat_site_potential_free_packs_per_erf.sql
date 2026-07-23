-- Site Potential free allowance is user-based, not parcel-based.
-- This replaces the entitlement redemption function so a prior free pack
-- for the same erf does not independently block another free pack.

CREATE OR REPLACE FUNCTION public.redeem_site_potential_pack_v2(
  p_user_id uuid,
  p_parcel_id text,
  p_site_project_id uuid,
  p_request_id text,
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE (
  design_pack_id uuid,
  entitlement_source text,
  purchased_credits_remaining integer,
  beta_credits_remaining integer,
  free_used_24h integer,
  free_used_7d integer,
  free_used_30d integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project record;
  v_pack record;
  v_credit record;
  v_wallet record;
  v_provider text;
  v_payment_reference text;
  v_idempotency_key text := 'site-potential-v2:' || p_request_id;
  v_used_24 integer := 0;
  v_used_7 integer := 0;
  v_used_30 integer := 0;
  v_purchased_remaining integer := 0;
  v_beta_remaining integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT * INTO v_project
  FROM public.erf_site_projects
  WHERE id = p_site_project_id
    AND user_id = p_user_id
    AND parcel_id = p_parcel_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Site Potential project not found'; END IF;
  IF v_project.mode NOT IN ('vacant_land', 'renovation') THEN
    RAISE EXCEPTION 'Site Potential project is not ready for concept generation';
  END IF;

  SELECT * INTO v_pack
  FROM public.erf_design_packs
  WHERE user_id = p_user_id AND idempotency_key = v_idempotency_key;

  IF FOUND THEN
    SELECT COALESCE(balance, 0) INTO v_purchased_remaining
    FROM public.site_potential_credit_wallets WHERE user_id = p_user_id;
    SELECT COALESCE(SUM(credits_granted - credits_used), 0)
      INTO v_beta_remaining
    FROM public.site_potential_beta_credits
    WHERE user_id = p_user_id
      AND credits_used < credits_granted
      AND (expires_at IS NULL OR expires_at > p_now);
    RETURN QUERY SELECT v_pack.id, COALESCE(v_pack.payment_provider, 'unknown'),
      v_purchased_remaining, v_beta_remaining, 0, 0, 0;
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE created_at >= p_now - interval '24 hours'),
    COUNT(*) FILTER (WHERE created_at >= p_now - interval '7 days'),
    COUNT(*)
  INTO v_used_24, v_used_7, v_used_30
  FROM public.erf_design_packs
  WHERE user_id = p_user_id
    AND payment_provider = 'free_allowance'
    AND entitlement_status = 'paid'
    AND created_at >= p_now - interval '30 days';

  IF v_used_24 < 1 AND v_used_7 < 3 AND v_used_30 < 6 THEN
    v_provider := 'free_allowance';
    v_payment_reference := NULL;
  ELSE
    SELECT * INTO v_credit
    FROM public.site_potential_beta_credits
    WHERE user_id = p_user_id
      AND credits_used < credits_granted
      AND (expires_at IS NULL OR expires_at > p_now)
    ORDER BY expires_at ASC NULLS LAST, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.site_potential_beta_credits
      SET credits_used = credits_used + 1
      WHERE id = v_credit.id;
      v_provider := 'beta_credit';
      v_payment_reference := v_credit.id::text;
    ELSE
      SELECT * INTO v_wallet
      FROM public.site_potential_credit_wallets
      WHERE user_id = p_user_id
      FOR UPDATE;

      IF NOT FOUND OR v_wallet.balance <= 0 THEN
        RAISE EXCEPTION 'NO_SITE_POTENTIAL_ENTITLEMENT';
      END IF;

      UPDATE public.site_potential_credit_wallets
      SET balance = balance - 1
      WHERE user_id = p_user_id
      RETURNING balance INTO v_purchased_remaining;
      v_provider := 'site_potential_credit';
      v_payment_reference := p_user_id::text;
    END IF;
  END IF;

  INSERT INTO public.erf_design_packs (
    user_id, parcel_id, site_project_id, payment_provider, payment_reference,
    entitlement_status, idempotency_key, requested_count, completed_count,
    status, prompt_snapshot
  ) VALUES (
    p_user_id, p_parcel_id, p_site_project_id, v_provider, v_payment_reference,
    'paid', v_idempotency_key, 3, 0, 'queued',
    jsonb_build_object(
      'provider', v_provider,
      'packSize', 3,
      'requestId', p_request_id,
      'redeemedAt', p_now,
      'parcelId', p_parcel_id,
      'siteProjectId', p_site_project_id
    )
  ) RETURNING * INTO v_pack;

  IF v_provider = 'site_potential_credit' THEN
    INSERT INTO public.site_potential_credit_ledger (
      user_id, entry_type, credits_delta, balance_after, design_pack_id,
      idempotency_key, metadata
    ) VALUES (
      p_user_id, 'reserved', -1, v_purchased_remaining, v_pack.id,
      'reserved:' || v_pack.id::text,
      jsonb_build_object('packSize', 3, 'parcelId', p_parcel_id)
    );
  END IF;

  SELECT COALESCE(balance, 0) INTO v_purchased_remaining
  FROM public.site_potential_credit_wallets WHERE user_id = p_user_id;
  SELECT COALESCE(SUM(credits_granted - credits_used), 0)
    INTO v_beta_remaining
  FROM public.site_potential_beta_credits
  WHERE user_id = p_user_id
    AND credits_used < credits_granted
    AND (expires_at IS NULL OR expires_at > p_now);

  RETURN QUERY SELECT v_pack.id, v_provider, v_purchased_remaining,
    v_beta_remaining, v_used_24, v_used_7, v_used_30;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_site_potential_pack_v2(
  uuid, text, uuid, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_site_potential_pack_v2(
  uuid, text, uuid, text, timestamptz
) TO service_role;
