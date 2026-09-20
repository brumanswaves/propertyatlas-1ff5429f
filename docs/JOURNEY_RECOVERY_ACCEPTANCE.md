# Customer handoff recovery, 2026-09-20

Source-only continuation of PR #187 at `e31a7087b53dd95a0a9d1c4f4dffe794f8f596f6` on `codex/product-journey-completion`. One implementation writer. PR #187's reviewed head and the separate PR #186 report design are unchanged.

## Changes and evidence

- `prepareCustomerInvestigation` now checks the active account after the final save. A sign-out or account switch during that save rejects the handoff. Two regression cases failed before this change; all five account/save cases pass afterward. These are mocked transport tests, not production persistence evidence.
- The actual `HumanReviewTakeoverCard` previously navigated to erf 42 after the customer selected erf 43 while its save was pending. This was reproduced in Chrome using synthetic data. Pending navigation is now invalidated when its destination changes or the component unmounts. A ref also prevents overlapping requests; rejected or synchronously throwing preparation clears busy state and exposes the existing error alert.
- Chrome verification of the repaired component: completing the old save retains erf 43 without navigation; failed preparation exposes the error and permits retry; a successful retry opens `/pricing` for erf 43; closing the investigation before completion prevents navigation. The changed-parcel case also passed at 390 x 844, with the takeover button and property reference visible without horizontal clipping. The viewport override was reset afterward.
- The demo property panel no longer advertises an unavailable R199 monthly plan or presents illustrative module cards as paid unlocks. The actual component links to once-off investigation options. Its pricing destination without a parcel visibly requires selecting an official property first.
- Focused account and commercial guardrails pass. TypeScript and targeted ESLint pass; the lint invocation disables only the repository's existing whole-file formatting rule for these legacy files. `git diff --check` passes.

## Repeat the local browser checks

Run `node scripts/pricing-handoff-preview.mjs`. This existing preview disables environment files, aliases authentication to a synthetic fixture, guards external server requests, and restricts browser connections to localhost with CSP.

Open `http://127.0.0.1:4190/scripts/fixtures/handoff-recovery.html`.

1. Choose **Investigate it for me**, then **Choose erf 43**, then **Complete synthetic save**. Remain on the fixture with erf 43 selected and one save call.
2. Choose **Investigate it for me**, then **Fail synthetic save**. Remain on the fixture with a visible error and an enabled retry.
3. Choose **Investigate it for me**, then **Complete synthetic save**. Pricing must name erf 43, not erf 42.
4. Reload the fixture, begin preparation, choose **Close investigation**, then complete the save. No navigation should occur.
5. Open `/scripts/fixtures/journey-demo.html`. Demo modules are explicitly illustrative; the once-off options link reaches pricing without a confirmed parcel and cannot start checkout.

The fixture uses actual customer components, synthetic promises and mock authentication. It does not upload documents, charge money, contact providers, or establish live acceptance.

## Remaining boundaries

Production publication, deployed backend alignment, a fresh authorized SG acceptance and genuine commercial acceptance remain separate. The earlier SG upload allowance was consumed by its failed attempt; none was repeated here. No existing documents, owner drafts, orders or payment state were changed. No deployment, merge, email, Lovable builder, provider request or new service purchase was performed. Development account cost is not available from these checks.

## Report access and failure recovery

The actual `/orders` component was also checked in the isolated browser fixture. Before repair, a signed-out visit to `/orders?report=00000000-0000-4000-8000-000000000042` landed on `/auth` with the destination lost. It now carries the exact local return path through the existing auth route. Synthetic sign-in returned to that exact order URL. No real authentication, email or report content was accessed.

A failed report-list read previously rendered the same empty-state purchase invitation as a successfully loaded account with no paid investigations. The response now carries an account-and-selection-bound failure state with an explicit retry. Failed reads show a persistent error, hide the empty-account claim and avoid presenting payment status from an unavailable result. Existing cancellation, ownership and exact-order checks are preserved.

Browser verification used the fixture's deliberately failing report read, then **Allow synthetic report read**. Restoring the fixture service did not itself change the page. **Try loading again** performed the successful synthetic empty read and only then showed the empty-account state. This is a local component recovery check, not a claim about live orders or billing.

For repeat verification, the pricing preview also serves `/orders`; its footer offers synthetic account and read-failure controls. The initial report read fails until explicitly allowed. The fixture never returns real report rows. Focused staff navigation, fulfillment UI, shared-report rendering and founder queue checks: 5 files / 69 tests passed. No unchanged full CI was rerun.

The final local node-server production build, TypeScript check, targeted lint and whitespace check passed. The build used the repository's local-only network guard and did not deploy. Build output is retained locally in `artifacts/journey-recovery-build.log`.

Additional focused journey review: 46 checks passed across guided journey, canonical shared investigation, guided components and report-step suites. These checks do not add live/provider evidence. Remote read-back confirmed the continuation implementation at `eb5b028408002f838c5c6467dd21ab985dea052f`, with the #187 and #186 heads above unchanged. Draft PR #188 targets #187's branch, so it contains only this continuation and does not repeat the unchanged main-target CI workflows.
