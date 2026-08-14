-- Site Potential worker transport is private runtime configuration, not a
-- deployment-specific URL. The scheduler remains inert until both values exist.
CREATE OR REPLACE FUNCTION private.invoke_site_potential_worker(p_max_items integer DEFAULT 1)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, extensions, public
AS $$
DECLARE
  v_secret text;
  v_url text;
  v_request_id bigint;
BEGIN
  SELECT NULLIF(btrim(value), '')
  INTO v_secret
  FROM private.worker_secrets
  WHERE name = 'site_potential_worker_secret';

  IF v_secret IS NULL THEN
    RAISE NOTICE 'Site Potential worker secret is not configured; skipping cycle.';
    RETURN NULL;
  END IF;

  SELECT NULLIF(btrim(value), '')
  INTO v_url
  FROM private.worker_secrets
  WHERE name = 'site_potential_worker_url';

  IF v_url IS NULL THEN
    RAISE NOTICE 'Site Potential worker URL is not configured; skipping cycle.';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Site-Potential-Worker-Secret', v_secret
    ),
    body := jsonb_build_object('maxItems', p_max_items),
    timeout_milliseconds := 55000
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION private.invoke_site_potential_worker(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.invoke_site_potential_worker(integer) TO postgres, service_role;
