
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'site-potential-worker-every-minute';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'site-potential-worker-every-minute',
  '* * * * *',
  $$SELECT private.invoke_site_potential_worker(1);$$
);
