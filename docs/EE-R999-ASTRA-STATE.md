# Easy Erf Release State

Reconciled 2026-09-07 after independent PR #168 source review. Class A only; no release authority is implied. BUILD_GOVERNANCE.md section 23 requires real execution and explicit stopped/process status.

## Canonical source and outcome

Release EE-R999-01: genuine R999 payment through signed webhook -> correct customer/parcel order -> actual investigation/resolved checklist -> evidence-backed delivery -> automatic email -> authenticated exact-report retrieval with no duplicates. Commercial acceptance is UNPASSED.

Expected GitHub main: `be28f4d0742885f5a483ef21d3ad44ac8753de6a`; tree `4e4ad2eb624861fc2a6964b583f94fb5a0e2c35e`.
Active draft PR #168: `chatgpt/ee-r999-selected-order-data`. Do not duplicate the branch, repeat #166/#167 or merge without exact-candidate approval. The final PR review receipt pins the candidate SHA, current workflow IDs and artifact hashes; earlier evidence is historical.

## Implemented source boundary

Founder queue: explicit fourteen-field metadata RPC, admin check, SECURITY INVOKER/caller RLS, no report/payload/contact/context/receipt bodies. Detail is deliberately selected by full UUID with no bulk fallback. Lifecycle classification preserves valid active orders without a finished report. Account/selection/exit/sign-out/error/unmount guards discard stale private data; queue errors expose a read-only retry.

Independent review found that the customer email URL also performed a same-customer bulk read. The selected `/orders?report=<UUID>` query now includes exact UUID, user and provider filters, rejects invalid/empty parameters without a read, validates response identity/count, aborts old requests and binds visible state to account and report. It never substitutes another report after a failed or missing selected read.

The ordinary customer list without a report parameter is unchanged and is NOT metadata-only. Do not enter that general list or use Back to reports during the restricted owner production acceptance. No claim of unauthenticated cross-customer disclosure is made.

New `verify-customer-report-link-browser.mjs` operates the production bundle with synthetic identities and blocked external traffic. It inspects actual response bodies and nonselected sentinels, exact reload, invalid/missing/error paths, delayed A after B, account change and mobile layout. It runs within the existing Founder artifact, alongside the founder navigation/authoring fixtures. No production data or credentials are used.

## Evidence already inspected; final-head proof still required

Historical original candidate `3a9451d1f17b7766ff86fbd678078d83f357b9aa`: Codex supplied four green workflows and inspected founder/Guided artifacts; independent review corroborated those original flows but found the untested customer-link read defect.

Application candidate `6a79d5ed9d6b31f8eec16f81d6d365cf4473d591`: all four workflow conclusions were independently read as success. Founder run 34118857961 produced artifact 10017436173, digest `0a1d372b948d244e66793621db901f2405f441e94d4642a5933f5dfc0f19e862`. It was downloaded/hash-checked; receipts bind the clean SHA to 19 founder groups and six customer-link checks, no failures and no production access. Actual customer response bodies and trace/screenshots require final-head reinspection after any new commit. Original application assertion failure was an obsolete `.eq("user_id", user.id)` literal; account filter was preserved as `userId`, and the regression check was strengthened rather than removed.

Local full checkout/build was unavailable to this ChatGPT review because the container could not resolve GitHub. Actual build, typecheck, isolated PostgreSQL and browser execution occur in existing GitHub Actions. Do not convert CI evidence into a claim that local Codex or this container ran the complete build. Protected local worktree state is reported by Codex, not independently inspected here.

## Runtime baseline and limits

Earlier source/catalog inspection recorded canonical project `xiqpfhsdlvwrwhclonsg`, absent new metadata RPC, inventory ending at 20260904123430 automatic email and equivalent manual migration 20260904090724. Fulfillment v18, upload/review-content v13, notification v12, readiness v11 were JWT-enabled and source-equivalent after line-ending normalization; no Edge deployment required for this read repair. Checkout helper equivalence is qualified in CURRENT_RELEASE_CONTRACT.md.

REPORTED prior frontend: `c725b385-a026-40fe-8fdf-48485c21fd7a` at expected main. REPORTED owner TEST is processing, report/checklist saved, no notification receipt. Current runtime email/checkout flags, sender/free allowance, production Git-tree attestation and completed inbox/TEST acceptance remain UNKNOWN until fresh preflight. No production body read/write or configuration mutation was made in this source review.

## Next action and approval boundary

1. Finish exact-head verification for the final candidate and inspect all jobs plus founder/customer/Guided artifacts, not only green summary badges. Keep draft/unmerged.
2. Prepare one combined Class B decision using EE-R999-01_RELEASE_PACKET.md. No intermediate owner permission is required for source verification.
3. Only explicit Class B approval permits merge, one new metadata migration, passive frontend and the exact owner TEST sequence. No Edge deployment, new order or live money.
4. TEST must first prove read isolation and unchanged metadata, then saved report/checklist and negative gating, disabled-email staging, one reopen, one enabled final automatic email and exact customer deep-link retrieval. Restore email false before a same-version dedupe request. Keep target ready with its one successful receipt; no extra reopen or history erasure.
5. Class C genuine R999 remains blocked until independent TEST acceptance passes.

## Processes and spend

A commit, prompt or PR comment does not start Codex. Inspect real workflow/process IDs at each stopping point; do not imply later background work. No automatic implementation or reviewer process is created by this state file.

Maximum additional discretionary spend $0. No API billing, credit purchase/reload, paid runner, service activation, Lovable implementation, Vercel or billing change. Actual account charges UNKNOWN. No production release, migration, secret change, email or payment was executed by this source review.
