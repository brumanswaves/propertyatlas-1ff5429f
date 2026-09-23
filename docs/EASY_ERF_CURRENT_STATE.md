# Easy Erf Current State

## Dashboard metadata source tranche, 2026-09-23

Issue #191 is implemented on `codex/dashboard-metadata`, based on merged PR #190 main `a28db850cf07b30f3192f235af41b79557eefdc8`. Tested source `877ceafc97afa084309133182fd3deb5f3ce4242`. The dashboard now requests explicit display/progress scalar leaves and narrow note metadata; Market detail opens only after deliberate property selection. Missing data remains unknown, pagination is bounded and honest, and account lifetimes reject stale results. Browser drafts are preserved without reading their bodies for list summaries.

25 synthetic browser cases, 1770 full local tests, normal configured build, TypeScript and changed-source lint passed. The fixture models Auth/transport/router and heavy map/panels; this is not real PostgREST/Auth/RLS or production acceptance. [Evidence and limitations](reviews/dashboard-metadata/README.md). Source-only draft review, no new release or backend work. PR #190 remains merged and its release is not repeated. The older dashboard bulk-body statement below describes the prior source.


## Selected-property source tranche, 2026-09-22

Section A of corrected package comment 5786992038 is implemented on `codex/selected-property-workspace`, based on main `5026ba639ba19bc2b9b9fec6f41301e18c5d4be9`. Tested source: `98684f4783a00d9838d6ff4a9da945fa04ba7298`. The new draft PR is for independent review only.

The map's deliberate account/parcel selection now owns workspace hydration, restore, queued saves, flush and Site Potential reconciliation. Global root hydration is removed. Synthetic nine-property fixtures verify exact filters, untouched other records/drafts, stale-response and save cancellation, conflict preservation and save/reload. All 35 focused browser cases, 43 related regressions, TypeScript, changed-source lint and isolated production-mode build passed. These are local source checks, not production acceptance.

The separate My Properties dashboard still reads account-wide `user_data` for its list summaries. This is explicitly outside the map/report lifecycle proof and needs a separately scoped metadata-query/summary adaptation if the no-body-without-selection rule is extended across every route. No dashboard redesign or backend change was made.

[Evidence, exact source, request counts, preservation hashes, limits and reproduction](reviews/selected-property-workspace/README.md). Existing #189 report/export and run-16 evidence retains its original attribution. No release or production action; additional discretionary spend $0.


_Last reconciled: 2026-09-09_

## Source continuation checkpoint, 2026-09-20

This checkpoint supersedes older release-position claims below for the named work. It does not establish production completion.

- Sole-writer continuation PR #188, `codex/product-journey-completion`, is stacked on PR #187. Implementation commit `c1f6e44a16ef97107ee9f31f7fcecd163f0e614b` prevents stale parcel/account handoffs, retains exact report/dashboard/account links through sign-in, separates failed reads from empty accounts with explicit retry, isolates dashboard data by owner, preserves profile drafts on refresh, binds preference saves to their verified original account and removes the demo's obsolete monthly offer.
- VERIFIED remote PR #187 branch remains `e31a7087b53dd95a0a9d1c4f4dffe794f8f596f6`; report PR #186 remains `565fd980c2519f0b836dd36c62a5237cfa9b3c7a`. Neither was merged or changed by this continuation. Ask-at-top report design is preserved.
- VERIFIED local component browser cases, including mobile handoff, and focused handoff/report/admin/guided checks passed. Local node-server build, TypeScript, targeted lint and whitespace passed. Exact reproduction and scope: `JOURNEY_RECOVERY_ACCEPTANCE.md`. These are source and synthetic local checks, not live acceptance.
- The earlier PR #185 synthetic upload allowance was consumed by a failed HTTP 401 attempt. It is not available for retry. No new attachment was created; prior receipt and preservation evidence remain in `HANDOFF_SIGNIN_2026-09-20.md`.
- VERIFIED #188 security review at `131d2992` found no new security issue; the subsequent account-save follow-up received independent source review and a reproduced/corrected A -> B -> A stale-details regression. Final follow-up has 22 focused checks, TypeScript, lint, build and actual synthetic browser save/reload/account-switch/retry evidence. Earlier full local regression: 170 files / 1,733 tests, before the final account-save follow-up. Full evidence and limits are in `JOURNEY_RECOVERY_ACCEPTANCE.md`.
- Remaining release work: reconcile the three source candidates under one reviewed integration revision; release only under applicable explicit authorization; then a freshly authorized finite SG/product acceptance against the customer domain and canonical backend. The report/journey branch inspection found no overlapping production source files; their only shared test-file hunk is identical, with extra report disclosure checks on #186. This does not establish a combined build. No merge/publication, real payment, provider processing or customer email was performed here. Necessary development use is authorized; account charges are UNKNOWN.

The immediate source review is PR #188: https://github.com/brumanswaves/propertyatlas-1ff5429f/pull/188.

## Source follow-up: issue #179 (2026-09-14)

The isolated `codex/founder-investigator-dashboards` candidate starts at canonical main `3f7ae873371792b52d343fc47afa92c5669a50bd`. It separates Founder landing/management from the investigator work dashboard using existing Auth roles and unchanged order permissions. It is source work, not a production rollout. Exact candidate checks and browser evidence are recorded in the PR receipt; older production statements below remain historical.

This file is the concise operational snapshot for the Easy Erf control room. The product source of truth remains `docs/EASY_ERF_MASTER_PLAN.md`; GitHub `main` remains the code source of truth.

## Current release position

The current position below supersedes the historical 2026-09-07 list retained afterward:

- VERIFIED main is `d44c0f54565f82c05e1721986067e5e1ea25ff3f`. PRs #168/#169/#170 merged; #171 superseded. Prior metadata migration and owner TEST delivery/email actions were consumed, not pending.
- Owner REPORTED inbox receipt and report opening. That does not establish the completed shared manual investigation or genuine R999 commercial acceptance.
- Active source-only draft #172: `codex/ee-r999-shared-investigation`. Customer and assigned investigator use one canonical file; shared full report plus paid AI brief/human approval/frozen version. Actual isolated acceptance checkpoints are in `EE-R999-ASTRA-STATE.md`; do not infer full acceptance from a checkpoint.
- New source includes one permission/revision/review migration, two changed Edge Functions and frontend/server plumbing. None applied or published in this tranche. Production configuration is UNKNOWN and untouched.
- Exact-head evidence and independent review precede ONE new combined Class B packet. Live AI/processing/acquisition rights, budget, publication and a fresh finite owner TEST remain explicit gates. No old action replay, new order, email or production change under Class A.

### Historical 2026-09-07 position (superseded)

- VERIFIED GitHub main: `be28f4d0742885f5a483ef21d3ad44ac8753de6a`, after merged PR #167. Do not replay #166/#167.
- Active source-only repair: existing draft PR #168, `chatgpt/ee-r999-selected-order-data`. Queue metadata must exclude private reports/payloads; detail requires deliberate complete-UUID selection. Existing navigation and lifecycle classification are preserved.
- REPORTED latest frontend: deployment `c725b385-a026-40fe-8fdf-48485c21fd7a`, source main above. It has the bulk-fetch acceptance defect; it is not a completed privacy acceptance.
- VERIFIED read-only runtime inspection: canonical Supabase `xiqpfhsdlvwrwhclonsg`; metadata queue RPC absent. Fulfillment v18, upload/review-content v13, notification v12 and readiness v11 source-equivalent to candidate (line endings normalized). No function redeployment required for this repair.
- Current email enablement and checkout/live-arming flags are UNKNOWN in this pass, not presumed OFF. No runtime configuration was changed.
- Owner TEST order is REPORTED processing with a saved report/checklist, not ready. Remaining TEST staging/reopen/automatic-email/inbox acceptance is unpassed. Full genuine R999 commercial outcome remains UNPASSED.
- Use `CURRENT_RELEASE_CONTRACT.md`, `EE-R999-01_RELEASE_PACKET.md` and `EE-R999-ASTRA-STATE.md` for current gates. One combined Class B packet is prepared; no merge, migration, publication, order write or email is authorized by this source task.

## Historical 2026-09-01 snapshot

Everything below records the earlier PR #152/product-positioning work, not current runtime verification. Its TEST delivery proof did not include the later automatic-email and final privacy/navigation acceptance; it must not be read as commercial completion.

### Historical canonical baseline

- GitHub `main`: `828b4379a31e9beb2f8fb394e956a7b99ff7ec61` after PR #152.
- Production frontend: Lovable deployment `33c0cd32-e26c-4517-a374-cf1dc56fcbc9`, serving `https://easyerf.co.za`.
- Canonical backend/runtime project: Supabase `xiqpfhsdlvwrwhclonsg`.
- Live charging through the Easy Erf application remains OFF unless separately armed through the approved live-mode gates.
- Active Site Potential remains deterministic parcel/build-envelope plus street-side build lines only. Generated architectural concepts are not part of the active product.

## R999 commercial proof completed in TEST

The full controlled TEST journey has been executed for Erf 1570:

1. exact property selected and confirmed from the Easy Erf map/property flow
2. controlled R999 brief created while signed in
3. Stripe TEST R999 payment completed
4. payment attached to the correct Easy Erf account and canonical parcel
5. founder fulfillment moved the order from paid to processing through the audited transition contract
6. the actual property evidence was reviewed
7. a structured Human-Reviewed Easy Erf Report was saved
8. the order moved from processing to ready through the audited transition contract
9. the completed web report appeared as the primary customer deliverable

Gold-standard TEST order property:
- 24 Padrone Crescent, St Francis Bay
- Erf 1570
- LPI `C03400140000157000000`
- canonical parcel `csg:lpi:c03400140000157000000`

The TEST proved the payment, ownership, founder queue, report authoring and delivery mechanics. It also exposed a product-positioning issue: the phrase **Human Review** understated the service and implied a quick final check rather than the real customer value.

## Current product decision being implemented

The R999 Early Access offer is now:

**Done-for-You Property Investigation · R999**

**You choose the property. We do the investigation.**

The customer confirms the exact parcel and tells Easy Erf what matters most. Easy Erf plus a human reviewer then completes or reviews the standard Easy Erf investigation on the customer's behalf, reusing work already present in the same canonical property file.

The standard investigation includes, as applicable and as evidence/inputs allow:
- parcel and working-address confirmation
- cadastral / SG / boundary evidence review
- ownership, transfer, title indicators and paid-report evidence
- working zoning and planning position
- standard property checks and evidence-gap review
- useful market evidence and comparable context
- relevant deterministic Strategy calculations
- deterministic Site Potential where sufficiently supported
- final Human-Reviewed Easy Erf Report showing facts, potential, risks, unknowns and next checks

The three existing focus choices remain for compatibility but now mean **review emphasis**, not reduced product scope:
- Overall Property Check
- Property Potential
- Check My Intended Use

## Included property-data-report rule

During Early Access, the product may include the review of **one third-party property data report at no extra charge where coverage is available**.

Locked truth rules:
- public customer copy is provider-neutral unless specific provider rights are verified
- provider may vary
- Easy Erf may use the report as investigation evidence
- a branded Lightstone, WinDeed or other provider PDF is supplied to the customer only when the applicable subscription/report terms permit redistribution
- do not advertise `Free Lightstone Report` until contractual redistribution rights are independently verified
- unlimited paid third-party documents are not part of the R999 package

## Recent commercial/product PR sequence

- PR #145: controlled Human Review product, shared report and founder fulfillment foundations
- PR #146: correct Easy Erf customer domain
- PR #147: fail-closed checkout mode/live arming gate
- PR #148: authenticated customer ownership
- PR #149: payment-only Stripe checkout and account-aware UI
- PR #150: confirmed map parcel required before R999 checkout
- PR #151: stronger property-level R999 value proposition
- PR #152: tangible pre-payment report proof, How It Works explanation, post-payment status, action-first founder queue and guided report editor

## Active implementation branch

`chatgpt/done-for-you-investigation-offer`

This branch is converting the R999 customer and founder workflow from narrow `Human Review` positioning to the done-for-you investigation product while preserving the proven payment and fulfillment contracts.

No production publish, backend deployment, Stripe mutation, database schema change or live-payment activation is authorized by this branch itself.

## Known launch work still separate

### Stripe business profile
The connected LIVE Easy Erf Stripe account still needs a separately approved business-profile cleanup before launch, including replacing the legacy `www.xyzboatsupplies.com` business URL with Easy Erf information.

### Live credentials / webhook
A real live launch still requires separate authorization and verification of:
- LIVE Stripe secret key in Easy Erf runtime
- LIVE webhook signing secret for the Easy Erf endpoint
- accepted LIVE Payment Link ID
- checkout mode `live`
- final `EASY_ERF_R999_LIVE_ENABLED=true` arming step

The existing Stripe API cannot reveal the current webhook signing secret. Do not guess it or silently recreate the webhook.

### Live canary
A real R999 live payment is a separate spend/production authorization. TEST success does not authorize a real charge.

## Gold-standard evidence reality for Erf 1570

Useful evidence currently includes:
- official CSG parcel identity
- user-confirmed working address 24 Padrone Crescent
- user-confirmed working `RES1` zoning classification
- General Plan 12252 evidence visibly showing Erf 1570 and Padrone Crescent, while remaining a parent subdivision plan rather than automatically the individual SG diagram
- uploaded third-party property report with ownership, transfer, valuation and land-use evidence
- real discrepancy between approximately 619 m² cadastral extent and 602 m² registered extent shown in the uploaded report

The product must preserve these evidence limitations rather than flattening them into false certainty.

## Immediate next execution path

1. finish the done-for-you branch
2. update guardrails and canonical product docs
3. run full exact-head CI and browser acceptance
4. open PR
5. merge only with explicit approval
6. publish only with explicit approval
7. review the live customer and founder journey visually
8. keep live payments OFF until the separate launch checklist is approved and verified
