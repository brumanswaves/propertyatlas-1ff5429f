# Easy Erf final payment-activation package
Status: PREPARED, BLOCKED on runtime binding, safe signed-event method and actual fees. Not authorization to execute.
Prepared 2026-10-02. Original acceptance budget remains USD10, not renewed.

## Customer acceptance executed
Normal signed-in Google session: the authorized bound customer account (also an admin). Account page also shows admin role; this is not non-admin RLS isolation proof.
The exact delivered order fd14b0c1-410d-4aec-beaa-5b5d133e56cf opened through /orders?report=... as a Human-reviewed investigation.
Reviewer identity was displayed, 2026/10/02 11:29:20.
Version 70069545-2ccc-4b4f-8c8c-f4bc7557e58c; evidence revision60; brief revision1.
Back to reports then showed EE-FD14B0C1 under Finished reports, finished02 Oct2026. No other report opened.
The same-account customer route filters user_id and exact selected report ID and rejects mismatched returned rows; the UI does not expose the session UUID, so a separate UUID trace was not collected.
Concrete content limitation: displayed assessment text is "ddddd". The approved version was not rewritten, reapproved or redelivered. No further human content review was requested.
Print control is visible but printable output was not exercised. No second map-bearing opening: cumulative map reservation10/10, static images0/5, geometry save1/1 consumed. Owner-reported delivery is already consumed and cannot be repeated.
Screenshot capture failed with supported-browser CDP focus timeout; accessibility observations above succeeded. Existing Stripe-tab attachment also failed through both supported wrapper and DOM interface. No debugger workaround, installation, permission change or credential export.

## Precise payment diagnosis
Canonical backend: xiqpfhsdlvwrwhclonsg.
Deployed easy-erf-founder-launch-readiness version16 ACTIVE retrieved read-only. It constructs Stripe from STRIPE_SECRET_KEY and calls stripe.accounts.retrieve(null). It does not supply an explicit Stripe-Account override.
It tests:
- business_profile.name.trim().toLowerCase() === "easy erf"
- business_profile.url parsed hostname, lowercased with leading www removed, === "easyerf.co.za".
The combined gate fails unless both pass. The returned readiness response and preflight-completed log omit account.id and the two separate field results. Therefore the exact TEST account and failing field cannot be established from this interface.
Last retained preflight request10014af6-3b9b-434e-936c-57486f69aeed, observed2026/10/02 10:09:03: TEST key/mode, arming OFF, business-profile FAIL, signature match UNKNOWN. This result was not rerun merely to obtain the same lossy response.
Historical desktop connector inventory exposed only LIVE. PR #202 comment 5961338895 now reports a newly available TEST context for the same account, with the exact recorded TEST Payment Link plink_1U5M20Guqo8oJkrBDOZ88E1V (price price_1U5LwvGuqo8oJkrB4O6ayD6A), active, one-time R999 ZAR and correct return URL. This is retained control-room evidence, not a new account call or current runtime credential attestation. Its successful TEST account response omitted business_profile. Do not repeat that GET or the timed-out browser route.
Existing LIVE objects are owner/control-room VERIFIED and reused, not re-edited:
- account acct_1U3YD8Guqo8oJkrB
- Payment Link plink_1UA55iGuqo8oJkrBYvjJQvGL
- webhook we_1UA562Guqo8oJkrBRkZxcKKa
- one-time99900 ZAR minor units, correct return URL and events.
## Source diagnostic repair, not deployed
The existing account retrieval now projects its actual nonsecret account ID and per-field pass/fail/unknown results into the existing checks array. The Founder UI already renders these checks, alongside observedAt and requestId. The account detail includes configured key mode without exposing the key. No frontend change or extra account request.
Absent/null profile or field is UNKNOWN and blocking. A supplied empty, malformed or mismatched value is FAIL. Both matching explicit fields may PASS, but missing account identity remains blocking. A failed probe starts with fresh request-local null state. No raw profile values, account objects, keys, banking fields or arbitrary error names are serialized.
The combined profile gate retains explicit mismatch FAIL even if the other field is UNKNOWN; per-field results preserve both facts. Existing authorization, key/mode, disarmed, link and signature gates remain intact. This does not attest the production runtime until separately rolled out and observed.
Cheaper alternative: a supported already-retained runtime response containing account/field evidence can resolve binding without rollout. Do not request unavailable historical response bodies or retry denied private queries.

## Diagnostic rollout requirements, separate authorization
Review and merge the exact candidate only after applicable checks. Owner approval must explicitly name deployment of easy-erf-founder-launch-readiness to Supabase project xiqpfhsdlvwrwhclonsg with its existing shared modules, npm pins and verify_jwt=true. No schema, secret, role, other function or Stripe setting change. Frontend publication cannot deploy this repair and is not required: existing check rows display the new results.
After approved deployment, bind the deployed definition/version to the reviewed files, then make ONE authenticated Founder preflight request. Reuse its one account retrieval; capture account identity, per-field status, key/checkout mode, arming OFF, observation time and request ID. TEST data absent remains UNKNOWN and blocking, not an instruction to edit the correct LIVE profile. Missing identity or mismatch stops the affected path. A timeout consumes the invocation; inspect retained evidence, do not automatically retry or redeploy. Record action-specific cost before approval; unknown/nonzero unapproved cost stops. No rollout is authorized by this source repair.

## One staged activation proposal, all execution separately authorized
1. Resolve binding through retained evidence or the separately approved diagnostic rollout above, and establish actual fees before any payment configuration mutation. Preserve the completed TEST order, report version and draft. Confirm the exact current runtime and webhook deployed source, account, endpoint URL and fee schedule. No runtime changes while this gate is unresolved.
2. In canonical Supabase project's existing Edge Function secrets, authorized owner sets the following only:
   - EASY_ERF_R999_LIVE_ENABLED=false throughout disarmed preparation.
   - STRIPE_SECRET_KEY: existing LIVE credential belonging to acct_1U3YD8Guqo8oJkrB, entered privately by owner, never pasted into chat.
   - STRIPE_WEBHOOK_SECRET: existing endpoint-specific LIVE signing secret for we_1UA562Guqo8oJkrBRkZxcKKa, privately entered by owner.
   - EASY_ERF_R999_PAYMENT_LINK_IDS=plink_1UA55iGuqo8oJkrBYvjJQvGL
   - EASY_ERF_R999_CHECKOUT_MODE=live.
   This switches shared runtime Stripe context and must account for in-flight TEST webhooks before execution. This configuration stage authorizes no additional function deployment, new service, account, permissions or frontend publication.
3. Run one Founder read-only preflight. Require LIVE context with arming OFF, exact accepted R999 link/return URL, account capability/profile and correct enabled endpoint/events. Any fail/unknown stops activation.
4. Separate signed-event proof before arming. Must use a provider-supported operation addressed to the actual endpoint and its actual signing secret, with a pre-inspected event guaranteed not to create/update a paid order. Record Stripe event/delivery ID, function request ID and signature-accepted outcome with recorded=false and unchanged order state. Never use a CLI listener secret as proof of endpoint-secret equality; never fabricate a successful response. A test-mode signature does not prove the LIVE endpoint secret.
   BLOCKED: no safe existing LIVE event or supported non-writing LIVE send operation has been identified. Current Stripe documentation does not establish a built-in synthetic LIVE test-event operation. A resend can have side effects and is not authorized by this package. Do not improvise a payment event or use real card details merely to test.
5. Only after steps1-4 and specific financial/activation authorization, set EASY_ERF_R999_LIVE_ENABLED=true. This is a global gate, not an owner-only canary; existing Payment Link exposure and concurrent purchases must be understood. A finite one-purchase approval must explicitly permit this exposure and define the authorized disarm stop action.
6. One genuine R999 commercial purchase by the explicitly named, authorized purchaser through the normal application checkout, not a fabricated/self-testing charge. New request/order creation must be explicitly authorized separately from the already-delivered TEST order. Human enters payment details and submits payment. No agent handles card data, no stored-card reuse, no subscription, no automatic refund or second purchase.

## Money boundary
Current diagnostic/acceptance authorization: original USD10 only; no live charge, secret change or activation authorized.
Future purchase principal: ZAR999 maximum in ZAR, one-time, only if final Checkout total is exactly ZAR999.
Actual merchant fee rate, fixed fee currency, settlement FX, card-country surcharge, optional product fees and purchaser bank FX fees: UNKNOWN. The connector does not expose the applicable account pricing and the Dashboard attachment is unavailable. Do not substitute public US pricing for this account.
A valid final monetary authorization must add the verified merchant fee schedule, settlement currency and purchaser/card country, plus a numeric maximum for all incidental fees. Until that total is bounded, stop before activation/purchase. Original USD10 is neither payment principal nor a renewed fee budget. No new recurring service. Cheapest alternative: leave live checkout disarmed and retain completed TEST customer-access evidence.
Stripe pricing source: https://stripe.com/pricing (standard and custom, country-specific pricing).
Stripe test restriction: https://docs.stripe.com/testing (test keys/cards for testing; no real payment details merely for testing).
Signing source: https://docs.stripe.com/webhooks/quickstart (endpoint-specific secret, raw payload/signature).
Workbench evidence path: https://docs.stripe.com/workbench/overview#request-logs.

## Success and stop conditions
Success: correct bound customer request; one genuine paid99900-ZAR Checkout Session; signature verified by actual endpoint; one idempotently recorded LIVE order with correct owner/parcel; normal return URL; matching payment/order status; actual balance-transaction fee/net receipt reconciled. Do not auto-approve or deliver that new investigation.
Stop on wrong identity/context, failed/unknown preflight, unbounded/nonapproved fees, wrong amount/currency, altered endpoint/link, missing signed proof, unavailable supported control, security denial, concurrent operator or ambiguous event/payment outcome. Ambiguity permits scoped reads only, never repeat charge/event/send. Rollback/disarm requires an explicitly authorized exact action; never overwrite the completed TEST report.
No notification-metadata query was attempted or rerouted.

## Remaining MVP acceptance and next actor
Preserve the delivered TEST version/history. Its ddddd assessment proves workflow mechanics, not a saleable source-backed investigation. Substantive report content, human review, document redistribution rights and non-admin customer isolation remain open requirements. This source task neither rewrites nor redelivers that report. Maps10/10, geometry1/1 and delivery remain consumed; no renewed acceptance budget.
Independent reviewer: review the exact diagnostic candidate and this single updated package. After review, owner/operator must separately authorize the named diagnostic Edge rollout if retained evidence cannot establish runtime binding. Live-but-disarmed credential configuration, signed-event proof and eventual activation/purchase are distinct scopes, not implied by diagnostic approval. The exact fee amount/cap and safe live signed-event method remain UNKNOWN, so no executable financial authorization is requested yet.
