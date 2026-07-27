## Verification results (commit 671af4d6, read-only)

**1. Unauthenticated POST `{}`**
- Status: `401`
- Body: `{"success":false,"code":"AUTH_REQUIRED","error":"Unauthorized.","requestId":"af472ecb-…"}`
- Correct: the function is deployed, boots, and rejects unauthenticated callers with the app-level contract (not a proxy error).

**2. Authenticated server-to-server POST (synthetic fixture)**
- Payload: `parcelId: fixture-parcel`, question `Who owns this property?`, one `S1` source of type `missing`, zero claims/contradictions, one ownership gap. No real data used.
- Sent with `Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY` (and a retry adding `apikey`).
- Status: `401` in both attempts, ~0.14s. OpenAI was never reached.

**3. Safe JSON response**
- `success`: **false** (`AUTH_REQUIRED`)
- Owner invention: n/a — no model answer produced
- Evidence ref resolution to `S1`: n/a
- Response time: 0.140s / 0.150s

**4. Edge Function logs (fixture request IDs)**
- `stage: auth_rejected` for `fixture-verify-671af4d6` and `fixture-verify-671af4d6-b`
- `booted (time: 18ms)` on each invocation
- No `openai_request_start`, no OpenAI status, no reference count — execution stops at the auth gate.

**Root cause of test 2 failing:** the service-role value available in this sandbox environment (legacy `eyJ…` JWT) is not byte-identical to the `SUPABASE_SERVICE_ROLE_KEY` the deployed function reads at runtime, so `safeEqual` fails. This is an out-of-band test-caller mismatch, not necessarily a defect in the production path — the published TanStack route reads its own `SUPABASE_SERVICE_ROLE_KEY` from the worker environment, which may or may not match the function's injected value. That remains unproven.

**5. Publish status of 671af4d6**
- `https://easyerf.lovable.app/` responds `200`, but the served commit cannot be identified from public output. There is no evidence in this session that 671af4d6 was published; it is present in the working tree/preview only. Not published by me.

## Precise next action

Prove the shared-secret path end to end rather than guessing:

1. Add an explicit shared secret for this hop (for example `ASK_EASY_ERF_FN_SECRET`) via `generate_secret`, so both the published worker and the Edge Function compare one value that is not tied to Supabase's key-format migration.
2. Change the Edge Function's auth check to accept that secret (keeping service-role acceptance as a fallback if desired), and make `askEasyErfServer.ts` send it.
3. Redeploy the Edge Function, re-run the fixture probe, and confirm logs show `openai_request_start` → `openai_response status 200` → `answer_ready referenceCount 1`.
4. Only then publish and re-test on `easyerf.lovable.app`.

No code, secrets, deployments, or publishes were changed in this verification.
