# Site Potential Worker Deployment

Site Potential generation is durable only when a trusted scheduler invokes the worker endpoint.

## Required Worker Invocation

Deploy one of these trusted server-side mechanisms:

- Supabase scheduled Edge Function
- hosting-platform cron job
- external authenticated worker

The scheduler must call:

```text
POST /api/site-potential/process
```

Headers:

```text
Authorization: Bearer <SITE_POTENTIAL_WORKER_SECRET>
```

or:

```text
X-Site-Potential-Worker-Secret: <SITE_POTENTIAL_WORKER_SECRET>
```

Body:

```json
{ "maxItems": 1 }
```

Use a `maxItems` value that fits comfortably inside the host timeout. A value of `1` is safest for short serverless windows. The endpoint can be called frequently; leases, retry delays, and idempotent finalisation protect duplicate work.

## Required Environment

- `SITE_POTENTIAL_GENERATION_ENABLED=true` only after staging verification passes.
- `SITE_POTENTIAL_WORKER_ENABLED=true` for the trusted worker environment.
- `SITE_POTENTIAL_WORKER_SECRET` configured only in server/scheduler secrets.
- `SUPABASE_SERVICE_ROLE_KEY` configured only server-side.
- `OPENAI_API_KEY` configured only server-side.

Never expose the worker secret, service-role key, or OpenAI key to the browser.

## Processing Rules

The scheduler should:

1. Run often enough to drain queued packs.
2. Retry invocation failures safely.
3. Continue calling the endpoint until no eligible slots are returned.
4. Let the database lease/recovery functions handle abandoned slots.
5. Keep production generation disabled until one complete six-image pack passes end-to-end staging verification.

## Staging Checklist

Before enabling production generation:

1. Deploy the Site Potential migrations.
2. Confirm worker RPC execution is service-role only.
3. Confirm the scheduler can call the worker endpoint with the secret.
4. Confirm browser anon/authenticated clients cannot call worker RPCs.
5. Exercise one renovation pack using a real uploaded source photo.
6. Confirm options 2 through 6 reference option 1 as the primary concept.
7. Confirm exactly six canonical generated assets are linked to the pack.
8. Confirm stale lease recovery works after a forced worker interruption.
