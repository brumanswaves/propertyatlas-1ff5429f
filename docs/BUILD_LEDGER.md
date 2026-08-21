# Easy Erf Build Ledger

## Original product promise

Make one real South African property investigation work extremely well end to end. Easy Erf should help a user find a property, organize trustworthy evidence, understand planning and development potential, test strategy and financial assumptions, identify unknowns and risks, and leave with one clear next action.

## Canonical systems

- Application code: GitHub `brumanswaves/propertyatlas-1ff5429f`, branch `main`.
- Product direction: `docs/EASY_ERF_MASTER_PLAN.md`.
- Current state: `docs/EASY_ERF_CURRENT_STATE.md`.
- Canonical remote backend: founder-owned Supabase project `xiqpfhsdlvwrwhclonsg` (`Easy Erf`).
- Local Supabase config: `supabase/config.toml` is local-stack configuration only and is not remote ownership proof.
- Published runtime: existing EasyErf Lovable-hosted production surface remains a rollback/runtime target during the controlled migration window. Lovable is not the engineering source of truth.

## MVP acceptance property

Erf 1570, Portion 0, LPI `C03400140000157000000`, parcel key `E108C034001400001570000000`, approximately 618.7 m2, Sea Vista, Kouga Local Municipality, Eastern Cape.

## Current MVP acceptance test

A signed-in user must be able to complete and later reopen the canonical Erf 1570 investigation against the founder-owned backend, including:

1. Google sign-in and persisted session.
2. Search/open Erf 1570 and durable investigation reopen.
3. Address state and visible provider errors.
4. SG/File Vault read and evidence extraction state.
5. Shared zoning confirmation and Planning Investigation output.
6. Market Evidence and Strategy persistence.
7. Site Potential entitlement/status, accepted concept and deterministic envelope state.
8. Final Report assembly with previews, provenance, unknowns and canonical next action.

Repository tests, database rows, build output and OAuth initiation alone do not satisfy this acceptance test.

## Governance and cost controls

- Proof is required before product-status claims are promoted to verified.
- Additional discretionary spend defaults to $0.
- Lovable build/deploy work requires explicit owner approval for that specific use.
- Prefer direct repository engineering and the founder-owned Supabase project.
- Preserve rollback paths for the backend cutover.
- Do not perform destructive production operations without a specific safety review and appropriate approval.

## Verified state as of 2026-08-21

### GitHub and cutover branch

- GitHub `main` is at merge commit `56743a30183c8963cd34cde32324769cb14d4ff9` after PR #108.
- Fresh cutover branch: `chatgpt/founder-backend-cutover-refresh`.
- Draft PR #110 points browser runtime configuration at the founder Easy Erf backend while keeping `supabase/config.toml` neutral and local-only.
- The first #110 CI run failed because PR #108 still contained a stale guardrail requiring founder auth to remain off while OAuth was previously gated.
- Commit `33c6d86fe36fc2ac172a8b84dadb5ddb1817298b` replaced that stale condition with the evidence-based rule that founder auth may be enabled after verified OAuth initiation while publication remains gated on the signed-in Erf 1570 browser acceptance run.
- Stale draft PR #95 was closed without merge after PR #110 superseded it.
- `scripts/verify-founder-oauth.mjs` now exercises the branch's actual `@supabase/supabase-js` auth transport against the configured founder backend.
- GitHub Actions run `32478020948` on head `8f09471c168ebeff40d795c7dde7af94f1ee87db` completed successfully. The live OAuth transport step verified founder Supabase redirected the Google authorization request to `accounts.google.com`. Focused Guided tests, full tests, production build, TypeScript, targeted ESLint and whitespace verification also completed successfully in that run.

### Founder Supabase backend

- The founder-owned Supabase project is accessible as `Easy Erf` and reports active status.
- The expected migrated public schema footprint is present, including saved investigations, evidence assets and Site Potential tables.
- Auth contains two users and two Google identity rows.
- Both users have a non-null historical `last_sign_in_at`; the latest recorded completed sign-in was 2026-08-10 15:50:09 UTC.
- A direct auth initiation probe issued from the founder database reached the Google OAuth flow, establishing that the old `provider is not enabled` blocker is no longer current.
- Founder Site Potential/API functions are present.
- Canonical Erf 1570 is persisted under parcel id `csg:lpi:c03400140000157000000`.
- Erf 1570 has 2 saved-property rows across 2 pilot users, 1 property-notes row, 25 evidence asset rows, 2 Site Potential project rows and 3 completed design-pack rows.
- Both saved-property rows contain persisted Market Evidence and Strategy workspace state. Both Strategy workspaces contain a scenario and a chosen scenario id.
- Both pilot users with a saved Erf 1570 record also have persisted assets, a Site Potential project, a selected design and at least one fully completed design pack.
- The three completed design packs total 12 requested designs and 12 completed designs.
- All 25 Erf 1570 asset rows have storage pointers and all 25 pointers resolve to actual Supabase Storage objects. No missing storage object was found.
- RLS policies on the checked investigation, evidence and Site Potential tables constrain authenticated user data by `auth.uid() = user_id`.
- `public.user_roles` currently contains zero admin rows. Founder Operations authorization on the founder backend is therefore not yet accepted.
- `report_orders` currently contains zero Erf 1570 rows. This does not by itself establish whether the in-app final Report assembly works because the product may assemble that report from investigation state rather than a paid report-order row.

### Security review

- Supabase security advisors warn that `public.has_role` and `public.patch_saved_property_user_data` are authenticated-callable `SECURITY DEFINER` functions and that leaked-password protection is disabled.
- `patch_saved_property_user_data` was independently inspected. It derives its acting user from `auth.uid()`, rejects unauthenticated calls and reads/writes only rows matching that user id. The generic advisor warning does not by itself establish a cross-user write vulnerability.
- `has_role` was independently inspected. It accepts an arbitrary user id while callable by authenticated users, so role-presence probing is a hardening opportunity even though no admin rows currently exist. It is not being changed during the MVP cutover tranche without a focused authorization-impact review.

### Published runtime and deployment paths

- Read-only inspection of the published EasyErf project shows it is synced through GitHub merge commit `56743a30183c8963cd34cde32324769cb14d4ff9` (#108).
- The published runtime still targets the rollback Supabase backend and has founder auth disabled.
- Therefore the live site does not prove the founder-backend cutover or the signed-in Erf 1570 acceptance test.
- The connected Vercel account contains no projects.
- Repository inspection found no existing Vercel, Netlify, Cloudflare/Wrangler or Firebase deployment configuration.

## Current blocker

The branch and founder backend now have strong automated and integration evidence, but there is no deployed preview of PR #110. The current published site remains on the rollback backend. The remaining MVP acceptance gate requires a real browser configured for the founder backend to complete Google callback/session persistence and the full signed-in Erf 1570 journey.

A Lovable preview/build/deploy action could provide that surface, but the exact credit impact is currently unknown. Under the project governance rules, no such action will be invoked without specific owner approval and a safe spend boundary.

## Next action

Use the cheapest safe deployed preview path for PR #110, then perform the signed-in Erf 1570 browser acceptance run. Merge or production publication should be considered only after that evidence exists.

## Owner action required

If Lovable is selected as the preview path, explicit approval is required for that specific Lovable use. The approval should not authorize buying credits or incurring a new charge unless a defined spend cap is separately approved.

Separately, Founder Operations requires an intentional decision about which authenticated user should receive the first `admin` role before that surface can be accepted. No role has been granted autonomously.

## Spend

Known additional discretionary spend for the 2026-08-21 governance/cutover tranche: $0.

- No Lovable build/deploy action was invoked.
- No new hosting project was created.
- No production publish was performed.
- No migration, destructive database write or admin-role grant was performed.
- GitHub Actions verification used the public repository's standard hosted workflow path.

## Unverified claims requiring confirmation

- Current PR #110 end-to-end Google callback and persisted browser session.
- Full signed-in Erf 1570 workflow on the founder backend.
- Planning confirmation persistence through the founder-backend browser path.
- Founder Operations access on the founder backend.
- Production Site Potential generation through the browser cutover path.
- Final Report assembly against the founder backend in a real browser session.
