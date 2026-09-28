# Exact-order entry prerequisite receipt

Source-only continuation of PR #194 comment 5871856438, 2026-09-28. Existing sole Codex task; branch codex/exact-order-entry. Base 535ef35aa8baf535ec34228b9366a1a3a4bfc5fe. Implementation candidate 64ee0284a37e4953c671364d97c9797b13d60a62. Application/test source tree: a3a3d2068f77595c0dd6cbc6ba99304bb2de351f. The draft PR binds the final evidence-only commit. No competing Easy Erf writer appeared in the inspected task list. Unrelated primary checkout and existing artifacts preserved.

## Verified source result

Only admin_.fulfillment.tsx and useFounderOrderData.ts change runtime behavior. Initial undefined selection represents unresolved URL intent; only explicit null permits a queue request. A malformed nonempty hash produces an invalid-link state without any data request. Valid full-UUID deep links load detail only from the first eligible effect. Queue errors are shown only in overview. Deliberate Back to investigation queue restores the existing overview.

The hook separates queue and detail dispatch and refresh. Results and callbacks are bound to an account/role/selection/auth-loading lifetime and AbortController identity. A stale A-B-A response or old callback cannot adopt a later matching identifier. A late queue error cannot cancel, clear or hide selected detail. Existing founder/assigned readers, AdminGuard, backend authorization, canonical shared-investigation client and revision-guarded mutation paths are unchanged. Formatting is limited to changed files; no lint rule/config changes.

## Executed validation

- 16 isolated React component/hook browser cases pass. The actual page is server-rendered then hydrated under StrictMode; existing read functions run against deferred synthetic transport. Checks cover zero queue requests on initial deep link/remount/focused post-save callback, unresolved and three invalid targets, late queue success/failure, existing queue-error isolation, unauthorized detail, order/account/role A-B-A cancellation, auth-loading/logout and founder/assigned deliberate overview.
- Fixture replaces auth/access context, backend transport, layout and heavy workbench/editor components. Its synthetic post-save button calls the actual parent refresh callback; no real save is modeled or claimed. It exercises entry and read lifecycles, not production Auth/RLS or guarded-save backend execution. Browser external requests are aborted; no customer session is used.
- Full unit run: 173 files, 1785 passing tests and one failing source-text assertion invalidated by formatter line wrapping. Repaired the assertion to tolerate whitespace; its seven-test file then passed. This is a full run plus affected rerun, not a second green full-suite invocation. Earlier affected subset: 66 passing tests.
- Original changed-TypeScript ESLint including prettier/prettier: exit 0. Fixture JSX files are outside existing ESLint configuration and yielded two ignored-file warnings; no configuration was relaxed. TypeScript and git diff --check: exit 0.
- Normal configured non-deploying npm run build on the implementation candidate: exit 0, cloudflare-module target. Existing .env SHA256 0572f885ec179732c9ad30819bad8edf98badb0db4170a7d31f7af70c0d96053 unchanged. Node network-denial preload reused byte-for-byte from PR #194, zero network attempts. This is process-level guarding, not an OS firewall attestation. No configuration values copied or printed. Existing nonfatal bundler warnings remain in the sanitized log.
- Earlier #194 geometry fixtures retain their attribution to unchanged geometry/save code. No release checks or screenshots replayed.

## Reproduction and evidence

Use existing installed dependencies, no installation. Set EASY_ERF_PLAYWRIGHT_MODULE to the installed Playwright module file URL; optionally set EASY_ERF_CHROMIUM to an existing Chromium executable. Run `node src/lib/humanReview/__tests__/exact-order/verify.mjs`. It starts a loopback-only fixture on port 4195, uses an isolated browser context with external traffic aborted, and closes browser/server on completion. This test harness does not establish production browser-control capability.

Unit command: `node node_modules/vitest/vitest.mjs run`. Affected rerun: `node node_modules/vitest/vitest.mjs run src/lib/payments/__tests__/humanReviewFunnelUxGuardrails.test.ts`. TypeScript: `node node_modules/typescript/bin/tsc --noEmit`. Lint: existing ESLint CLI over all changed TypeScript and fixture script files. Whitespace: `git diff --check`. Build runner: retained PR #194 configured-build.mjs with only its artifact output directory changed to artifacts/exact-order; matching network-deny.mjs copied into that directory. The exact configured-build command, revision, timing, versions, configuration identity and exit code are in configured-build-receipt.json.

Adjacent files contain component results, unit summary and affected rerun, lint/typecheck logs, build log and receipt. SHA256SUMS.txt binds them. The full initial unit failure log remains locally at artifacts/exact-order/unit-tests.log. Initial development failures were a nullable result dereference (caught by TypeScript and fixture, repaired) and a test locator using an incorrect button name (corrected to the existing visible label). Final component results are from the corrected source. No application changes followed those passing cases.

## Actual supported production browser limitation

Inspected Codex desktop mcp__cua_repl / unified-computer-use, existing Chrome extension browser id 2. Browser-wide capability list exposes viewport; a temporary blank tab exposed pageAssets and cdp. Its actual CDP documentation says: "Navigate a fresh tab to its intended HTTP or HTTPS page before the first CDP command." CDP is scoped to the current web origin and can address discovered attached child targets. No CDP commands were sent. The blank tab was closed; no production navigation occurred.

Consequently pre-navigation interception from a fresh tab is not supported by this documented sequence. Complete request controls covering frames/workers/prefetch/redirects and exact RPC bodies have not been installed or verified. No broader claim that all existing-tab interception is impossible is made. No alternate page, fake successful live response, credential/storage export, extension install, debugger port or provider setting change was used. Live acceptance remains blocked independently of this completed source repair.

## Boundaries and next actor

Save ledger: 0 of 1 attempts used, unchanged from the locally read geometry receipt. Current real order revision/geometry/inputs remain UNKNOWN. No live reads/save, merge, publish, rollback, backend/schema/Edge change, maps/data/AI or report/payment/email action. No background job left running by this validation. Model/reasoning selection unchanged; actual selector label is not exposed. Additional discretionary action spend $0; account-wide metering UNKNOWN.

Next: independent reviewer evaluates the exact draft-PR candidate and these receipts. A later release needs its own exact-candidate authorization; live acceptance additionally needs demonstrated supported request controls before loading production. This source fix is not deployed. Satellite imagery, real Erf 1570 persistence, envelope approval and whole-product acceptance remain open.
