# Site Potential Worker Deployment

Site Potential generation is durable only when a trusted scheduler invokes the worker endpoint.

## Canonical Production Worker

The founder-owned production worker is the Supabase Edge Function:

```text
POST https://<project-ref>.supabase.co/functions/v1/site-potential-worker
```

The production database scheduler stores the exact worker URL and worker secret in `private.worker_secrets`. The `private.invoke_site_potential_worker(integer)` function reads those values and calls the worker through `pg_net`. If either value is missing, the scheduler is intentionally inert.

Legacy TanStack server routes remain available during migration and rollback:

```text
POST /api/site-potential/process
POST /api/public/site-potential/process
```

They use the same shared request handler, but the founder-owned Supabase Edge Function is the target durable runtime.

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

## Required Runtime Configuration

The Edge Function loads custom values from encrypted Supabase Vault at runtime. Required application values are never committed to GitHub and are never exposed to the browser.

- `SITE_POTENTIAL_GENERATION_ENABLED=true` only after staging verification passes.
- `SITE_POTENTIAL_WORKER_ENABLED=true` for the trusted worker runtime.
- `SITE_POTENTIAL_WORKER_SECRET` stored only in trusted backend configuration.
- `SUPABASE_SERVICE_ROLE_KEY` supplied by the hosted Supabase runtime only.
- `OPENAI_API_KEY` stored only in encrypted backend configuration.
- Image model, size, quality and output format may also be supplied from encrypted Vault.

Never expose the worker secret, service-role key, or OpenAI key to the browser.

## Processing Rules

The scheduler should:

1. Run often enough to drain queued packs.
2. Retry invocation failures safely.
3. Continue calling the endpoint until no eligible slots are returned.
4. Let the database lease/recovery functions handle abandoned slots.
5. Keep production generation disabled until one complete three-image pack passes end-to-end verification.

## Cutover Checklist

Before enabling the founder-owned scheduler:

1. Deploy all canonical Site Potential migrations.
2. Confirm worker RPC execution is service-role only.
3. Confirm the Edge Function rejects an incorrect worker secret with HTTP 401.
4. Confirm the correct worker secret succeeds against an empty queue with zero claimed items.
5. Confirm browser anon/authenticated clients cannot call worker RPCs.
6. Populate `private.worker_secrets.site_potential_worker_url` with the founder-owned Edge Function URL.
7. Populate `private.worker_secrets.site_potential_worker_secret` with the matching worker secret.
8. Confirm the scheduled invocation succeeds without exposing the secret in logs.
9. Exercise one real three-image Site Potential pack end-to-end.
10. Confirm generated assets are linked to the correct user, parcel, project and design-pack items.
11. Confirm stale lease recovery works after a forced worker interruption.

## Rollback

Keep the legacy worker routes available during the migration window. To stop the founder-owned scheduler without touching application data, remove or blank either private worker configuration value so `private.invoke_site_potential_worker(integer)` returns without making a network request.
