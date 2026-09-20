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
