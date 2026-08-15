# Easy Erf Current State

Baseline: 2026-08-15, GitHub `main` at `fcddd9eed8a0951e4d10c88eeaf8efb4da3c9b44` after merged PR #94.

## Current MVP objective

Make one real South African property investigation work end to end, with Erf 1570 as the acceptance property and Kouga / St Francis as the pilot geography. The product should show what is known, what is missing, how confident each conclusion is, what the numbers assume, and one clear next action.

## Canonical acceptance property

Erf 1570, Portion 0, LPI `C03400140000157000000`, parcel key `E108C034001400001570000000`, approximately 618.7 m2, Sea Vista, Kouga Local Municipality, Eastern Cape. These are acceptance inputs and source-backed test fixtures, not values to hard-code into generic logic.

## Current entry and investigation flow

1. Exact official search or official parcel selection opens the selected property through the canonical Workbench path.
2. The default destination is the read-only `PropertyFirstRead` / Property Overview. Opening it is intended to be zero-commit.
3. `Investigate this property` deliberately enters the Guided Investigation and records investigation state.
4. The current ten-step Guided order is: Confirm property, Add address, Add SG diagram, Check title, Confirm zoning, Property checks, Market evidence, Strategy & Calculators, Site Potential, Review report.
5. The existing expert Workbench still exposes Sources, Market, Paid Reports/Documents, Strategy, Site Potential, Notes and Easy Erf Report.

## Canonical shared-state contract

Property First Read, Guided Investigation, the expert Dossier and the Easy Erf Report are interfaces over the same canonical parcel, workspace, evidence, planning and Site Potential state. Property First Read remains zero-commit. An explicit user confirmation, such as a working zoning conclusion, is recorded once for the parcel and remains distinct from official or document-supported evidence everywhere it is shown.

## Capabilities present on current main

- Precision official erf/portion search, including direct canonical opening for exact official results.
- Property First Read driven by the selected parcel, recorded evidence, planning assessment, market evidence, Strategy state and Site Potential state.
- A versioned, parcel-scoped Guided Investigation with explicit completed, skipped, current and available states.
- A canonical Guided Task Registry and `canonicalReportAction` adapter used by report/action surfaces.
- Evidence/file storage patterns for SG diagrams, paid report PDFs and Site Potential assets, with provenance and identity-trust distinctions.
- Market Evidence, active/comparable listing flows and deterministic market summaries.
- Strategy Lab and deterministic calculators with saved scenarios and chosen-scenario report consumption.
- Site Potential planning/build-envelope assumptions and concept workflow, kept separate from official approval.
- Easy Erf Report view models, print foundation, decision intelligence, report action guidance and report change tracking. The primary reader flow opens with a canonical Property Summary, grounded Ask Easy Erf guidance, evidence-readiness decision framing, then identity, planning, site checks, market, Strategy and accepted Site Potential sections; deeper technical evidence remains expandable.
- Ask Easy Erf grounded in the canonical Property Evidence Pack/report intelligence, with answer confidence distinct from investigation readiness.
- Mobile Workbench navigation, saved workspace state, report uploads, SG multi-upload and the live map/search/parcel workflow.
- A server-side `/api/address/suggestions` route for Google autocomplete, place details and geocoding, with parcel-aware South African suggestions and visible failure states.
- Readable SG/title/paid documents preserved when automatic identity binding needs confirmation, with user-confirmed evidence kept distinct from official evidence.
- Paid-report purchase pathways for Lightstone and WinDeed, with external payment positioning and outbound-intent tracking.
- Kouga planning registry resolution and free Site Potential allowance handling for the Guided MVP path.
- A rollback-safe direct Supabase Google OAuth path exists behind `VITE_FOUNDER_SUPABASE_AUTH`; production remains on the current Lovable auth path until the founder Supabase Google provider is enabled and verified.

## Recently completed significant work

- PR #56, merged 2026-08-07: Erf 1570 guided-entry trust integrity, exact-entry hardening, evidence truthfulness, planning provenance and Ask confidence.
- PR #57, merged 2026-08-07: Strategy calculator core, property-derived inputs, deterministic development calculations and saved/chosen scenarios.
- PR #58, merged 2026-08-07: Site Potential workspace snapshot idempotence and render-loop repair.
- PR #59, merged 2026-08-08: precision official search confidence and accessible result markup.
- PR #60, merged 2026-08-08: actionable Living Report next step sourced from the Guided Task Registry.
- PR #61, merged 2026-08-08: Property First Read as the default zero-commit property entry.
- PR #62, merged 2026-08-08: Ask Easy Erf in Property Overview, grounded in the canonical evidence pack and canonical next action.
- PR #63, merged 2026-08-09: Erf 1570 MVP rescue, including atomic confirmation -> address progression, server address suggestions, document trust handling, paid-report purchase UX, Kouga resolution, Site Potential entitlement truthfulness and Strategy in Guided step 8.
- PR #86, merged 2026-08-13: canonical investigation and report integration baseline.
- PR #94, merged 2026-08-15: rollback-safe founder Supabase Google auth bridge with current production behavior unchanged by default.

## Current weaknesses and blockers

- Founder Supabase Google OAuth is not yet enabled, so PR #95 remains a gated frontend cutover rather than a production change.
- The server address route still depends on production `GOOGLE_PLACES_API_KEY`, quota and runtime configuration; code correctness alone does not prove live provider availability.
- Site Potential generation depends on the required deployment/runtime flags, worker secret, provider key and Supabase server configuration.
- Public-source and provider availability remain external dependencies. Missing or uncertain evidence must remain visible rather than being filled with demo values.
- Older documents and UI/history still contain PropertyAtlas/ErfStoep-era names and roadmap language; they are historical context unless current main and the Master Plan say otherwise.

## Systems to reuse

Reuse `NormalizedOfficialParcel`, `ErfWorkspaceState`, the Erf File Vault, `SavedMarketEvidence`, `ParcelPlanningAssessment`, `deriveInvestigationFacts`, `GUIDED_TASK_DEFINITIONS`, `canonicalReportAction`, `buildPropertyEvidencePack`, `ReportViewModel`, `StrategyLab`/calculator helpers, and Site Potential resolution/snapshot helpers. Do not create parallel property facts, evidence ledgers, readiness engines or navigation selectors.

## Deliberately deferred

Stronger cadastral retrieval, wider municipal/planning integrations, provider APIs, document-intelligence expansion, listing/comparable automation, environmental datasets, a robust deterministic build envelope, richer development/financial intelligence, risk scoring, property passport, monitoring, professional collaboration, transaction rooms, portfolio tools, marketplace/fulfilment, enterprise APIs, additional municipalities, national coverage, Earth-observation intelligence and international expansion remain roadmap work.

## Autonomous investigation state

Planning Investigation Job V1 is the first implementation tranche of Easy Erf's autonomous property-investigation direction. The job is derived from canonical planning state plus the property evidence graph and is first surfaced in the Guided zoning step. It reports sources reviewed, findings, confidence, contradictions, unresolved evidence and the next investigation.

No database schema change is required for V1. Manual working zoning still requires explicit confirmation, and published scheme rules remain distinct from property-specific rights. Dossier and Report continue consuming the same canonical planning assessment and evidence pack, so the job does not create a competing state store.

Canonical regression coverage uses Erf 1570, Portion 0, Sea Vista, Kouga. The implementation branch for PR #96 has passed focused tests, the full test suite, TypeScript, targeted ESLint, production build and whitespace checks.

### Real-source validation, 2026-08-15

Independent source validation against Kouga Municipality confirmed that the municipality currently publishes a Land Use Scheme adoption record, planning/development guidance, and a St Francis Bay town zoning plan in its document library. These are credible municipal planning sources that support Easy Erf's source-registry direction.

The validation also confirmed the important V1 limitation: Easy Erf does not yet have a verified parcel-specific adapter that correlates the published St Francis Bay zoning plan to the selected canonical parcel automatically. Therefore Planning Investigation V1 must continue to label configured/published scheme material separately from property-specific zoning proof and must not claim live parcel zoning detection.

The highest-value next planning automation after V1 is to test a narrow Kouga/St Francis property-specific planning-source adapter before attempting generic national browser automation.

See `docs/EASY_ERF_AGENT_JOBS_V1.md`.

## Recommended Next Best Project Action

Finish review of PR #96 and, once merged, validate the Planning Investigation panel in the signed-in Erf 1570 Guided zoning step. In parallel, keep PR #95 gated until founder Supabase Google OAuth is enabled. After the first planning-job UI smoke, prototype the cheapest credible Kouga/St Francis property-specific zoning-source correlation and measure whether it materially improves the investigation.
