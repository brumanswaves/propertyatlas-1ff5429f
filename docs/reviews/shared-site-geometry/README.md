# Issue #193: shared Site Potential geometry

Source-only local receipt, 2026-09-25. Actor: Codex using Git, local Vitest/TypeScript/ESLint/Vite and isolated Playwright. Base: `c4e20d3e55b8ac81c48dc798c155219f8c42ae6d`. Branch: `codex/193-shared-site-geometry`. Exact delivery head is recorded in the draft PR.

## Root cause and change

Shared assembly reads the saved parcel ring only. A missing ring therefore left the map empty while planning assumptions still rendered. Shared Site Potential now makes one cancellable exact LPI/parcel-key query through the existing canonical public client, accepts only a single matching official feature with a valid ring, and holds it as unsaved candidate context. No erf-number fallback or automatic retries. Account/customer/order/parcel lifetimes reject stale responses.

The existing explicit Save site inputs operation includes ring, canonical normalized parcel and inputs in one revision-guarded patch. Exact order readback validates customer/order/parcel, increased revision, ring and public identity. Conflicts and mismatched readback fail closed. Opening the page makes no mutations. Existing valid geometry skips recovery. Missing geometry produces a compact unavailable panel and cannot be accepted. Legacy concepts_ready does not replace geometry, boundary/frontage review or the matching acceptance signature.

The free deterministic map now exposes selectable boundary buttons. Street-side build lines and assumption labels remain. The investigator dropdown starts with Property checks; checklist semantics are unchanged.

## Verification

- Focused unit tests: 4 files, 59 passed, including 16 new geometry tests.
- Full suite, run once: 173 files, 1,786 passed. See full-tests.log.
- TypeScript: passed (`npx tsc --noEmit`).
- Changed TypeScript ESLint semantic rules: passed with `prettier/prettier` disabled. The normal formatting-enabled invocation did not pass (3,193 formatting diagnostics across the existing changed files). No clean full-lint claim is made; broad reformatting was excluded from this focused patch. New helper/test and fixture files were Prettier formatted.
- `git diff --check`: passed.
- Normal `npm run build`, run once: passed. See build.log. Synthetic localhost Supabase configuration, outbound network guard, no deployment.
- Isolated browser: 12 passed, plus two baseline desktop/mobile captures. See results.json and before-results.json.

## Browser proof and limits

The fixture runs actual OrderInvestigationWorkspace, shared assembly/save client, SitePotentialTab, build-envelope and public-client code. Auth/RPC, public responses and unrelated panels are synthetic. Outbound requests are blocked; only the exact intercepted public GET is fulfilled locally. No production identity or data is loaded. Test parcels are synthetic Erf 9901/9902, not Erf 42 or a copy of Erf 1570.

| Case | Verified assertions |
| --- | --- |
| Exact recovery, desktop and mobile | One GET with exact LPI and limit 2; map and four selectable edges; zero mutations before interaction; accept disabled before confirmation; Property checks option |
| Explicit save/reload | One patch contains ring, normalized canonical identity and boundary/frontage inputs; expected revision 7 and synthetic owner A; exact-order readback; reload renders saved geometry without a second lookup |
| Explicit acceptance | Separate deliberate acceptance after saving two selected street edges and boundary confirmation; accepted signature and retained street-side diagram |
| Wrong/ambiguous/malformed | One lookup, no mutations, explicit unavailable state, no map |
| Failure/timeout | One lookup, no automatic retry, explicit unavailable state, no mutations |
| Existing ring | Zero recovery lookups and zero mutations |
| Revision conflict | Error and zero persisted mutations |
| Readback mismatch | Mutation recorded by fixture, missing ring on readback rejected; no false successful save |
| Delayed A-B-A | Three distinct lifetimes, stale map absent, final save bound to original synthetic owner/order/parcel |

Unit tests additionally cover identity-key matching, invalid rings, cancellation, and readback identity/revision mismatch; existing acceptance tests cover boundary/frontage and input-signature invalidation. Exact scripted assertions are in scripts/verify-shared-site-geometry.mjs.

This does not prove live ArcGIS availability/CORS, real Auth/RLS or production persistence, satellite imagery, municipal approval or the real Erf 1570 outcome. No Edge/backend change was attempted. Paid map tokens were absent. Existing release/read allowances remain untouched.

## Desktop and mobile evidence

| State | Desktop | Mobile |
| --- | --- | --- |
| Baseline main, missing ring | [Before](before-desktop.png) | [Before](before-mobile.png) |
| Recovered candidate, before save | [After](after-success-desktop.png) | [After](after-success-mobile.png) |
| Explicitly accepted synthetic envelope | [After](after-accepted-desktop.png) | [After](after-accepted-mobile.png) |
| Geometry unavailable | [After](after-failure-desktop.png) | [After](after-failure-mobile.png) |

Captures were visually inspected. The baseline uses archived base source with the same fixture. Screenshots depict isolated source behavior, not live acceptance.

## Reproduction

Use existing installed project dependencies. Start `node scripts/shared-site-geometry-preview.mjs`. Set EASY_ERF_PLAYWRIGHT_MODULE to the file URL of the installed Playwright module and EASY_ERF_CHROMIUM to its existing Chromium executable, then run `node scripts/verify-shared-site-geometry.mjs`. No installation is performed by these scripts. For baseline, archive base src and supabase/functions/_shared into a separate local directory, set GEOMETRY_SOURCE_ROOT to it and GEOMETRY_PORT=4194 for the preview, and GEOMETRY_BEFORE=1 plus the same port for verification.

Additional discretionary spend: $0. Provider processing, production reads/writes, reports, emails, migrations, releases, account/permission changes and deployment were not performed. Model/reasoning selections were not changed; their exact active labels were unavailable through the session interface.
