# Easy Erf Release State

Reconciled 2026-09-07 after merged PR #168 stopped at publisher preflight. BUILD_GOVERNANCE.md section 23 applies. This source state does not authorize production changes.

## Canonical source and frozen outcome

GitHub main: `98e5a86bc82aed72b120e2a01dd44054316c7dbe`.
Tree: `3fe3c67ae5f96967aa33396adc04c55f2aeedcf1`.
PR #168 is merged. Do not replay its merge or older approvals.

Release EE-R999-01: genuine R999 payment through a signed webhook -> correct customer/parcel order -> actual investigation/resolved checklist -> evidence-backed report -> automatic email -> authenticated exact-report retrieval with no duplicate order, notification or payment. Commercial acceptance remains UNPASSED; owner TEST acceptance remains unperformed for the new release.

## Existing implementation and production boundary

Merged #168 has a fourteen-field, admin-checked SECURITY INVOKER founder metadata queue and selected complete-UUID private detail. The customer `/orders?report=<UUID>` path binds retrieval to the exact report, account and provider. Stale/error/exit/account state is isolated. The general customer history is unchanged and is NOT metadata-only; it remains excluded from protected-order acceptance.

Execution receipt: PR #168 comment 5571045340. Diagnostic receipt: comment 5571417766. These operator receipts report four successful merged-SHA workflows, inspected browser artifacts, a private four-order baseline and no production migration, publication, order action or email in that execution. Do not substitute these receipt claims for fresh runtime verification.

The new `20260907100000_founder_queue_metadata_read.sql` migration remains reported unapplied. Canonical Supabase is `xiqpfhsdlvwrwhclonsg`; branded origin is `https://easyerf.supabase.co`. Prior published deployment is operator-verified/reported here as `c725b385-a026-40fe-8fdf-48485c21fd7a` at `be28f4d0742885f5a483ef21d3ad44ac8753de6a`. Do not operate its bulk-reading protected-report surfaces.

## Current Class A repair: Deno dependency resolution

Branch: `chatgpt/ee-r999-deno-stripe-resolution`. At preparation no other open implementation PR existed. Final candidate SHA and verification evidence belong in this branch's draft PR receipt; do not reuse historical counts as current results.

The publisher diagnostic records `Could not find a matching package for npm:stripe@22.6.0 in the node_modules directory` in its Deno checker. Publisher Deno version and effective invocation are UNKNOWN. The existing GitHub checks explicitly enable auto-managed node modules; a plain checker lacks that command-line override. The root contains package.json but no deno.json/deno.jsonc in the merged baseline.

The candidate adds only root `deno.json` with `nodeModulesDir: auto`, retaining the exact Stripe version and all application/function source. No package.json, lockfile, payment logic, credentials, backend target or runtime function code is changed.

`verify-deno-stripe-resolution.mjs` must reproduce the precise missing-package failure without repository configuration, prove the same isolated probe resolves after adding the actual configuration, check nested config discovery in a separate clean tree, and type-check the three real Stripe entrypoints with no auto-install CLI flag. It produces an exact-SHA receipt and logs in the existing Stripe workflow. It never executes those functions or calls production. Other Deno workflows include the configuration in their path triggers.

Local preparation verified Node script syntax only. Deno, full source tests and browser checks must be executed in the normal GitHub workflows because this container cannot resolve external dependency hosts. At preparation those candidate results were not established. Inspect the actual final PR runs and artifact; do not call the provider error fixed solely from this proposed configuration.

## Separate publication-control blocker

Resolving dependency checking does NOT establish safe publication. The operator reports internally conflicting provider build labels, old Cloud project metadata `cqwtpsxruzplfbeuwpkg`, and zero Cloud credits. Current browser traffic was operator-verified as canonical `xiqpfhsdlvwrwhclonsg`; do not reconnect Supabase merely to make Cloud metadata match.

Available native publication controls expose no explicit Git-SHA target or frontend-only exclusion. A provider AI-support reply also reports unsupported isolated publish/rollback controls. Actual project-specific deployment side effects, source linkage and a $0 path still need supported evidence or a new bounded owner decision. No publish, rebuild, Lovable agent, permission override, credits or alternative hosting are authorized by this repair.

## Next actions and approval gates

1. Implement, inspect and test this Deno-only source candidate, retaining the draft/unmerged boundary. Ordinary Class A repair does not require another owner approval.
2. Independently inspect the positive/negative dependency proof and all final exact-head regression checks. Record a precise source-verification result and remaining publisher unknowns.
3. Reconcile the publication method before proposing executable production actions. Preserve the existing combined #168 TEST sequence as pending, not renewed authority. New source, configuration or hosting release decisions must name their exact scope; do not replay the old packet.
4. Only after an approved production release and owner TEST journey pass may a separate Class C genuine R999 request be prepared. No new TEST order, external customer contact or live arming.

## Processes, spending and protected state

No comment, commit or state file launches Codex. Inspect real CI/process identifiers; if none can continue, state: The project is unfinished. Work has stopped. Identify the next responsible actor and blocker. Do not claim that this source document is a running implementation worker.

Maximum additional discretionary spend $0; actual account billing UNKNOWN. No API billing, credit purchase/reload, paid runner/service, Lovable implementation, Vercel, production write, migration, deployment, secret/configuration change, order action, email or payment is authorized here. Protected owner/legacy acceptance identities and private baseline remain in the existing immutable release packet and private evidence, not copied into public artifacts.
