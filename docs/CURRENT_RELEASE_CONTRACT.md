# Easy Erf Current Release Contract

Release: EE-R999-01. Reconciled 2026-09-07.
Status: CLASS A CANDIDATE; NO PRODUCTION AUTHORITY.
Repository: brumanswaves/propertyatlas-1ff5429f.
Main: `be28f4d0742885f5a483ef21d3ad44ac8753de6a`.
Existing draft: #168, branch `chatgpt/ee-r999-selected-order-data`.
Exact candidate: resolve the commit containing this contract; the final PR receipt pins its SHA and all four exact-head gates.
Supabase: `xiqpfhsdlvwrwhclonsg`.
Passive publisher: `8680b46b-3325-4395-9767-a8c0ae2a3a50`.
Combined approval packet: `docs/EE-R999-01_RELEASE_PACKET.md`.

## Frozen outcome and authority

One genuine R999 Done-for-You Property Investigation must complete:
exact property -> verified payment -> correct customer/parcel order -> founder investigation -> evidence-backed report -> automatic customer email -> authenticated customer opens the exact report.

This genuine commercial outcome remains UNPASSED. Historical TEST report delivery, source tests, provider acceptance and frontend publication do not prove it. GitHub main is code truth; Master Plan is product truth; Current State is operational; Decision Log preserves decisions. This reconciliation supersedes the stale operational PR #164/#152 baselines, not their historical receipts.

## Current repair boundary

- Founder queue retrieves fourteen metadata fields only through an authenticated, admin-checked, SECURITY INVOKER RPC retaining caller RLS. Classification uses server-computed presence flags; never report excerpts, payloads, contact information or invented report bodies.
- A private detail read requires one deliberately selected complete UUID, one equality filter and provider=stripe. There is no bulk fallback.
- Paid/processing orders need not already have a final report. Ready/delivered orders missing report content and ambiguous/legacy metadata remain separately classified.
- Selection change, exit, account change, sign-out, read error and unmount invalidate or clear stale private detail. Real browser request/response fixtures prove nonselected private sentinels never arrive.
- Existing founder navigation, authoring, checklist, lifecycle and automatic notification contracts are preserved.

## Current verified versus reported baseline

VERIFIED on 2026-09-07 by read-only source/configuration inspection:
- Main SHA above; PR #167 is already merged. Do not repeat that release.
- New `list_easy_erf_founder_queue(integer)` is absent in canonical production.
- Applied migration inventory ends at `20260904123430_automatic_report_ready_email`; manual receipt migration is `20260904090724_record_manual_report_notification`. Do not reapply equivalent earlier migrations because repository timestamps differ.
- Fulfillment v18, report upload v13, review content v13, customer notification v12 and launch readiness v11 have JWT verification enabled. Retrieved source and included shared files match this candidate after line-ending normalization.
- Webhook v16 source matches; checkout v17 entrypoint/payment contract match. Its bundled human-review helper predates unused delivery/checklist additions; checkout imports only the unchanged checkout validator. This is not blanket backend source equivalence and is not a reason to redeploy checkout for this queue repair.
- Fulfillment bundle hash remains `690d8ba18b39f37fcfa0d6462022326ef53886aa8b4cc9f3f683080529b07fb0`. Version-counter movement alone does not prove source drift.

REPORTED in preserved PR #167 receipts, not re-executed in this Class A pass:
- Latest passive frontend deployment `c725b385-a026-40fe-8fdf-48485c21fd7a`, reported source main above.
- Owner TEST order is processing, with report/checklist saved and no notification receipt. Therefore do not try to reopen it immediately.
- Prior navigation exposed the bulk-fetch privacy boundary; the frontend publication did not establish final acceptance.

UNKNOWN: current runtime email-enable value, current checkout mode/live-arming flags, sender readiness/free allowance, owner inbox result and current order contents. No production report bodies or customer data were retrieved for this repair.

## Gates

Class A now: source repair, isolated database/browser proofs, review, tests, exact-head CI/artifact inspection, and one combined packet.

Class B later requires a new explicit exact-SHA approval: merge only #168; apply only its new metadata-reader migration if still absent; publish the exact merged frontend passively; perform bounded read-only acceptance; then only the explicitly listed owner TEST lifecycle/email actions. No Edge Function deployment is currently required. Runtime unknowns must be resolved read-only before consequential actions. No inferred permission to change sender credentials/configuration.

Class C remains blocked: live charging/Stripe changes, genuine R999 payment, external customer contact, paid services or discretionary spend. Do not seek it before owner-only TEST acceptance passes.

## Stop and integrity rules

Stop on SHA/project/source mismatch, failed or incomplete evidence, nonselected private data, unexpected mutation, wrong order/recipient, unverified runtime prerequisites, unsupported rollback, or nonzero required spend. Do not bypass a rejected tool or substitute publication channels.

All non-target order metadata, report hashes, receipt hashes and audit counts must remain unchanged. Hash report content inside the database excluding only `customerNotification`; hash that receipt separately. A notification's authorized receipt/version timestamp change is not report corruption.

Maximum additional discretionary spend: $0. API billing, credit purchases, paid runners/services and live payments are prohibited. Actual cash spend and existing-service metering: UNKNOWN.
