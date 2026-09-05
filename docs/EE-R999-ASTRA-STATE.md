# Easy Erf Release State

Last reconciled: 2026-09-05, local repair gate. Read this as a dated operational snapshot, not a release approval. Exact-head CI receipts and the final handoff belong on PR #166.

## Authority and Frozen Outcome

- Active release: EE-R999-01; Class A source-only work.
- GitHub main is code truth; Master Plan is product truth; Current State is the operational snapshot; Decision Log records durable decisions and supersession.
- Frozen customer outcome: a coherent done-for-you property investigation and report, fulfilled safely for the intended customer order.
- Current bounded work: a compact read-only founder queue, deliberate selection of one order, actions confined to that order, stable identity/status across refresh, legacy-order separation, explicit reopening, and honest delivery/email outcomes. No unrelated features or commercial activation.

## Exact Repository Position

- Repository: brumanswaves/propertyatlas-1ff5429f.
- Verified GitHub main: `40fb20ef6425eb990225127dd6ca01704e05b73b`.
- Branch: `chatgpt/ee-r999-single-order-fulfillment-safety`.
- PR: https://github.com/brumanswaves/propertyatlas-1ff5429f/pull/166 (open, draft, unmerged).
- Repair starting candidate: `e329e7945d060e4d4694f1d17b54825e4b5d38a5`.
- Current repair candidate: the commit containing this state update, on the same PR branch. Resolve its SHA with Git; browser receipts record the exact checked-out SHA rather than a mutable branch name.
- Isolated checkout was safely fast-forwarded from `04d362c8b1c30e046870c93b4ab830adf0d1b00d` to the handoff SHA; all remote changes were preserved.
- Protected original `property-evidence-pack-foundation` worktree was not changed during this policy pass.

## Verified Completed Work

- Historical candidate `04d362c8b1c30e046870c93b4ab830adf0d1b00d`: focused tests, full Vitest (149 files / 1496 tests), TypeScript, targeted lint, build and diff checks passed; mocked built-app browser acceptance passed. Four exact-head workflows were green. These results do not certify the newer candidate.
- Current candidate `e329e7945d060e4d4694f1d17b54825e4b5d38a5`: Guided workflow logs confirm focused 9 files / 74 tests and full Vitest 149 files / 1503 tests passed.
- Current candidate founder workflow: Deno check, focused 5 files / 55 tests, isolated PostgreSQL proofs, build, TypeScript, targeted lint and diff check passed.
- Current candidate Stripe fulfillment and Human Review product workflows succeeded.
- Repair executed: isolate pinned Playwright installation outside the application's Deno/npm dependency tree; run the actual generated Node server entry for built founder acceptance; pin both repaired workflows to the triggering SHA.
- Repair executed: assign a monotonically increasing viewport request within the existing map loader. Older responses, errors, test fallbacks and final status publication cannot overwrite the current viewport. No geometry, matching, payment or persistence contract changed.
- Browser regression executed BEFORE the loader repair: deliberately deliver the target viewport before the stale initial viewport. Existing code produces the same saved-parcel fallback, with no page errors or unexpected mutations. This proves an existing response-order race; old CI did not record enough network detail to prove its exact upstream response sequence.
- Same browser regression AFTER the repair: initial confirmation, atomic cloud projection, fresh-context hydration and dashboard reopen at Add address all pass. Both contexts exercise the late initial response. Reopened screenshot inspected.
- Built local browser acceptance: founder 9 groups passed; Guided persistence/race regression passed. Services are intercepted; synthetic test geometry is not live cadastral proof.
- Local checks: focused 6 files / 76 tests passed, TypeScript passed, targeted ESLint had zero errors and one existing React-refresh warning, production build passed, whitespace check passed. Two unchanged SQL fixtures were temporarily read in Git's LF form to avoid existing Windows-only string assertions, then restored byte-for-byte.

## Prior Failures, Root Causes and Remaining Gate

- Guided integration run [33953289743](https://github.com/brumanswaves/propertyatlas-1ff5429f/actions/runs/33953289743) failed public browser acceptance: `Could not find visible reopened Guided working-address heading.` Subsequent verification steps in that workflow were skipped. Cause remains unverified.
- Founder verification run [33953289767](https://github.com/brumanswaves/propertyatlas-1ff5429f/actions/runs/33953289767) failed during a second application dependency mutation: npm `Cannot read properties of null (reading 'edgesOut')`. No browser ran. Isolated pinned installation and browser launch now pass locally without reifying the application tree.
- Local built acceptance also exposed Vite preview looking for absent `dist/server/server.js`. The workflow now builds the Node preset and serves its real `.output/server/index.mjs` on loopback; both browser checks pass through that entry.
- Exact-head remote acceptance remains a gate until all four workflows pass and receipt, screenshots and non-empty traces are downloaded and independently inspected. Do not transfer previous-head green status to the new candidate.
- Both browser checks retain their customer assertions. Guided now records screenshots, traces, intercepted request diagnostics and a SHA-bound receipt, and has no live-service dependency.

## Reported or Unknown

- Owner-reported production report preservation and legacy-order behavior remain reported, not independently verified production outcomes. No private order identifiers or customer content are recorded here.
- Live runtime/customer acceptance is UNKNOWN; mocked browser and isolated database tests are not production proof.
- Actual account billing, remaining included allowance and total additional cash spend are UNKNOWN; no billing statement was inspected.

## Next Ranked Actions

1. Commit the five-file repair including this state document, reverify remote branch position, and push the existing branch only.
2. Inspect all four exact-head workflows; diagnose any failure before another candidate or rerun.
3. Retrieve exact-run founder and Guided artifacts; verify receipt SHA, passing checks, screenshots and non-empty traces. Do not accept an upload step without actual downloadable files.
4. Record exact-head remote results in the PR handoff. Any further source repair must update this file with the new evidence.
5. Obtain required owner release approval. No merge, deployment or production mutation follows automatically from green tests.

## Approval Gates and Production Restrictions

- Source-only release work does not authorize production changes, deployment, frontend publishing, Lovable synchronization, migrations, secrets/configuration changes, live payment activation, customer emails or production data mutation.
- Keep PR #166 draft; do not open competing implementation branches or duplicate work for the same issue.
- Any production action or expansion beyond the frozen outcome requires explicit owner authorization.
- Never include credentials, tokens, customer-sensitive data or private production content in this file.

## Model and Cost Operating Policy

- Use Astra for project recovery, ambiguous/high-risk decisions, cross-system debugging, data integrity, adversarial review and final acceptance. Prefer deterministic tools and Luna/Terra/Sol as capable for routine work when available.
- No model delegation/switching or second parallel session was started. Runtime model identity was not independently verified. Routine work used deterministic local commands and GitHub tools; existing normal runners only.
- Authorized additional discretionary spend: $0. No API billing, credit purchase, reload, paid runner/service activation or billing settings change was performed by this operator. Public npm installation does not authorize a paid service.
- Known additional cash charges: none independently established. Actual total spend and remaining billing uncertainty: UNKNOWN, not asserted to be $0.
- Do not use API keys/API billing, buy credits or Actions minutes, enable larger/paid runners, activate paid Resend/services, use Fast mode without approval, or authorize a nonzero charge.
- Use normal existing runners only. Diagnose locally and run the smallest relevant check before full CI; never rerun merely to seek green.
- If allowance becomes constrained, preserve exact state, continue capable work with included lower-cost models or deterministic tooling, and report only the Astra-dependent blocker plus the next $0-authorized action.
- At each material milestone update this file; at release gates report model/tool use, API billing, purchases, paid activations, known spend and uncertainty. Recheck live refs/evidence rather than treating this snapshot as permanently current.
