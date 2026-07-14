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
