# Easy Erf Release State

Reconciled 2026-09-07. Class A source repair only; not production approval.
Canonical authority: GitHub main = code, Master Plan = product, Current State = operational snapshot, Decision Log = durable decisions.

## Release and source

- Active release EE-R999-01. Frozen outcome: genuine R999 payment -> correct property/customer order -> evidence-backed founder report -> automatic notification -> authenticated exact-report retrieval. Full genuine commercial outcome remains UNPASSED.
- VERIFIED main `be28f4d0742885f5a483ef21d3ad44ac8753de6a`, tree `4e4ad2eb624861fc2a6964b583f94fb5a0e2c35e`.
- Reused existing draft PR #168, branch `chatgpt/ee-r999-selected-order-data`, following [PR #167 handoff 5568523994](https://github.com/brumanswaves/propertyatlas-1ff5429f/pull/167#issuecomment-5568523994). No duplicate PR/implementation branch.
- Started at c076f06; incorporated remote f715656/64d567a by fast-forward, preserving the owner's execution-continuity policy, exact-SHA Stripe workflow and identical migration-inventory fix. No public history rewritten.
- Candidate is the commit containing this actual repair and receipt. Final exact SHA, four workflow conclusions and inspected artifacts are pinned in the PR #168 release comment, not guessed here.
- Isolated worktree `easy-erf-selected-order-data`; original dirty `property-evidence-pack-foundation` worktree untouched.

## Verified repair and scope

- Queue uses the existing candidate's fourteen-field metadata RPC, admin check and caller RLS. No private body/payload/contact/context/receipt values leave SQL for the queue. Flags preserve current/legacy classification without invented report content.
- Detail requires one deliberately selected full UUID, provider stripe and an explicit projection. No fallback bulk query.
- Added account ownership to queue/detail state and invalidation checks before fetch and settlement. Selection/exit/sign-out/unmount/account change/errors discard stale detail; old-account data cannot render during the new request.
- Added an explicit fail-closed queue-unavailable state and read-only Retry queue. A read failure no longer looks like a successful empty queue.
- Browser proof observes actual request filters and received response bodies, honors requested projections, uses synthetic nonselected private sentinels, and tests delayed A after B, delayed exit/sign-out, account changes and failure/retry. Real pointer positions after viewport resize prevent a wheel event outside the browser from masquerading as a navigation failure.
- Existing authoring/delivery test fixtures remain isolated. All fixture identities/contact content are synthetic, including the legacy fixture; no protected production body read.
- Existing SQL privilege test now normalizes CRLF on read without weakening grants assertions. The remote migration-inventory correction accounts for exactly the new metadata reader.
- Reconciled Current State, Current Release Contract and the combined release packet. No automatic release, UI redesign, notification/backend change or new order.

## Verification ledger

- VERIFIED focused Vitest: 7 files / 97 tests; TypeScript no-emit, targeted ESLint and production build passed locally. Initial Windows-only CRLF assertion failure was reproduced and corrected in the existing test reader.
- Local browser failures were retained: pointer outside resized viewport; missing visible queue-error state; test recovery needing the Retry queue control; overbroad sentinel assertion that also rejected the deliberately selected synthetic legacy fixture. Each corrected at its actual layer, not hidden by CI reruns.
- VERIFIED final local browser: 19 groups passed, including received-body sentinels, delayed reads, account switch/sign-out, queue outage/read-only retry and navigation with zero mutation/notification requests. Dirty pre-commit receipt is retained outside Git; exact-head evidence must come from the clean CI artifact and be independently inspected before calling the candidate accepted.
- Local PostgreSQL executable/container unavailable. The existing Founder CI PostgreSQL service runs the actual migration/projection/privilege/RLS/no-write proof. No production SQL migration applied.
- Full Vitest runs in the Guided gate once per credible candidate, not repeated locally. Existing four normal hosted workflows only; no runner/billing changes.
- CI/artifact status is resolved from the final exact-head PR receipt. An earlier head's green run is not final-candidate proof.

## Runtime inspection, reported state and unknowns

- VERIFIED read-only canonical Supabase `xiqpfhsdlvwrwhclonsg`: new queue RPC absent; applied inventory ends at 20260904123430 automatic_report_ready_email, with manual receipt migration 20260904090724. Do not replay repository timestamp variants.
- VERIFIED retrieved entrypoints/shared files equivalent after line-ending normalization: fulfillment v18, upload v13, review-content v13, notification v12, readiness v11; JWT true. Fulfillment bundle `690d8ba18b39f37fcfa0d6462022326ef53886aa8b4cc9f3f683080529b07fb0`.
- Webhook v16 equivalent. Checkout v17 entrypoint/payment helper equivalent; bundled human-review helper predates unused checklist/delivery additions. No blanket equivalence claim; no checkout redeployment proposed.
- REPORTED previous passive frontend `c725b385-a026-40fe-8fdf-48485c21fd7a` at main above. Previous navigation/privacy acceptance remains unpassed. PR #166/#167 are already merged; do not repeat their releases.
- REPORTED owner TEST order already processing, report/checklist saved, receipt absent. No orders or report bodies queried this pass.
- UNKNOWN current runtime email-enable, checkout/live flags, sender configuration/allowance and inbox outcome. No new diagnostic function, credential disclosure or inferred runtime safety.

## Next ranked actions and owner gates

1. Commit/push the candidate to existing draft #168; inspect all four exact-head workflows and retrieve browser artifacts. Fix source-only failures in the active session; no intermediate owner approval.
2. Review the candidate and evidence against the data boundary, screenshots, delayed responses and SQL RLS proof. Publish one exact-SHA receipt with the combined packet.
3. STOP at the Class B boundary. Owner must approve that exact candidate and bounded production actions; current authority excludes merge, migration, publication, email and order writes.
4. Proposed minimum release: metadata-reader migration plus exact merged passive frontend; no Edge deployments. Read-only navigation and unchanged metadata first.
5. Remaining owner TEST: approved checklist-negative check/restoration, stage ready V1 with email disabled, reopen, then explicitly enabled final V2 owner-only send/dedupe/inbox check. Do not reopen an initially processing order. Restore email disabled and preserve authorized final ready/V2 receipt/audit state.
6. Hash narrative/checklist excluding only `customerNotification`, and receipt separately; compare all other orders unchanged. No protected legacy body. No Class C/live-payment approval until genuine owner-only TEST acceptance passes.

## Restrictions, processes and spend

No merge, publication, deployment, migration application, production data/config change, email, notification, order creation, Stripe action, customer contact, paid API, Lovable implementation or Vercel use performed. Read-only backend source/catalog inspection only.

The active session uses existing local tools/browser fixtures and normal GitHub-hosted CI. No second agent or model delegation; runtime model identity not independently verified. Local preview exists only during verification and must be stopped before final receipt. Final receipt identifies inspected running processes or UNKNOWN external activity; a comment is not a worker.

Maximum additional discretionary spend $0. No API billing, credit purchases/reloads, paid runners/services or billing configuration activated. Actual cash spend and existing-account metering: UNKNOWN.
