# Easy Erf Build Ledger

## Original product promise

Easy Erf should take one real South African property from identification to useful due diligence: trustworthy evidence, planning/zoning understanding, development potential, strategy/financial context, unknowns/risks, and one clear next action.

## Current MVP commercial path

The active MVP direction is the existing Easy Erf product plus a **R999 human-assisted Property Investigation**. This is not a separate product.

The R999 investigation should combine:

- Easy Erf automation
- official/public-source evidence
- AI-assisted research
- human review where automation is incomplete
- clearly labelled unknowns instead of invented certainty

The commercial goal is to get the first unrelated customer to pay R999 for a useful property investigation and use repeated human gaps to decide what to automate next.

The report should be objective-driven. Ask what the customer is trying to do with the property and what they most want to know, then prioritize findings for buying, selling, building, developing, or investing.

Core report structure:

1. Property Truth
2. Property Potential
3. Deal Killers / Key Risks
4. Conflicts
5. Unknowns
6. Next Steps
7. Optional strategy / financial analysis when relevant

## Intended customer journey

1. Find or identify the property.
2. Enter Guided Investigation.
3. Complete evidence tasks one at a time.
4. See the report build progressively.
5. Review findings, risks, conflicts and unknowns.
6. Use specialist/expert workspaces only when needed.
7. Order or receive the R999 human-assisted investigation without leaving the Easy Erf product path.

Do not restart the product, build a separate parallel app, or prioritize the larger professional-referral marketplace before this MVP works.

## Canonical systems

- Canonical GitHub repo: `brumanswaves/propertyatlas-1ff5429f`
- Canonical code branch: `main`
- Canonical backend/database: founder-owned Supabase project `xiqpfhsdlvwrwhclonsg` (`Easy Erf`)
- Canonical production user surface: `easyerf.co.za`
- Deployment provider/configuration: must be independently verified before making provider-level claims
- Payments: current R999 human-investigation payment activation state is UNKNOWN until independently verified
- Product direction: `docs/EASY_ERF_MASTER_PLAN.md`
- Current state: this ledger plus repository/runtime evidence
- Permanent governance: `BUILD_GOVERNANCE.md` and `BUILD_TRUTH_COMMUNICATION_RULES.md`
- Vercel: prohibited for Easy Erf unless the owner explicitly reverses that rule

## Canonical acceptance property

Erf 1570, Portion 0, LPI `C03400140000157000000`, parcel key `E108C034001400001570000000`, approximately 618.7 m2, Sea Vista, Kouga Local Municipality, Eastern Cape.

## MVP acceptance test

A real signed-in user must be able to:

1. Create/sign into an Easy Erf account through a trustworthy branded auth flow.
2. Reopen Erf 1570 with persisted investigation state.
3. Upload/read SG and paid-report evidence and see useful extracted status/findings.
4. Select and confirm working zoning clearly, with shared state across Guided and Dossier/workspaces.
5. Use Market Evidence and Strategy with persisted state.
6. Use the simplified Site Potential flow without the low-value three-concept generation section.
7. See a coherent report assemble from the same evidence/state.
8. Understand unknowns, conflicts, next actions and what requires human review.
9. Enter the R999 human-assisted investigation path when automation is not enough.
10. Reopen the investigation/report later from the account.

Repository tests, migrations, commits, database rows, CI, or OAuth initiation alone do not satisfy this acceptance test.

## Verified repository/backend state

- PR #110 was merged into `main` at merge commit `5e9944932b1edccd75520b632dfb438b9e1b50b1`.
- PR #110 CI verified browser launch from the real `/auth` UI through founder Supabase to Google Accounts.
- Direct authenticated Supabase RLS simulation for both pilot users showed each user could read only their own checked Erf 1570 rows, with zero cross-user rows visible on the checked surfaces.
- The authenticated `patch_saved_property_user_data` write path was exercised inside a transaction, then rolled back; the probe data did not remain.
- Founder Supabase contains persisted Erf 1570 saved-property, evidence, Market Evidence, Strategy and Site Potential state.
- All 25 checked Erf 1570 asset pointers resolved to storage objects during the earlier cutover verification.
- `public.user_roles` had zero admin rows during the earlier verification, so Founder Operations authorization remains unaccepted until rechecked and intentionally configured.

## Owner-supplied live acceptance evidence - 2026-08-21

The supplied screenshots establish the following current user-facing problems on `easyerf.co.za`:

1. Google sign-in visibly presents `xiqpfhsdlvwrwhclonsg.supabase.co`, which is not trustworthy enough for the customer-facing brand.
2. Sign-in logo is too small/poorly presented.
3. No obvious forgot-password/reset-password path on sign-in.
4. No password visibility eye control.
5. Account signup does not clearly instruct the user to check email and verify before signing in when email confirmation is required.
6. Verification email branding is generic Supabase and does not clearly identify Easy Erf.
7. Header/tab contrast and color consistency regressed badly; some header text is unreadable.
8. Paid-report upload reading and SG-diagram upload reading show/document "Document reading is not configured yet" and/or remain unread.
9. The zoning selection area, especially "Working zoning for this erf", is not prominent enough.
10. Remove the entire Site Potential section/function "Generate three independent Site Potential concepts".
11. Restore the pre-Supabase product path toward the R999 human-assisted investigation MVP rather than treating data migration as the product goal.

## Current product blocker

The current blocker is not data ownership. The founder Supabase cutover is sufficiently established for continued engineering. The blocker is product regression and incomplete customer-facing acceptance across auth trust/branding, navigation/header readability, evidence-document reading, zoning clarity, Site Potential simplification, and the R999 human-assisted investigation journey.

## Active build process

Work is now split into small vertical slices with live acceptance gates:

1. Authentication
2. Header/navigation
3. Document reading
4. Zoning
5. Site Potential simplification
6. R999 human-assisted investigation flow

Broad restoration PR #113 was closed without merge and preserved only as a source for selective recovery.

## Auth stabilization evidence - 2026-08-25

- Active auth-only PR: #114, branch `chatgpt/auth-stabilization`.
- Head verified for this receipt: `8d65f91d90934d71ff1b6c97f39c1d39fad0ed9a`.
- Auth code adds a larger horizontal Easy Erf logo, forgot-password/reset flow, password visibility control, and explicit email-verification guidance after signup.
- Supabase Auth URL configuration was changed by the owner and independently evidenced by auth-service reloads at 2026-08-25 09:13:41 UTC and 09:13:59 UTC.
- Post-change Supabase OAuth traffic at 2026-08-25 09:18:05 UTC used `https://easyerf.co.za` as the referer instead of the previous `http://localhost:3000` fallback.
- GitHub Actions run `32831139208` completed successfully on the exact head above.
- Run `32831139208` verified: focused Guided tests, full Vitest suite (1,322 tests), founder OAuth transport, real-browser auth UI smoke, production bundle/routes, TypeScript, targeted ESLint, and patch whitespace.
- The real-browser auth smoke verifies the new logo presentation, forgot-password control, password show/hide control, signup verification guidance, and browser launch through founder Supabase to Google Accounts.
- Full human Google account-selection -> callback -> persistent production session on `easyerf.co.za` is still NOT VERIFIED and requires one live user attempt.
- The raw `xiqpfhsdlvwrwhclonsg.supabase.co` customer-facing OAuth hostname remains unresolved and is a separate auth-trust slice.
- PR #114 is not merged and the new auth-page UX is not production-published.

## Current next action

Obtain one fresh live human Google sign-in attempt on `easyerf.co.za`, then inspect Supabase Auth logs to verify the callback returns to the production origin and establishes a session. Do not merge/publish PR #114 until that acceptance evidence is reviewed and owner approval is given.

## Security state

- Never expose Supabase secret/service-role keys in browser code or chat.
- Customer-visible OAuth branding/domain must not rely on an unexplained raw Supabase hostname when a supported branded auth-domain approach is available.
- `SECURITY DEFINER` functions and auth/RLS changes require focused verification before acceptance.
- Password reset, signup confirmation and email templates must be tested as real flows, not only unit-tested.

## Spend

Additional discretionary spend: $0.

Lovable credits are not authorized for this restoration tranche unless the owner explicitly approves a specific use. Vercel is prohibited.

## Remaining UNKNOWN / unverified items

- Exact current production deployment configuration behind `easyerf.co.za`.
- Full live Google OAuth callback and persistent session after the 2026-08-25 Supabase URL configuration change.
- Supported zero-additional-cost path, if any, to replace the raw Supabase OAuth hostname with Easy Erf branding.
- Branded verification/reset email templates and sender configuration.
- Root cause/current live state of SG/paid-report document reading after the later Edge Function deployment.
- Current Stripe/payment wiring for the R999 human-investigation purchase path.
- End-to-end R999 order -> investigation -> human review -> saved report -> customer delivery acceptance.
