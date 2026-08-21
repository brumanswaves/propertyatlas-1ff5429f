# Easy Erf Founder Backend Cutover Evidence

Date: 2026-08-21

## Purpose

Record the evidence that cleared the prior Google OAuth gate and define what remains before a production cutover can be accepted.

## Verified evidence

- Canonical founder Supabase project: `xiqpfhsdlvwrwhclonsg` (`Easy Erf`).
- Project is accessible through the connected Supabase tooling.
- Public migrated data footprint is present, including saved investigations, evidence assets and Site Potential records.
- Auth contains two users and two Google identity records.
- A read-only OAuth initiation probe issued through the founder database reached the Google OAuth flow instead of returning `provider is not enabled`.
- Founder Site Potential/API Edge Functions are present.

## Not yet accepted

- Browser callback completion.
- Persisted browser session after Google sign-in.
- Full Erf 1570 investigation reopen and persistence on the founder backend.
- File Vault, planning, Strategy, Site Potential and Report behavior in one signed-in browser session.
- Founder Operations authorization. The founder backend currently has zero rows in `public.user_roles` with role `admin`.

## Cutover rule

The browser configuration may be prepared on a draft branch, but production publication remains gated on the signed-in Erf 1570 acceptance run. Repository tests and CI are supporting evidence only and do not replace that run.
