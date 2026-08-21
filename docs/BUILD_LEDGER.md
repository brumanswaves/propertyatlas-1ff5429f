# Easy Erf Build Ledger

## Original product promise

Make one real South African property investigation work extremely well end to end. Easy Erf should help a user find a property, organize trustworthy evidence, understand planning and development potential, test strategy and financial assumptions, identify unknowns and risks, and leave with one clear next action.

## Canonical systems

- Application code: GitHub `brumanswaves/propertyatlas-1ff5429f`, branch `main`.
- Product direction: `docs/EASY_ERF_MASTER_PLAN.md`.
- Current state: `docs/EASY_ERF_CURRENT_STATE.md`.
- Canonical remote backend: founder-owned Supabase project `xiqpfhsdlvwrwhclonsg` (`Easy Erf`).
- Local Supabase config: `supabase/config.toml` is local-stack configuration only and is not remote ownership proof.
- Lovable-managed backend: rollback/runtime infrastructure only during the controlled migration window.

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

Repository tests or build output alone do not satisfy this acceptance test.

## Governance and cost controls

- Proof is required before product-status claims are promoted to verified.
- Additional discretionary spend defaults to $0.
- Lovable build work requires explicit owner approval for that specific use.
- Prefer direct repository engineering and the founder-owned Supabase project.
- Preserve rollback paths for the backend cutover.
- Do not perform destructive production operations without a specific safety review and appropriate approval.

## Verified state as of 2026-08-21

- GitHub `main` is at merge commit `56743a30183c8963cd34cde32324769cb14d4ff9` after PR #108.
- The founder-owned Supabase project is accessible as `Easy Erf` and reports active status.
- The founder project contains the expected migrated public schema footprint, including saved investigations, evidence assets and Site Potential tables.
- The founder project contains two Auth users and two Google identity rows.
- A direct auth initiation probe issued from the founder Supabase database reached the Google OAuth flow, establishing that the prior `provider is not enabled` blocker is no longer current.
- Founder Site Potential/API functions are present on the founder project.
- `public.user_roles` currently contains zero admin rows. Founder Operations authorization on the founder backend is therefore not yet accepted.
- The browser runtime on `main` still points at the rollback backend. No production frontend cutover has been performed by this ledger update.

## Current blockers

1. Refresh the browser cutover from current `main`, verify CI, then perform a real signed-in Erf 1570 acceptance run before publication.
2. Founder Operations authorization on the founder backend needs an intentional admin-role decision and verification before that surface can be accepted.
3. Production/runtime provider configuration such as Google Places and Site Potential dependencies must be verified during the acceptance run rather than inferred from code.

## Current cutover work

Branch: `chatgpt/founder-backend-cutover-refresh`.

Purpose: refresh the browser backend target from current `main` after direct verification that Google OAuth now initiates successfully on the founder project. The branch keeps `supabase/config.toml` neutral and changes browser runtime configuration only.

## Spend

Known additional discretionary spend for the 2026-08-21 governance/cutover tranche: $0.

## Unverified claims requiring confirmation

- End-to-end Google sign-in callback and session persistence in the actual Easy Erf browser.
- Full signed-in Erf 1570 workflow on the founder backend.
- Founder Operations access on the founder backend.
- Production Site Potential generation through the browser cutover path.
- Final Report assembly against the founder backend in a real browser session.
