# Easy Erf sign-in continuity and completion receipt

20 September 2026. Sole Codex writer. Local source increment only.

## Implemented

- The pricing page retains the exact canonical parcel, emphasis, intended use and questions through explicit same-tab sign-in. Questions are held temporarily in session storage, not placed in the URL.
- A one-use random handoff identifier expires after 30 minutes. Restoring checks the parcel and account, excludes consent and never starts checkout automatically. Storage failure keeps the current answers on screen. Account switches clear the previous answers.
- Both pricing sign-in links and the real desktop/mobile header use this handoff.
- Map sign-in carries the selected official parcel and map coordinates through the existing canonical parcel-reopen route. No duplicate property/evidence store was introduced.
- Signup confirmation and Google OAuth share the validated return callback. No actual email or OAuth operation was performed.

## Verification

- Focused tests: 53 passed across handoff, account access, navigation and parcel reopening. TypeScript, targeted lint and the final production build all passed. The build did not deploy.
- Browser: actual PricingPage and TopNav, synthetic authentication only. Main sign-in restored Erf 42, intended use and questions; consent remained unchecked and checkout disabled. Switching to another synthetic account cleared answers. Real desktop and 390px mobile header links also restored questions and the same erf.
- Synthetic fixture runs at 127.0.0.1:4190 via scripts/pricing-handoff-preview.mjs. It prohibits checkout, supplies no credentials, and restricts browser connections to the local origin. It is not a production service.
- Map identity/reopen helpers and return URL behavior have focused tests. The full map plus real signup-confirmation email/provider round trip remains unverified for this increment.
- Scope: same-tab handoff only. Opening confirmation in a different browser/tab may not have the session-stored answers; the selected property remains in the callback and missing answers are reported honestly. No cloud persistence or automatic anonymous-to-account draft migration is claimed.
- Source self-checks are not independent review. This increment remains local and unpublished, separately from report PR 186.

## Current integrated product evidence

Report draft PR: https://github.com/brumanswaves/propertyatlas-1ff5429f/pull/186
Exact report head: 565fd980c2519f0b836dd36c62a5237cfa9b3c7a.
Main/base: 1fef6f66e1d911aaf492567f9e8c2f04eae13674.
All six report-head checks passed. The isolated shared-investigation run 35503391701 was inspected: actual local Auth/REST/Storage, persisted evidence and Strategy, deterministic Site Potential, same-file handoff, investigator assignment, human approval, private immutable report delivery and denied unauthorized access. Zero live provider calls and no production access. Synthetic payment/email/provider fixtures do not establish live service acceptance.

The report's src tree remains identical to approved c5c814c43b1c5bd71f6a3d6f4e9f8f51d78a62e8. Original remote report branch and unrelated dirty canonical checkout were preserved. No merge or publication occurred.

## Scoped SG acceptance

Fresh customer-domain root HTML and linked SG/worker assets returned HTTP 200 with request caching bypassed, without clearing storage. Public observation at 09:59 UTC:

- index-CUax4t-0.js: f4bdb296810d1ec828160f7f5ec889e69bea663d147717819bc4d3306fe54858
- index-Ds-R1IZH.js: c107cf358616a697ee052e00447274e21d556e51ed30822c019bfb7a46c329bb
- sgPreview.worker-BJCrIS66.js: 27f3054cb58cc5e52625db94327cbc609b1efd7a0f4514762e40158389f0a6f7

Receipt/checksum, manual refresh and preview-worker references are present. Exact publication-to-SHA attestation remains UNKNOWN separately from served features. Publication 13f13e80-1983-4785-becb-e571f7aff497 was not repeated.

Approved owner and TEST parcel were verified. Existing order and two attachments retain their fingerprints. All 65 non-auth browser entries remain present; navigation changed only the workspace update timestamp. Fresh backend recheck: zero QA attachment and zero eligible automatic extraction jobs. Network observation after owner handoff: zero upload or extraction requests, untruncated.

The sole approved synthetic TIFF is prepared, 7,681,000 bytes, SHA-256 95a80568c63a2779218ab268affbce2201898bc4345a1c118cb553dbf9171a5b. The normal upload control was clicked; owner selection remains pending. No programmatic file-access bypass, reading, consent change, reselection, cleanup or real-document processing occurred. Recheck consumption and preservation before resuming. Only the new QA attachment may be removed during approved cleanup.

## Remaining boundaries

- Owner file selection is required for the one approved SG upload; dependent preview/reselection/continue/reopen/cleanup checks remain unexecuted.
- Independent review precedes release of the report and this separate source increment. No merge/publication authority is inferred.
- Production customer/admin completion is not established by isolated acceptance. Real charging, provider processing, email, account/security changes and release still require their applicable explicit authority.
- The exposed preview URL was not reopened. Lovable documents deleting a single managed link through Share > Share preview > Your active links. Whether the exposed publisher link is that supported type and whether it was invalidated remain UNKNOWN. No unrelated credentials changed. Reference: https://docs.lovable.dev/features/share-project#manage-active-preview-links
- Necessary development-model/CI use is owner-authorized for subsequent development. No live product AI, paid processing, Lovable builder use, purchases, new service or billing changes were performed. Exact account charges are UNKNOWN.

## Follow-up: approved SG attempt failed

After the owner selected the approved file, the one observed upload request returned HTTP 401. Canonical browser account checks returned HTTP 200 immediately before and after. No QA asset row or matching storage object was created. The TEST order and two original attachment fingerprints are unchanged. Normal Reload saved evidence restored revision 58 with all permission/reading controls unchecked.

The single upload attempt is now consumed/failed, not unused. Do not replay it. Dependent reselection/preview/continue/reopen/cleanup acceptance remains blocked. The runtime authentication cause is unknown; no supported runtime-log connector was available. Browser network events were truncated, so exhaustive absence of provider requests cannot be certified. No AI operation was initiated by the agent.

Receipt: https://github.com/brumanswaves/propertyatlas-1ff5429f/pull/185#issuecomment-5749260856
