# Issue 198: document identity provenance

Source-only repair by the existing sole desktop task. Base main: `3fb1d7ea284e792d5ddf05c0d4b96fca12230353`. Tested implementation: `b395c55dd810ae4a954a5af441c0192e2b1c69be`. The final PR head adds this evidence only; `source-binding.json` binds every changed source blob and the full source tree.

## Result and corrected wording

A readable unverified document explicitly attached by the user remains permitted working evidence. It is no longer called independently identity-matched by investigation findings, messages, the ownership report, summary or appendix. Mixed ownership values use their own source metadata. A genuine automatic match may be labelled matched, but never certifies ownership. Unknown source identity stays unknown. Parent context is not subject ownership, mismatch takes precedence, and unread/failed/archived material is not silently upgraded.

For the observed unverified/user-attached case:

- Guided title: `Readable - attached by you`, `Identity: unverified`, and `User-supported evidence. Document identity has not been independently matched. This does not certify ownership or legal rights.`
- Investigation: `Property report attached by user`.
- Report summary: `Ownership details from user-attached evidence`.
- Each affected ownership value: `(user-attached; document identity not independently matched)`.
- Appendix: user-supplied scope and an explicit not-independently-matched explanation.

The existing evidence pack projects the existing canonical identity metadata as an optional read-only source field. No database or persisted metadata schema was changed. This minimal report adapter projection avoids guessing identity from readability or a user-confirmation flag, including a historical attachment flag remaining after a genuine match. Claim confidence, references, area/title conflicts and processing/redistribution restrictions remain intact. The selected Ask adapter retains its existing claim provenance; the legacy ownership adapter inherits corrected report wording. No AI call or document extraction was run.

## Proof

- 16 new actual canonical-module and React server-render cases, including the actual Guided title and printable appendix components. Covers matched, matched with historical attachment, unverified ready/partial attachment, unconfirmed, mismatch, parent, wrong binding, unread, failed extraction, failed/archived asset, unknown identity, mixed documents, missing legacy metadata, removal and selected-parcel transitions. Spies assert no fetch, extraction, upload, removal, confirmation or open operation during derivation/rendering. Synthetic metadata and claims only.
- Final affected suite: 35 files / 482 tests, exit 0. Final full suite at the implementation commit: 174 files / 1,802 tests, exit 0.
- Original changed-file ESLint with prettier/prettier enabled, TypeScript and whitespace: exit 0. Existing formatter applied only to changed TypeScript files; much of the diff is formatting in previously unformatted files.
- Normal configured `npm run build`: exit 0, Nitro cloudflare-module. Existing configuration unchanged. Reused Node network-denial preload recorded zero attempts. This is process-level denial, not an OS firewall assertion. Configuration values were not printed/copied. Build-generated routeTree changes were discarded after verifying attribution.
- Initial tests found an archived/failed source gate gap and an obsolete extraction-label fixture that lacked a readable status; both corrected. An initial TypeScript run identified the new appendix state's missing tone mapping, corrected. Earlier failing logs are not final passes.

Reproduction: existing installed dependencies only. `node node_modules/vitest/vitest.mjs run`; focused directories in `affected-tests.log` match evidence/reports/investigation and extraction client. `node node_modules/typescript/bin/tsc --noEmit`; ESLint over changed TS/TSX files; `git diff --check`; `node artifacts/issue198/configured-build.mjs`. Build runner points to its original local artifact directory and requires its adjacent network guard. No dependency installation.

## Retained evidence and limits

The exact-order page/hook, shared scope and previous isolated browser fixture are unchanged. Prior PR197 29-case browser evidence for account/order transitions, late results, cancellation and draft isolation retains its original attribution; it was not rerun. New SSR cases do not claim a real browser lifecycle or Auth/RLS proof. Geometry acceptance from this task's original local receipt is retained: revision 59 to 60, existing inputs unchanged, exact ring persisted after reopening without recovery, satellite visible, five map loads, zero static images. Save allowance is 1/1 consumed, never reset.

The live contradiction was observed in this task before repair. The already saved local draft JSON/screenshot and open unapproved browser tab were preserved, with no reload/navigation or production data read during this source task. The live application still has the old wording until an independently reviewed, specifically authorized release. No frozen/human version was rewritten, and no report approved or delivered.

Remote CI was not run and is not a pass. Commits use [skip ci] because the existing workflow can contact production, which is outside this source task. No workflow, protection or permission was changed. No merge, publication, account operation, provider processing, save or email. Additional discretionary spending initiated: $0. Existing acceptance budget is not renewed; actual provider billing remains unknown.

## Remaining steps and actors

1. Independent reviewer inspects this exact candidate. Owner makes a separate candidate-specific release decision; this PR stays draft.
2. After an authorized release, the human reviewer checks the corrected actual report and reconciles title identity using permitted source evidence. The preserved unapproved draft must be substantively reviewed, not automatically certified or overwritten. Any new version requires the normal human approval action.
3. Founder preflight needs an already authorized Founder Operations session at `/admin/launch-readiness`. The prior investigator session was denied by the normal role guard. Use normal owner sign-in only, no role/permission changes or live arming.
4. Customer acceptance needs the actual bound customer session for the existing exact `/orders?report=fd14b0c1-410d-4aec-beaa-5b5d133e56cf` and normal dashboard/report reopen. The investigator session is not customer acceptance.
5. Delivery remains gated by safe recipient verification plus explicit owner authorization of that recipient, human approval of the actual version, and applicable document rights. The previously platform-denied recipient/processing-permissions query must not be retried or rerouted. No original redistribution or AI processing is enabled by this repair.

Whole-product acceptance remains open. Source work is complete for review, not released product acceptance.
