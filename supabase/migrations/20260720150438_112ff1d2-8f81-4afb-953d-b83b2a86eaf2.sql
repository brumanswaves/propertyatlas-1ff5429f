
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.worker_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.worker_secrets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.worker_secrets TO service_role;

CREATE OR REPLACE FUNCTION private.invoke_site_potential_worker(p_max_items integer DEFAULT 1)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, extensions, public
AS $$
DECLARE
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT value INTO v_secret FROM private.worker_secrets WHERE name = 'site_potential_worker_secret';
  IF v_secret IS NULL THEN
    RAISE NOTICE 'Site Potential worker secret is not configured; skipping cycle.';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://erfstoep.lovable.app/api/public/site-potential/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Site-Potential-Worker-Secret', v_secret
    ),
    body := jsonb_build_object('maxItems', p_max_items),
    timeout_milliseconds := 55000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION private.invoke_site_potential_worker(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.invoke_site_potential_worker(integer) TO postgres, service_role;
