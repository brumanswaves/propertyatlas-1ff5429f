# WHAT I NEED FROM YOU NOW

This is one proposed Class B release packet, not permission to execute it. The final PR #168 independent-review receipt must name the complete candidate SHA, successful exact-head runs and inspected artifact digests before owner approval. Never replay older PR #164/#166/#167 approvals.

# EE-R999-01: selected-order privacy and owner TEST acceptance

Repository: `brumanswaves/propertyatlas-1ff5429f`.
Only PR #168, branch `chatgpt/ee-r999-selected-order-data`.
Expected pre-release main: `be28f4d0742885f5a483ef21d3ad44ac8753de6a`.
Expected main tree: `4e4ad2eb624861fc2a6964b583f94fb5a0e2c35e`.
Canonical Supabase: `xiqpfhsdlvwrwhclonsg`.
Passive Lovable publisher: `8680b46b-3325-4395-9767-a8c0ae2a3a50`.
Max additional discretionary spend: $0. Actual account billing UNKNOWN.

## Frozen acceptance outcome

Exact property selected/confirmed -> genuine R999 payment -> signed webhook establishes payment truth -> correct customer and parcel order -> actual founder investigation -> applicable checklist resolved -> evidence-backed report -> delivery -> automatic email -> customer opens exact report -> no duplicate order, notification or payment.

This commercial outcome is UNPASSED. The proposed owner TEST below is a prerequisite, not the commercial result. Class C live-money approval must be separate and later.

## Included release changes

1. Mark only #168 ready for review and expected-head-guarded merge of the explicitly approved final SHA. Reverify merged parents/tree and all required exact merged-SHA workflows. Do not merge another PR.
2. Apply only `supabase/migrations/20260907100000_founder_queue_metadata_read.sql` if fresh catalog inspection confirms absence. This adds the stable, admin-checked SECURITY INVOKER metadata reader and execute privilege while retaining table RLS. If an equivalent reader already exists, verify equivalence rather than replaying it. No other migration, permission repair or database change.
3. Passively publish only the exact merged frontend through the named Lovable project. Source includes founder metadata/detail separation and exact customer email-link retrieval. No Lovable implementation, debugging, planning or source rewrite.
4. Edge Function deployments: NONE. Recheck deployed source before execution; do not redeploy merely for version counters or an unrelated helper difference.
5. Configuration: NONE for the read repair. Only the separately included owner TEST may temporarily change `EASY_ERF_CUSTOMER_EMAIL_ENABLED`; it ends false. Missing sender/API/domain/runtime configuration is a stop, not authority to repair it.

Affected production surfaces: founder `/admin/fulfillment` reads; exact customer `/orders?report=<UUID>` reads; one additive SQL reader; only the target TEST order's expressly bounded lifecycle/checklist/save/notification state. No live checkout, Stripe, DNS, backend function code or external customer change.

## Required source evidence

Require Guided integration (full suite), Founder fulfillment (isolated SQL privileges/projection/RLS/no-write proof plus built browser), Human Review and Stripe workflows on the exact final candidate. Download artifacts, compare hashes and inspect receipts, screenshots, traces and actual response bodies. Dirty must be false and artifact SHA must match. The post-merge tree must equal the approved tree; repeat/inspect required merged-SHA verification before publication.

Founder evidence must prove fourteen-field metadata-only responses, full-UUID details, nonselected sentinels, account change, delayed A after B, exit/sign-out, errors/read-only retry, delivery gates and ordinary desktop/narrow mouse/touch/keyboard navigation.

Customer-link evidence must prove exact UUID+current user+provider filters, invalid/empty/missing/failing selection without bulk fallback, response identity/count checks, refresh, delayed response/account isolation and mobile fit. This does NOT claim that the general customer `/orders` list is metadata-only.

## Read-only preflight

- Reconfirm repository/head/main/tree/project identities, owner authority and $0 supported passive publication. Stop on drift rather than substituting another revision.
- Inspect current build/security/account warnings substantively. No ignored-finding shortcut, credit purchase, paid service or alternate publication channel. On a tool rejection preserve it and stop, not retry around the control.
- Establish supported source linkage: exact GitHub tree, publisher synchronized revision, successful exact-commit build, actual deployment ID after publication and served production evidence. Independent byte-for-byte production Git-tree attestation may be unavailable; state that limitation. Do not claim it from an API response. Stop if actual revision linkage is ambiguous.
- Reverify deployed function source and safe runtime configuration privately with existing read-only tools. Require owner TEST mode, live checkout disarmed, email false before TEST staging, existing sender `Easy Erf <reports@mail.easyerf.co.za>`, app origin `https://easyerf.co.za`, verified sending domain and included free capacity. Do not expose secret values or deploy diagnostic code to obtain them. Unknown prerequisites stop the affected action.
- Take a fresh private metadata-only baseline for ALL orders immediately before release. Already authorized output: UUID/count, statuses/timestamps, database-computed report hash excluding customerNotification, separate notification-receipt hash/presence and audit counts. No bulk report/receipt bodies, customer joins, raw provider payloads or private public artifacts.
- Protected legacy `4e51dfbb-e931-4500-a622-2a766be398fc`: metadata comparison only; never open its report body or mutate it.

## Exact existing owner TEST identity

Order: `384be2fe-f7aa-4687-970c-5a6db34cfeba`.
Parcel: `csg:lpi:c03400140000157000000`.
Property: Erf 1570, 24 Padrone Crescent, St Francis Bay.
Canonical owner recipient: `brumanswaves@gmail.com`.
Payment mode: TEST, established from canonical record, never inferred from missing metadata.

Expected initial status: processing / fulfilling, saved complete narrative, nine resolved checklist entries, no successful notification receipt. Previously inspected narrative/checklist hash: `c9b8ccaf66b5ed5ad54c439752f61b34`. Recompute fresh; on any identity/content/status/receipt mismatch stop and revise rather than force the record to fit. No new TEST order.

## Phase 1: read-only production acceptance

After migration and exact frontend publication, operate the existing authenticated founder browser yourself. Queue may return metadata only. Deliberately open the full target UUID and no other private report. Inspect network filters/response bodies, pinned identity, refresh, shallow/deep scrolling and Back on desktop/narrow screens using ordinary input. Return must remove selected hash and actionable workbench. Zero order-mutation or notification calls are permitted in this phase.

Take an after-snapshot: every order, status, timestamp, report/receipt hash and event count unchanged. Stop on a leak or difference before any TEST writes.

## Phase 2: bounded TEST writes, only if explicitly included in the owner approval

Use UI controls when available. Browser fixtures are not evidence these production steps passed. Keep all values/receipts private; publish only necessary redacted evidence.

1. Confirm email false. On the target only, save the existing unchanged web report once and reload. Verify the saved narrative/checklist values and hash remain identical; only target save timestamps may change. This verifies the actual report-save path without fabricating new findings.
2. Temporarily set target `parcel_identity` checklist status from complete to pending, save once and reload. Both delivery UI routes must be disabled. One explicitly approved authenticated invocation of the EXISTING fulfillment function with `{orderId: <target>, action: "mark_ready"}` may verify server rejection (409) with no lifecycle/event/notification change. Do not force-click a disabled control or invent an endpoint.
3. Restore that exact checklist item to complete, save once and reload. All baseline checklist/narrative values must match; both applicable delivery gates must permit the already-saved web report. The optional PDF route still requires a PDF and is not used. Do not claim a checklist audit event if source does not emit one; record actual target-only save timestamps.
4. Stage the target ready ONCE using Mark this exact report ready while email remains false. Capture server-generated completed_at as V1. Expect the existing mark_ready event and an EMAIL_NOT_CONFIGURED notification result. The current notification source returns before recording an attempt when disabled, so require zero provider messages, no notification receipt and no customer_notification_failed event from this intentional disabled case. An unexpected provider call/receipt is a stop.
5. Reopen this now-ready target exactly ONCE with its confirmation UI. Verify processing, completed_at reset, original report/checklist retained and the source-defined reopen event. Never reopen the initially processing order or make a second reopen.
6. Enable only `EASY_ERF_CUSTOMER_EMAIL_ENABLED=true`. Mark this same report ready ONCE, producing V2 distinct from V1. Verify one automatic submission without a second admin notification step, exact sender/owner recipient/property/link, one Resend message ID, one V2 successful automatic receipt and one V2 customer_notified event. Provider delivery, owner inbox arrival and authenticated exact-report opening are separate checks. On ambiguous send/receipt error immediately disable and stop; do not send manually or use recovery.
7. After independently proving the successful V2 receipt, set email false BEFORE the deduplication probe. Invoke the existing notification function once with `{orderId: <target>, action: "send"}` through the authenticated founder path. The existing early idempotency return must produce alreadySent=true with the same receipt/message ID, no provider request and no additional event. The flag remains false so an unexpected missing-receipt path cannot send another message. Do not repeat Mark ready for this probe.
8. Verify the one message arrives in the owner's actual Gmail inbox and open its link through the authenticated customer browser. It must resolve to `/orders?report=384be2fe-f7aa-4687-970c-5a6db34cfeba`, retrieve only that customer/order and show the correct evidence, risks, unknowns and next actions. Reload the same deep link. Do NOT click Back to reports, enter general `/orders` history or open another order, because the unchanged general history still reads same-customer reports, including the protected legacy record.
9. Verify email remains false and live checkout remains disarmed. Leave only the target ready at V2 with its single sent receipt. Preserve audits, receipt and sent email; do not reset the target through another reopen or erase history. Recompare ALL non-target metadata and total order count unchanged.

Maximum intended writes/actions: one identical report save, two checklist saves, one negative delivery request, two successful ready transitions (V1 disabled and V2 enabled), one reopen, one automatic owner email and one disabled-flag same-version duplicate probe. Only target save/lifecycle/completion/receipt timestamps and source-defined target events may change. Expected lifecycle actions are mark_ready twice and reopen once; verify exact stored contract names before execution. No other order, recipient, report version, upload or failure transition.

## Integrity proof

Calculate in the database:
`md5(coalesce((review_content - 'customerNotification')::text, 'null'))`

Hash `review_content -> 'customerNotification'` separately. Do not remove any other field to make the comparison pass. Temporary checklist change is allowed only between its two defined saves; restored/final narrative+checklist hash must match the original. A legitimate receipt changes whole-object JSON and review_content_updated_at but is not narrative corruption.

Every non-target field/hash/event count and total order count must remain unchanged. Unexpected differences stop acceptance; do not silently repair them.

## Rollback and stop conditions

On failure stop all order actions, immediately restore email false if TEST enabled it, and preserve database/provider/browser evidence. No provider retry, recovery send, extra ready/reopen, audit deletion or money movement.

Only if separately included in the exact Class B approval, a supported passive frontend rollback may restore verified prior deployment `c725b385-a026-40fe-8fdf-48485c21fd7a` at source `be28f4d0742885f5a483ef21d3ad44ac8753de6a` after an actual publication regression. That prior frontend has the known bulk-read defect: stop founder/customer protected-data operation if restored. If rollback is unsupported/rejected, stop; do not change hosting or Git history. Leave the additive unused metadata reader in place instead of a destructive down-migration. Do not attempt to undo sent email or completed audit history.

Stop on SHA/CI/project/migration/function-source/publication linkage mismatch, unknown necessary runtime flag, wrong identity/mode/recipient/version, unselected private data, unexpected request/write/send/event, failed save/navigation/inbox result, tool rejection, unsupported rollback or required extra spending.

## Prohibited and spending

No other PR, migration, function deployment, production configuration/secret change, Stripe mutation, live arming/charge/refund, external customer contact/order, new TEST order, protected legacy body, DNS, paid plan/runner/credits/API billing, Lovable implementation or Vercel. Default additional discretionary spending $0; maximum $0. Actual billing UNKNOWN. A new cost requires a separate explicit decision, never silent substitution.

## Final execution receipt

Record exact approved and merged SHA/tree/parents, migration application or equivalence evidence, function-source checks, publication method/ID/linkage limitations, actual production navigation/save/reload/gating/V1/reopen/V2/deduplication/inbox/exact-link results, private all-order metadata comparison, final email/live flags, rollback if used, actual spend or UNKNOWN and inspected real process status. Distinguish VERIFIED from REPORTED. No commercial acceptance claim until a separate approved genuine R999 journey passes. No unrelated feature tranche.
