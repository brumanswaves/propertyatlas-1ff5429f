# Diagnosis: Ask Easy Erf "temporarily unavailable" on live

## Exact failing layer
Server-side OpenAI call inside `askOpenAI()` in `src/lib/reports/askEasyErfServer.ts`. Everything upstream (route, auth, evidence build, validation) succeeds.

## Exact error/status
- Live route returns **HTTP 502** with `{"success":false,"code":"SERVER_UNAVAILABLE","error":"Ask Easy Erf is temporarily unavailable."}` — the exact string the user sees.
- Cause: the request to `https://api.openai.com/v1/chat/completions` comes back non-OK and non-429, so the handler collapses it into `SERVER_UNAVAILABLE`. Most probable upstream status is **400 invalid_request_error** — the response schema sets `strict: true` while using `minItems: 1` on `evidenceReferences` (line 333 of `askEasyErfServer.ts`). `minItems`/`maxItems` are not permitted keywords in OpenAI Structured Outputs strict mode; OpenAI rejects the whole request with "Invalid schema for response_format".

## Evidence
1. **Route is deployed and reachable.** `POST https://easyerf.lovable.app/api/reports/ask-easy-erf` → `401 {"code":"AUTH_REQUIRED"}`; `OPTIONS` → `204`. Route is registered in `src/routeTree.gen.ts` (id `/api/reports/ask-easy-erf`). No import crash, no route-generation issue, no Cloudflare/TanStack incompatibility.
2. **Route executes and returns JSON — it does not crash.** Published worker logs for the user's actual attempts:
   - `17:52:14 POST /api/reports/ask-easy-erf → 502` (x2)
   - `17:53:08 POST /api/reports/ask-easy-erf → 502` (x2)
   A crash/unhandled throw would surface as the HTML 500 error page from `src/server.ts`, not 502.
3. **Auth succeeded.** A failed `authenticateApiRequest` returns 401 (as our anonymous probe did). The live attempts returned 502, which is only reachable after auth, JSON parse, parcel match, and evidence sufficiency checks pass.
4. **Env values present to the deployed runtime.** `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: present (auth path executed and returned a normal 401/2xx rather than the 500 "Supabase server environment is not configured"). `OPENAI_API_KEY`: present in project secrets, and confirmed reachable by the runtime because a missing key short-circuits to **503 `OPENAI_NOT_CONFIGURED`**, not 502.
5. **Client-side payload build did not throw.** A throw from `buildAskEasyErfSelectedEvidencePayload` is caught at `ErfResearchDossier.tsx:3001-3008` and would produce the same message *without any network request*. The 502 log entries prove the request reached the server, so the ownership-gap path built a valid payload (the `fallbackMissingEvidenceSource` "S1" branch covers the ownership-gap-only state).
6. **Not a size/validation failure.** Over-32KB bodies return **413**, schema failures return **400**, parcel mismatch **409**, thin evidence **400**. Observed status is 502.
7. **OpenAI was reached.** 502 is emitted only from `askOpenAI` — either non-OK upstream or a thrown fetch. `MALFORMED_MODEL_RESPONSE` (also 502) carries a different message ("returned an invalid answer"), so the observed message pins it to `SERVER_UNAVAILABLE`, i.e. the upstream HTTP response was non-OK.
8. **No upstream detail is recorded** because `askOpenAI` discards `payload.error.message` and never logs it — this is why the worker log shows only the status. That blind spot is itself part of the defect.

## Minimal repair required
1. Remove `minItems: 1` from the `evidenceReferences` array in `answerResponseFormat()` (keep `strict: true`), and enforce "at least one reference" in `validateAnswerAgainstSelectedEvidence` instead — it already resolves refs and can reject an empty list.
2. Add server-side `console.error` of the upstream `response.status` and `payload.error.type/code/message` (no key, no prompt content) before returning `SERVER_UNAVAILABLE`, so any residual upstream failure is observable in worker logs.
3. Optionally distinguish upstream 4xx from 5xx in `AskEasyErfErrorCode` so a schema/model rejection is not reported to users as a transient outage.

## What is required
- **Code change: yes** (the two edits above, in `src/lib/reports/askEasyErfServer.ts` only).
- **Secret configuration: no.** `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` are all present and bound to the deployed runtime.
- **Republish: yes.** The fix is in server code compiled into the worker, so production must be republished after the change.

No files were edited, no commits, no deploys, no secret changes.
