# Easy Erf Current State

Baseline: 2026-08-09, GitHub `main` at `18d353d6e1fef53887be4625751ffa91e7a661dc` after merged PR #62.

## Current MVP objective

Make one real South African property investigation work end to end, with Erf 1570 as the acceptance property and Kouga / St Francis as the pilot geography. The product should show what is known, what is missing, how confident each conclusion is, what the numbers assume, and one clear next action.

## Canonical acceptance property

Erf 1570, Portion 0, LPI `C03400140000157000000`, parcel key `E108C034001400001570000000`, approximately 618.7 m2, Sea Vista, Kouga Local Municipality, Eastern Cape. These are acceptance inputs and source-backed test fixtures, not values to hard-code into generic logic.

## Current entry and investigation flow

1. Exact official search or official parcel selection opens the selected property through the canonical Workbench path.
2. The default destination is the read-only `PropertyFirstRead` / Property Overview. Opening it is intended to be zero-commit.
3. `Investigate this property` deliberately enters the Guided Investigation and records investigation state.
4. The current nine-step Guided order is: Confirm property, Add address, Add SG diagram, Check title, Confirm zoning, Property checks, Site Potential, Market evidence, Review report.
5. The existing expert Workbench still exposes Sources, Market, Paid Reports/Documents, Strategy, Site Potential, Notes and Easy Erf Report.

The current Guided journey does not yet include Strategy as its own step, although the canonical task registry and expert Strategy workspace already exist. This is the main flow gap before the next tranche.

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

## Recently completed significant work

- PR #56, merged 2026-08-07: Erf 1570 guided-entry trust integrity, exact-entry hardening, evidence truthfulness, planning provenance and Ask confidence.
- PR #57, merged 2026-08-07: Strategy calculator core, property-derived inputs, deterministic development calculations and saved/chosen scenarios.
- PR #58, merged 2026-08-07: Site Potential workspace snapshot idempotence and render-loop repair.
- PR #59, merged 2026-08-08: precision official search confidence and accessible result markup.
- PR #60, merged 2026-08-08: actionable Living Report next step sourced from the Guided Task Registry.
- PR #61, merged 2026-08-08: Property First Read as the default zero-commit property entry.
- PR #62, merged 2026-08-08: Ask Easy Erf in Property Overview, grounded in the canonical evidence pack and canonical next action.

## Current weaknesses and blockers

- Strategy is available in the expert workspace and in the task registry, but is not yet a first-class step in the nine-step Guided journey.
- Address autocomplete and geocoding currently depend on the browser-side `VITE_GOOGLE_MAPS_API_KEY`; production configuration and a safer server path need to be resolved before calling this flow complete.
- The repository has strong automated coverage, but no local signed-in browser smoke command was available for the Erf 1570 journey.
- Site Potential generation is code-complete only when the required deployment/runtime flags, worker secret, provider key and Supabase server configuration are present; those settings are not part of the repository.
- Public-source and provider availability remain external dependencies. Missing or uncertain evidence must remain visible rather than being filled with demo values.
- Older documents and UI/history still contain PropertyAtlas/ErfStoep-era names and roadmap language; they are historical context unless current main and the Master Plan say otherwise.

## Systems to reuse

Reuse `NormalizedOfficialParcel`, `ErfWorkspaceState`, the Erf File Vault, `SavedMarketEvidence`, `ParcelPlanningAssessment`, `deriveInvestigationFacts`, `GUIDED_TASK_DEFINITIONS`, `canonicalReportAction`, `buildPropertyEvidencePack`, `ReportViewModel`, `StrategyLab`/calculator helpers, and Site Potential resolution/snapshot helpers. Do not create parallel property facts, evidence ledgers, readiness engines or navigation selectors.

## Deliberately deferred

Stronger cadastral retrieval, wider municipal/planning integrations, provider APIs, document-intelligence expansion, listing/comparable automation, environmental datasets, a robust deterministic build envelope, richer development/financial intelligence, risk scoring, property passport, monitoring, professional collaboration, transaction rooms, portfolio tools, marketplace/fulfilment, enterprise APIs, additional municipalities, national coverage, Earth-observation intelligence and international expansion remain roadmap work.

## Recommended Next Best Project Action

Complete the Erf 1570 Guided journey integration tranche: add Strategy & Calculators as the deliberate next Guided step, then run one signed-in review-environment smoke from exact search through Report with the required runtime configuration.

Why next: the current main already has the evidence, canonical action, Strategy and Site Potential foundations. The largest remaining product inconsistency is that the Guided journey omits Strategy even though the report/task system can reason about it. A real signed-in smoke is the fastest way to validate the integrated path before expanding automation or adding new product surfaces.

Pending candidate: draft PR #63 contains rescue work beyond this `main` baseline. It is not treated as merged capability here and must be reviewed against this state before any merge decision.
