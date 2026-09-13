# Founder Ops runtime connection repair

## Verified failure

On 2026-09-13 the Users & Investigators refresh sent an unexpired bearer token
issued by canonical project xiqpfhsdlvwrwhclonsg. The application returned 401
with "Sign in is required." The older Lovable Cloud authentication log at
09:14:31 UTC recorded the corresponding GET /user rejection: bad_jwt,
unrecognized signing key, ES256. The browser's hydrated state is not the cause.

## Repair

Founder support selects one server-only credential set for token validation,
the existing admin-role check, directory reads and onboarding. No backend URL
comes from browser input or JWT claims.

Optional explicit server configuration, all three required together:

- EASY_ERF_SUPABASE_URL: https://xiqpfhsdlvwrwhclonsg.supabase.co
- EASY_ERF_SUPABASE_PUBLISHABLE_KEY: canonical project's public key
- EASY_ERF_SUPABASE_SERVICE_ROLE_KEY: canonical project's server-only credential

With no explicit set, standard SUPABASE_* configuration is supported only for
the canonical project or an isolated loopback server. Partial explicit sets
never fall back to hosting-injected credentials. The retired project is rejected
before receiving a token, with a connection error rather than a false sign-in
instruction. Other shared server-auth callers retain their existing defaults.

## Remaining production boundary

Source tests do not complete the production repair. After independent review,
one combined owner approval is needed for merging the exact candidate, securely
setting the three server-only publisher values and publishing exact merged
source. Never put the service key in VITE_* variables, source, browser responses,
screenshots or receipts. Do not reconnect or modify the retired Cloud backend.

Verify the real authenticated directory refresh before consuming the existing
single-invitation authority. Then verify SMTP delivery, invite redirect, password
setup, investigator-only access, exact-order isolation and revocation. Stop on
identity/source mismatch, auth failure, ambiguous invitation or safety rejection.
No proven frontend-only rollback is implied. No paid AI, checkout, additional
order action, purchase or paid activation is included.

## Verification

Focused: 4 files / 33 tests passed, including real HTTP Auth and admin-role requests
against an isolated loopback fixture. Full suite: 160 files / 1628 tests passed
before the additional HTTP test; that added test passed in the focused rerun.
TypeScript, targeted lint and production build passed. Exact-head browser and CI
results are recorded on the repair PR. Synthetic tests cannot prove production delivery.
No invitation, role change, deployment or publication was performed in this repair.
