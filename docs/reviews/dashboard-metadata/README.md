# Issue 191: metadata-only My Properties

Source tested: **877ceafc97afa084309133182fd3deb5f3ce4242**. Base: `a28db850cf07b30f3192f235af41b79557eefdc8`.
Application tree: `a150c08d33b65a0bc6364dcb9996ab1dd3e7adcb`; fixture/scripts tree: `cf1128546a4cf413822e51d610dae1d5bfaa47bf`.
Later documentation/evidence commits do not change these tested trees. Exact review head is recorded on the draft PR.

## What changed

The dashboard previously selected complete `user_data` for every saved property. [Baseline response](baseline.json) from the actual unchanged dashboard at the base returned nine bodies containing synthetic document, report, Market-note and unrelated sentinels. The initial fixture was uncommitted at reproduction time; this is not attributed to a frozen fixture commit.

The new reader selects owner/parcel identity, created timestamp, 13 display/navigation scalar leaves and 13 canonical progress scalar leaves. It never selects the whole JSON, a whole investigation, raw Market arrays, report/document bodies, research queries or note text. Notes remain owner/parcel/timestamp only. The exact builder SELECT and returned contents are retained in [25 browser cases](results.json). Installed `@supabase/supabase-js` was **2.116.0**, using existing dependencies, no new installation or lockfile change.

Account-filtered pages use deterministic timestamp/parcel ordering and exact counts. Changed or missing counts, empty incomplete pages, malformed data, duplicate identities and owner/projection mismatches fail visibly. Reads are bounded to ten pages of up to 100 rows per table. Server caps are followed using the number actually returned. A partial list is explicitly labelled, with totals/activity unavailable and retry. It is not presented as a complete account. Offset pagination is not a transaction snapshot; count changes and duplicate identities are rejected, but same-count concurrent changes are not claimed detectable.

Each resolved account owns a freshly mounted dashboard. Account/loading/sign-out transitions drop display access immediately, abort old reads and reject late continuations, including A to B to A. Failed parallel reads abort their sibling. Existing removal confirmation and owner/parcel filters remain; late removal UI acknowledgements are suppressed after unmount. No real removal was performed.

## Deliberate UI adaptations

- Property ordering, identity/address/erf/portion context and existing map/report/investigation navigation remain. Portion zero and explicit false/zero progress metadata are preserved.
- Missing/unsupported metadata shows **Status unavailable**, not false, zero, no evidence or a fabricated first step. Because null JSON timestamp leaves do not distinguish missing from explicitly null, a missing start timestamp is unknown and uses **Start / Continue Investigation**.
- The list uses saved cloud metadata only, explicitly labelled. It does not read or reconstruct browser workspace bodies to fill missing summaries. The dashboard explains unsaved browser drafts may be newer. All account-scoped drafts remain untouched by list reads.
- Market counts, price averages, primary listing notes/source and listing activity are removed from the bulk list. They are not invented from flags. Every property has **Open Market evidence**, using the existing `listings` tab and exact selected parcel. The canonical Market calculator is unchanged.
- Open Report remains the existing mutable property report action, never labelled delivered/frozen. Report source and Ask-at-top design are untouched.

## Verification

[Matrix](MATRIX.md), [commands and exit codes](commands.json), [full regression log](full-regression.txt), [configured build](configured-build.txt).

**25 Chromium cases passed**, zero external requests and zero mutations. Actual dashboard, customer workspace shell and installed Supabase request builder are mounted. Synthetic owner A has nine properties, B has a distinct record. Every list-only case stores before/after record and draft hashes. Recorded response bodies contain no forbidden body sentinel or array. Narrow note responses exclude synthetic private notes. Cases include genuine empty, missing metadata, failure/retry, malformed/duplicate/mismatched responses, page caps/partial state, account switching, delayed A-B-A, sign-out during a pending read, loading transitions and cancelled removal.

Desktop/mobile and keyboard navigation reach exact property links. First selected-property body request retains both owner and parcel filters and returns one body. Returning to the list resumes scalar-only reads. [Investigation](navigation-investigation.json), [report](navigation-stoep-report.json), [Market](navigation-listings.json), [keyboard](navigation-keyboard.json) include explicit synthetic selected-body evidence. No live data is present.

**Limits:** Auth and fetch responses are simulated; a generic request-driven projection emulator applies only the SELECT/filter/range actually sent and does not repair the query. This verifies installed client request construction, not a real PostgREST server or production RLS. Map rendering and heavy property panels are stubs; real map route/selection owner/WorkspaceCloudSync execute for the first detail request. Router plumbing is simplified. Browser history returns to the list URL and the fixture reloads to remount the actual dashboard. This is not full SPA Back/Forward or detailed report/Market rendering acceptance. Top navigation/footer/staff links are omitted from the fixture. No provider or real email/payment path is exercised.

Full regression ran once for this source: **172 files / 1770 tests, exit 0**. Normal configured build with original tracked configuration and default Cloudflare module target: **exit 0**. External Node fetch/http/https/net/tls blocked and probe verified. TypeScript: **exit 0**. Changed-source lint: **exit 0**. The first isolated lint attempt failed exclusively on CRLF endings introduced by Windows export; the four files matched Git blobs after newline normalization, were replaced by exact committed LF blobs, and only lint was repeated. No application source repair or broad test rerun followed. Whitespace check passed. Local build artifacts are not deployment.

[Desktop](desktop-viewport.png), [mobile](mobile-viewport.png), [full desktop](desktop.png), [full mobile](mobile.png). Viewport and full screenshots were visually inspected. Unaffected PR190 workspace and PR189 export evidence is reused only with its original source/runtime attribution.

## Reproduce without production

From this source with existing dependencies: run `node scripts/dashboard-metadata-preview.mjs`, then `node scripts/verify-dashboard-metadata.mjs`. Local fixture: `http://127.0.0.1:4191/scripts/fixtures/dashboard-metadata/index.html`. Browser binary/modules use existing rehearsal defaults or the documented environment overrides in the verifier. The fixture uses synthetic Auth/transport, no production configuration. External browser requests are blocked and counted; server imports the existing network guard. Do not use the production dashboard for these checks.

Focused unit command: `node --import ./scripts/verify-shared-investigation-network.mjs node_modules/vitest/vitest.mjs run src/lib/workbench/__tests__/dashboardMetadata.test.ts src/lib/__tests__/myInvestigationsGuardrails.test.ts src/components/property/__tests__/dossierUx.test.ts` (50 tests passed before the final read-failure sibling cancellation adjustment; the full final run covers it).

## Boundary and next actor

Model verified from task metadata: gpt-6-astra, low reasoning, unchanged. Sole writer. Source-only draft PR for independent review. No backend/schema/permissions/account/report change, production access, merge, publication, rollback, provider call, paid CI, email or Vercel. Existing unrelated checkout files and release/rehearsal artifacts are preserved. Additional discretionary spend initiated: **$0**, existing tool allowance; account credit metering UNKNOWN. PR190's $10 release allowance was not reused. Independent reviewer is next; any future release needs a separate exact-candidate decision.
