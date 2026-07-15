-- Site Potential v2: three independent concepts, free rolling allowances,
-- purchased-credit groundwork, and independent worker claims.

ALTER TABLE public.erf_design_packs
  ALTER COLUMN requested_count SET DEFAULT 3;

CREATE TABLE IF NOT EXISTS public.site_potential_credit_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased integer NOT NULL DEFAULT 0 CHECK (lifetime_purchased >= 0),
  lifetime_consumed integer NOT NULL DEFAULT 0 CHECK (lifetime_consumed >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_potential_credit_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own Site Potential wallet" ON public.site_potential_credit_wallets;
CREATE POLICY "users read own Site Potential wallet"
ON public.site_potential_credit_wallets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS site_potential_credit_wallets_set_updated_at
ON public.site_potential_credit_wallets;
CREATE TRIGGER site_potential_credit_wallets_set_updated_at
BEFORE UPDATE ON public.site_potential_credit_wallets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.site_potential_credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_provider text,
  provider_reference text,
  credit_count integer NOT NULL CHECK (credit_count IN (5, 10, 25)),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')
  ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_provider, provider_reference)
);

ALTER TABLE public.site_potential_credit_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own Site Potential purchases"
ON public.site_potential_credit_purchases;
CREATE POLICY "users read own Site Potential purchases"
ON public.site_potential_credit_purchases FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS site_potential_credit_purchases_set_updated_at
ON public.site_potential_credit_purchases;
CREATE TRIGGER site_potential_credit_purchases_set_updated_at
BEFORE UPDATE ON public.site_potential_credit_purchases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.site_potential_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (
    entry_type IN ('purchase', 'reserved', 'consumed', 'restored', 'admin_adjustment', 'refund')
  ),
  credits_delta integer NOT NULL,
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  design_pack_id uuid REFERENCES public.erf_design_packs(id) ON DELETE SET NULL,
  purchase_id uuid REFERENCES public.site_potential_credit_purchases(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_potential_credit_ledger_user_created_idx
ON public.site_potential_credit_ledger (user_id, created_at DESC);

ALTER TABLE public.site_potential_credit_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own Site Potential credit ledger"
ON public.site_potential_credit_ledger;
CREATE POLICY "users read own Site Potential credit ledger"
ON public.site_potential_credit_ledger FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.grant_site_potential_credits(
  p_user_id uuid,
  p_credits integer,
  p_entry_type text,
  p_idempotency_key text,
  p_purchase_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF p_credits <= 0 THEN
    RAISE EXCEPTION 'Credit grant must be positive';
  END IF;
  IF p_entry_type NOT IN ('purchase', 'admin_adjustment', 'refund') THEN
    RAISE EXCEPTION 'Invalid credit grant entry type';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.site_potential_credit_ledger
    WHERE idempotency_key = p_idempotency_key
  ) THEN
    SELECT balance INTO v_balance
    FROM public.site_potential_credit_wallets
    WHERE user_id = p_user_id;
    RETURN COALESCE(v_balance, 0);
  END IF;

  INSERT INTO public.site_potential_credit_wallets (
    user_id, balance, lifetime_purchased, lifetime_consumed
  )
  VALUES (
    p_user_id,
    p_credits,
    CASE WHEN p_entry_type = 'purchase' THEN p_credits ELSE 0 END,
    0
  )
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.site_potential_credit_wallets.balance + EXCLUDED.balance,
      lifetime_purchased = public.site_potential_credit_wallets.lifetime_purchased
        + EXCLUDED.lifetime_purchased
  RETURNING balance INTO v_balance;

  INSERT INTO public.site_potential_credit_ledger (
    user_id, entry_type, credits_delta, balance_after,
    purchase_id, idempotency_key, metadata
  )
  VALUES (
    p_user_id, p_entry_type, p_credits, v_balance,
    p_purchase_id, p_idempotency_key, COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_site_potential_credits(
  uuid, integer, text, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_site_potential_credits(
  uuid, integer, text, text, uuid, jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_site_potential_pack_v2(
  p_user_id uuid,
  p_parcel_id text,
  p_site_project_id uuid,
  p_request_id text,
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE(
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
  v_same_parcel_30 integer := 0;
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
    COUNT(*),
    COUNT(*) FILTER (WHERE parcel_id = p_parcel_id)
  INTO v_used_24, v_used_7, v_used_30, v_same_parcel_30
  FROM public.erf_design_packs
  WHERE user_id = p_user_id
    AND payment_provider = 'free_allowance'
    AND entitlement_status = 'paid'
    AND created_at >= p_now - interval '30 days';

  IF v_used_24 < 1 AND v_used_7 < 3 AND v_used_30 < 6 AND v_same_parcel_30 < 1 THEN
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

CREATE OR REPLACE FUNCTION public.settle_site_potential_pack_entitlement(
  p_design_pack_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack record;
  v_completed integer := 0;
  v_retryable integer := 0;
  v_balance integer := 0;
  v_inserted integer := 0;
BEGIN
  SELECT * INTO v_pack
  FROM public.erf_design_packs
  WHERE id = p_design_pack_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_pack.payment_provider NOT IN ('free_allowance', 'site_potential_credit') THEN RETURN; END IF;
  IF v_pack.entitlement_status IN ('refunded', 'cancelled') THEN RETURN; END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'complete' AND generated_asset_id IS NOT NULL),
    COUNT(*) FILTER (
      WHERE generated_asset_id IS NULL
        AND (status IN ('queued', 'generating') OR (status = 'failed' AND attempt_count < 3))
    )
  INTO v_completed, v_retryable
  FROM public.erf_design_pack_items
  WHERE design_pack_id = p_design_pack_id;

  IF v_completed >= v_pack.requested_count THEN
    IF v_pack.payment_provider = 'site_potential_credit' THEN
      SELECT COALESCE(balance, 0) INTO v_balance
      FROM public.site_potential_credit_wallets
      WHERE user_id = v_pack.user_id;
      INSERT INTO public.site_potential_credit_ledger (
        user_id, entry_type, credits_delta, balance_after, design_pack_id,
        idempotency_key, metadata
      ) VALUES (
        v_pack.user_id, 'consumed', 0, v_balance, v_pack.id,
        'consumed:' || v_pack.id::text,
        jsonb_build_object('completedCount', v_completed)
      ) ON CONFLICT (idempotency_key) DO NOTHING;
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      IF v_inserted > 0 THEN
        UPDATE public.site_potential_credit_wallets
        SET lifetime_consumed = lifetime_consumed + 1
        WHERE user_id = v_pack.user_id;
      END IF;
    END IF;
    RETURN;
  END IF;

  IF v_retryable = 0 THEN
    UPDATE public.erf_design_packs
    SET entitlement_status = 'refunded'
    WHERE id = v_pack.id AND entitlement_status = 'paid';

    IF v_pack.payment_provider = 'site_potential_credit' THEN
      INSERT INTO public.site_potential_credit_wallets (user_id, balance)
      VALUES (v_pack.user_id, 1)
      ON CONFLICT (user_id) DO UPDATE
      SET balance = public.site_potential_credit_wallets.balance + 1
      RETURNING balance INTO v_balance;

      INSERT INTO public.site_potential_credit_ledger (
        user_id, entry_type, credits_delta, balance_after, design_pack_id,
        idempotency_key, metadata
      ) VALUES (
        v_pack.user_id, 'restored', 1, v_balance, v_pack.id,
        'restored:' || v_pack.id::text,
        jsonb_build_object('reason', 'Pack did not complete all three concepts')
      ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_site_potential_pack_entitlement(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_site_potential_pack_entitlement(uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.site_potential_pack_item_settlement_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.settle_site_potential_pack_entitlement(
    COALESCE(NEW.design_pack_id, OLD.design_pack_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS site_potential_pack_item_settlement
ON public.erf_design_pack_items;
CREATE TRIGGER site_potential_pack_item_settlement
AFTER INSERT OR UPDATE OF status, generated_asset_id, attempt_count
ON public.erf_design_pack_items
FOR EACH ROW EXECUTE FUNCTION public.site_potential_pack_item_settlement_trigger();

-- Three v2 concepts are independent; no option waits for option 1 and no generated
-- concept is used as a reference for another concept.
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

  SELECT item.id, item.user_id, item.design_pack_id,
         pack.site_project_id, pack.parcel_id, item.option_index
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
  ORDER BY pack.created_at ASC, item.option_index ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.erf_design_packs
  SET status = 'generating', worker_id = p_worker_id,
      claimed_at = COALESCE(claimed_at, p_now), heartbeat_at = p_now,
      lease_expires_at = p_lease_expires_at,
      failure_code = NULL, failure_message = NULL
  WHERE id = claimed.design_pack_id;

  UPDATE public.erf_design_pack_items AS item
  SET status = 'generating', worker_id = p_worker_id,
      claimed_at = p_now, heartbeat_at = p_now,
      lease_expires_at = p_lease_expires_at,
      attempt_count = item.attempt_count + 1,
      failure_code = NULL, failure_message = NULL
  WHERE item.id = claimed.id
  RETURNING item.attempt_count INTO v_attempt_count;

  RETURN QUERY SELECT claimed.id, claimed.user_id, claimed.design_pack_id,
    claimed.site_project_id, claimed.parcel_id, claimed.option_index,
    v_attempt_count;
END;
$$;
