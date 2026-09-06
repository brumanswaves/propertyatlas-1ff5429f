# Easy Erf Release State

Last reconciled: 2026-09-05. This dated receipt is not production authorization.

## Authority and Frozen Outcome

- Active release: EE-R999-01. Current work is Class A navigation repair only, authorized by PR #166 [handoff 5554089939](https://github.com/brumanswaves/propertyatlas-1ff5429f/pull/166#issuecomment-5554089939) and the owner's instruction to execute it.
- GitHub main is code truth; Master Plan is product truth; Current State is the operational snapshot; Decision Log records durable decisions.
- Frozen outcome: genuine R999 property selection -> canonical payment/webhook -> correct order -> founder fulfillment -> automatic notification -> exact customer report retrieval. Mocked acceptance is not completion of this outcome.

## Repository and Candidate

- Main/start: `596cccf00cd71d032b064e7c2c5b4850d5fc744c`; tree `285ae5942ef64a95e9c95e23587554d98750f6fb`.
- PR #166 is merged. Its approved head was `040bfb2d343d752e3cdc64d419b14a93403bd38f`; do not replay its release or push repairs to its merged branch.
- Current branch: `codex/ee-r999-founder-navigation-repair`, created from fetched current main in the clean isolated `easy-erf-release-166` worktree. Protected original dirty worktree remains untouched.
- Candidate: the commit containing this repair and receipt; resolve exact SHA using Git. One draft follow-up PR will carry exact-head CI/artifact links; no parallel repair exists at branch creation.

## Completed Release, Stopped Acceptance

- Preserved Class B receipt: [PR #166 comment 5551803394](https://github.com/brumanswaves/propertyatlas-1ff5429f/pull/166#issuecomment-5551803394). This repair does not rewrite that history.
- Previously verified merge/deployment: main above; Supabase `xiqpfhsdlvwrwhclonsg`, only `easy-erf-founder-fulfillment` version 17, JWT verification true; bundle SHA-256 `690d8ba18b39f37fcfa0d6462022326ef53886aa8b4cc9f3f683080529b07fb0`. Deployed files matched merged Git source.
- Previously verified passive frontend deployment: `61a4536c-4d98-4110-b5a8-284551ff9ce4` from that merged source. All four post-merge workflows passed: Guided 33964861439, Founder 33964862294, Stripe 33964863135, Human Review 33964864254.
- Production acceptance stopped when Back to read-only queue did not return after refresh. Email was disabled and its false value independently checked. All four order metadata snapshots were identical before/after; no order mutation or email occurred. No money movement was performed.
- Those production values are prior verified receipts, not newly queried runtime state in this source-only repair. Do not reopen the owner order or access production to reproduce the issue.

## Verified Diagnosis and Repair

- Built unchanged main locally with fixture-only configuration and intercepted all backend traffic. At 484x828, refresh followed by a 15px scroll placed the Back button center at (109.60, 114). `elementFromPoint` identified the fixed Founder Operations nav (y=80..117). A real mouse click hit that nav; selected hash and workbench remained. No order request was submitted.
- Local refresh at scroll 40 reset to scroll 0 and Back worked; the failure is not proven to be router/hash corruption. The reproduced defect is pointer interception by the fixed overlay. Exact prior production scroll position is unknown.
- Preserved failing reproduction outside Git in `navigation-baseline-interception`: screenshot, diagnostic JSON, receipt and trace. Trace SHA-256 `6e7c00bb276a453e90731a545fcd34fabff689bb1cfa3de1e9c62ba2e48b7b51`; screenshot `cc155fcbaa2d317d889b273101f2c8ccaa0c6ea91164f79fefa1a0bd3131e0b4`; diagnostic `d956eea30c1a4b640816314ad8a50b9f3aa9ce81f04240ca8b9bee0f8508d969`.
- Small repair: operations nav uses document-absolute rather than viewport-fixed positioning; fulfillment content begins below it (`pt-36`). No z-index escalation, navigation removal, access-control change or order/history-state change.
- The prior browser suite checked refresh and mobile delivery, but never narrow scroll-after-refresh return with the actual hit target. The expanded existing suite covers this missing combination using mouse, touch and keyboard, not forced clicks or JS handler invocation.
- Local repaired production-build browser: 15 groups passed. Five navigation scenarios span 1440/484/390/320px, shallow/deep scrolling, refresh, selected-hash removal, no actionable workbench remaining, and explicit opening of another order with no leaked report/checklist/file/failure/notification state. Navigation submitted zero order/notification requests. Users and Entitlements shared navigation also passed.
- Local focused: 5 files / 56 tests passed. Existing Windows CRLF-only SQL string assertions required temporarily reading two unchanged fixtures in Git LF form; original bytes restored. No migration diff.
- Local strict TypeScript, targeted ESLint (zero warnings/errors), production build and whitespace check passed. Browser evidence records this as a dirty pre-commit candidate, not exact-head release proof.

## Remaining Gate and Ranked Actions

1. Commit repair with this state file, push one draft follow-up PR, and run established four workflows once against the credible candidate. Full Vitest is delegated to the existing Guided CI gate rather than repeatedly run locally.
2. Download exact-head browser artifacts; inspect receipt SHA/clean state, screenshots, trace and request evidence. Update the PR evidence receipt with actual results. A green artifact-upload step alone is not proof.
3. Prepare one bounded release packet: frontend-only production change after separately approved merge/publication; no Edge Function deployment, migration, secret or payment change needed. No release action is automatic.
4. New owner approval would be needed to publish this exact repaired source and repeat read-only production navigation acceptance. Delivery/email acceptance requires its own explicitly bounded authority; previous failed Class B approval cannot be replayed.

## Restrictions, Unverified Work and Spend

- No merge, ready-for-review change, deploy, publish, Lovable/Vercel use, migration, production write, secret/DNS/billing change, email enable/send, payment, order creation or legacy-order mutation in this repair.
- Live navigation repair and commercial outcome remain UNVERIFIED. Existing email-disabled status is preserved, not reconfigured. Source acceptance does not certify production.
- Same owner-selected session; no model switch, delegation or second agent. Routine work uses deterministic tools and existing normal GitHub runners. Runtime model identity and allowance consumption are not independently verified.
- Maximum additional discretionary spend: $0. No API billing, credit purchases/reloads, paid runner/service activation or billing changes performed. Actual cash spend and remaining billing uncertainty: UNKNOWN.
