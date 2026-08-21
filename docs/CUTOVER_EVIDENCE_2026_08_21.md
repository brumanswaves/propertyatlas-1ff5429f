# Easy Erf Founder Backend Cutover Evidence

Date: 2026-08-21

## Purpose

Record the evidence that cleared the prior Google OAuth gate and define what remains before a production cutover can be accepted.

## Verified evidence

### Founder backend

- Canonical founder Supabase project: `xiqpfhsdlvwrwhclonsg` (`Easy Erf`).
- Project is accessible through the connected Supabase tooling.
- Public migrated data footprint is present, including saved investigations, evidence assets and Site Potential records.
- Auth contains two users and two Google identity records.
- Both founder Auth users have a non-null historical `last_sign_in_at`; the latest recorded completed sign-in was 2026-08-10 15:50:09 UTC.
- A read-only OAuth initiation probe issued through the founder database reached the Google OAuth flow instead of returning `provider is not enabled`.
- Founder Site Potential/API Edge Functions are present.

### Branch integration

- Draft PR #110 uses the founder Supabase browser configuration and enables founder auth and Site Potential Edge transport.
- GitHub Actions run `32478020948` on head `8f09471c168ebeff40d795c7dde7af94f1ee87db` completed successfully.
- That run used the branch's installed `@supabase/supabase-js` client to initiate Google OAuth against the configured founder project, then verified the founder Supabase authorize endpoint redirected to `accounts.google.com`.
- The same run also completed the focused Guided tests, full test suite, production build, TypeScript check, targeted ESLint and whitespace check.

### Canonical Erf 1570 persistence

- Canonical parcel id on the founder backend: `csg:lpi:c03400140000157000000`.
- There are two saved-property rows across two pilot users.
- Both saved-property rows contain persisted Market Evidence and Strategy workspace state.
- Both Strategy workspaces contain a scenario and a chosen scenario id.
- There are 25 Erf 1570 evidence asset rows, and all 25 storage pointers resolve to actual Supabase Storage objects.
- There are two Site Potential project rows and three completed design-pack rows across the two pilot users.
- The completed design packs total 12 requested designs and 12 completed designs.
- Both pilot users with a saved Erf 1570 record have persisted assets, a Site Potential project, a selected design and at least one completed design pack.

### Current published runtime

- Read-only inspection of the published EasyErf project shows it remains synced to merge commit `56743a30183c8963cd34cde32324769cb14d4ff9` (#108).
- Its runtime still targets the rollback Supabase backend and founder auth remains disabled there.
- The connected Vercel account contains no existing project that can serve as a cutover preview.
- Repository inspection found no existing Vercel, Netlify, Cloudflare/Wrangler or Firebase deployment configuration.

## Not yet accepted

- Current PR #110 browser callback completion after Google consent.
- Persisted browser session after the current cutover callback.
- Full Erf 1570 investigation reopen and persistence through a browser configured for the founder backend.
- File Vault, planning, Strategy, Site Potential and Report behavior in one signed-in founder-backend browser session.
- Founder Operations authorization. The founder backend currently has zero rows in `public.user_roles` with role `admin`.
- Final Report browser assembly on the founder backend. `report_orders` currently has no Erf 1570 rows, which does not by itself establish whether the in-app final report assembly is functioning or not.

## Cutover rule

The browser configuration may remain prepared on a draft branch, but production publication remains gated on the signed-in Erf 1570 acceptance run. Repository tests, CI, database rows and OAuth initiation evidence are supporting evidence only and do not replace that browser acceptance run.

## Spend

Known additional discretionary spend for this verification tranche: $0. No Lovable build/deploy action, new hosting project, migration, role grant or production publish was performed.
