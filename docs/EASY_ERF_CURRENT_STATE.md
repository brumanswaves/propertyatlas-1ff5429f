# Easy Erf Current State

Baseline: 2026-08-13, GitHub `main` at `5a494001b3f5f9a680596d74a55b17b92c69d3c1` after merged PR #86.

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
- Easy Erf Report view models, print foundation, decision intelligence, report action guidance and report change tracking.
- Ask Easy Erf grounded in the canonical Property Evidence Pack/report intelligence, with answer confidence distinct from investigation readiness.
- Mobile Workbench navigation, saved workspace state, report uploads, SG multi-upload and the live map/search/parcel workflow.
- A server-side `/api/address/suggestions` route for Google autocomplete, place details and geocoding, with parcel-aware South African suggestions and visible failure states.
- Readable SG/title/paid documents preserved when automatic identity binding needs confirmation, with user-confirmed evidence kept distinct from official evidence.
- Paid-report purchase pathways for Lightstone and WinDeed, with external payment positioning and outbound-intent tracking.
- Kouga planning registry resolution and free Site Potential allowance handling for the Guided MVP path.

## Recently completed significant work

- PR #56, merged 2026-08-07: Erf 1570 guided-entry trust integrity, exact-entry hardening, evidence truthfulness, planning provenance and Ask confidence.
- PR #57, merged 2026-08-07: Strategy calculator core, property-derived inputs, deterministic development calculations and saved/chosen scenarios.
- PR #58, merged 2026-08-07: Site Potential workspace snapshot idempotence and render-loop repair.
- PR #59, merged 2026-08-08: precision official search confidence and accessible result markup.
- PR #60, merged 2026-08-08: actionable Living Report next step sourced from the Guided Task Registry.
- PR #61, merged 2026-08-08: Property First Read as the default zero-commit property entry.
- PR #62, merged 2026-08-08: Ask Easy Erf in Property Overview, grounded in the canonical evidence pack and canonical next action.
- PR #63, merged 2026-08-09: Erf 1570 MVP rescue, including atomic confirmation -> address progression, server address suggestions, document trust handling, paid-report purchase UX, Kouga resolution, Site Potential entitlement truthfulness and Strategy in Guided step 8.
- PR #86, merged 2026-08-13: the latest main baseline for the canonical investigation and report integration work.

## Current weaknesses and blockers

- The repository has strong automated coverage, but no local signed-in browser smoke command was available for the Erf 1570 journey.
- The server address route still depends on production `GOOGLE_PLACES_API_KEY`, quota and runtime configuration; code correctness alone does not prove live provider availability.
- Site Potential generation is code-complete only when the required deployment/runtime flags, worker secret, provider key and Supabase server configuration are present; those settings are not part of the repository.
- Public-source and provider availability remain external dependencies. Missing or uncertain evidence must remain visible rather than being filled with demo values.
- Older documents and UI/history still contain PropertyAtlas/ErfStoep-era names and roadmap language; they are historical context unless current main and the Master Plan say otherwise.

## Systems to reuse

Reuse `NormalizedOfficialParcel`, `ErfWorkspaceState`, the Erf File Vault, `SavedMarketEvidence`, `ParcelPlanningAssessment`, `deriveInvestigationFacts`, `GUIDED_TASK_DEFINITIONS`, `canonicalReportAction`, `buildPropertyEvidencePack`, `ReportViewModel`, `StrategyLab`/calculator helpers, and Site Potential resolution/snapshot helpers. Do not create parallel property facts, evidence ledgers, readiness engines or navigation selectors.

## Deliberately deferred

Stronger cadastral retrieval, wider municipal/planning integrations, provider APIs, document-intelligence expansion, listing/comparable automation, environmental datasets, a robust deterministic build envelope, richer development/financial intelligence, risk scoring, property passport, monitoring, professional collaboration, transaction rooms, portfolio tools, marketplace/fulfilment, enterprise APIs, additional municipalities, national coverage, Earth-observation intelligence and international expansion remain roadmap work.

## Recommended Next Best Project Action

Run one signed-in review-environment smoke from exact search through Report with the required Google Places and Site Potential runtime configuration, then fix only defects found in that canonical journey.

Why next: PR #63 has closed the known code-path failures and added the missing Strategy and address plumbing. A real signed-in smoke is now the highest-value check before expanding automation or adding new product surfaces.
