# Easy Erf Build Ledger

## Original product promise

Make one real South African property investigation work extremely well end to end. Easy Erf should help a user find a property, organize trustworthy evidence, understand planning and development potential, test strategy and financial assumptions, identify unknowns and risks, and leave with one clear next action.

## Canonical systems

- Application code: GitHub `brumanswaves/propertyatlas-1ff5429f`, branch `main`.
- Product direction: `docs/EASY_ERF_MASTER_PLAN.md`.
- Current state: `docs/EASY_ERF_CURRENT_STATE.md`.
- Canonical remote backend: founder-owned Supabase project `xiqpfhsdlvwrwhclonsg` (`Easy Erf`).
- Local Supabase config: `supabase/config.toml` is local-stack configuration only and is not remote ownership proof.
- Published EasyErf runtime: the existing Lovable-hosted production surface remains a rollback/runtime target during the controlled migration window. Lovable is not the engineering source of truth.

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

Repository tests, database rows or build output alone do not satisfy this acceptance test.

## Governance and cost controls

- Proof is required before product-status claims are promoted to verified.
- Additional discretionary spend defaults to $0.
- Lovable build work requires explicit owner approval for that specific use.
- Prefer direct repository engineering and the founder-owned Supabase project.
- Preserve rollback paths for the backend cutover.
- Do not perform destructive production operations without a specific safety review and appropriate approval.

## Verified state as of 2026-08-21

### GitHub and cutover branch

- GitHub `main` is at merge commit `56743a30183c8963cd34cde32324769cb14d4ff9` after PR #108.
- Fresh cutover branch: `chatgpt/founder-backend-cutover-refresh`.
- Draft PR #110 points the browser runtime at the founder Easy Erf backend while keeping `supabase/config.toml` neutral and local-only.
- The first PR #110 CI run failed because PR #108 still contained a stale guardrail requiring `VITE_FOUNDER_SUPABASE_AUTH=false` while OAuth was gated.
- Commit `33c6d86fe36fc2ac172a8b84dadb5ddb1817298b` replaced that stale condition with the evidence-based rule: founder auth may be enabled after verified OAuth initiation, while production publication remains gated on the signed-in Erf 1570 acceptance run.
- GitHub Actions run `32477387084` then completed successfully: focused Guided tests, full test suite, production build, TypeScript, targeted ESLint and whitespace verification all succeeded.
- Stale draft PR #95 was closed without merge after PR #110 superseded it.

### Founder Supabase backend

- The founder-owned Supabase project is accessible as `Easy Erf` and reports active status.
- The founder project contains the expected migrated public schema footprint, including saved investigations, evidence assets and Site Potential tables.
- The founder project contains two Auth users and two Google identity rows.
- A direct auth initiation probe issued from the founder Supabase database reached the Google OAuth flow, establishing that the prior `provider is not enabled` blocker is no longer current.
- Founder Site Potential/API functions are present on the founder project.
- Canonical Erf 1570 is persisted under parcel id `csg:lpi:c03400140000157000000`.
- Erf 1570 currently has 2 saved-property rows across 2 pilot users, 1 property-notes row, 25 evidence asset rows, 2 Site Potential project rows and 3 completed design-pack rows.
- Both pilot users with a saved Erf 1570 record also have persisted assets, a Site Potential project, a selected design and at least one fully completed design pack.
- The three completed design packs total 12 requested designs and 12 completed designs.
- All 25 Erf 1570 asset rows have storage pointers and all 25 pointers resolve to actual Supabase Storage objects. No missing storage object was found in this check.
- RLS policies on the checked investigation, evidence and Site Potential tables constrain authenticated user data by `auth.uid() = user_id`.
- `public.user_roles` currently contains zero admin rows. Founder Operations authorization on the founder backend is therefore not yet accepted.

### Security review

- Supabase security advisors currently warn that `public.has_role` and `public.patch_saved_property_user_data` are authenticated-callable `SECURITY DEFINER` functions, and that leaked-password protection is disabled.
- `patch_saved_property_user_data` was independently inspected. It derives its acting user from `auth.uid()`, rejects unauthenticated calls and reads/writes only rows matching that user id. The generic advisor warning does not by itself establish a cross-user write vulnerability.
- `has_role` was independently inspected. It is callable by authenticated users and accepts an arbitrary user id, so role-presence probing is a real hardening opportunity even though no admin rows currently exist. It is not being changed during the MVP cutover tranche without a focused authorization-impact review.

### Published runtime

- Read-only inspection of the published EasyErf Lovable project shows it is synced through GitHub merge commit `56743a30183c8963cd34cde32324769cb14d4ff9` (#108).
- The published runtime configuration still targets the rollback Supabase backend and has founder auth disabled.
- Therefore the published runtime does not yet prove the founder-backend cutover or the signed-in Erf 1570 acceptance test.
- The connected Vercel account contains no projects, so there is no existing Vercel preview environment to use for this cutover.

## Current blocker

The code and founder backend are far enough along to attempt the actual signed-in vertical slice, but there is no existing deployed preview of PR #110. The published runtime remains on the rollback backend. A real founder-backend browser acceptance run therefore requires a safe cutover preview or publication path. Lovable build/deploy actions require explicit owner approval under the project governance rules, and no such approval has been assumed.

## Next action

Exercise PR #110 in a real browser against the founder backend using the cheapest safe preview path that the owner explicitly authorizes, then verify Google callback/session persistence and the full Erf 1570 journey before considering merge/publication.

## Owner action required

Only if the owner wants to use Lovable for the preview: explicit approval is required for that specific Lovable preview/deploy action. No approval is required for continued read-only inspection, GitHub engineering, CI or Supabase verification.

Separately, Founder Operations requires an intentional decision about which authenticated user should receive the first `admin` role before that admin surface can be accepted. No role has been granted autonomously.

## Spend

Known additional discretionary spend for the 2026-08-21 governance/cutover tranche: $0.

## Unverified claims requiring confirmation

- End-to-end Google sign-in callback and session persistence in a browser configured for the founder backend.
- Full signed-in Erf 1570 workflow on the founder backend.
- Founder Operations access on the founder backend.
- Production Site Potential generation through the browser cutover path.
- Final Report assembly against the founder backend in a real browser session.
