# Easy Erf Current State

Baseline entering Founder entitlement-history work: 2026-08-15, GitHub `main` at `9df0c1fa7ad6c5bf72684473272bffc040249e48` after merged PR #105.

## Current MVP objective

Make one real South African property investigation work extremely well end to end, with Erf 1570 as the acceptance property and Kouga / St Francis as the pilot geography. Easy Erf should show what is known, what is missing, how confident each conclusion is, what the numbers assume and one clear Next Best Step.

The product shell, account experience and operations tooling must support that investigation rather than becoming separate products.

## Canonical acceptance property

Erf 1570, Portion 0, LPI `C03400140000157000000`, parcel key `E108C034001400001570000000`, approximately 618.7 m2, Sea Vista, Kouga Local Municipality, Eastern Cape. These are acceptance inputs and source-backed test fixtures, not values to hard-code into generic logic.

## Canonical customer journey

1. Find or click a property.
2. Open read-only Property Overview / Property First Read with no investigation commit.
3. Explicitly begin or continue Guided Investigation.
4. Complete the ten-step Guided journey: Confirm property, Add address, Add SG diagram, Check title, Confirm zoning, Property checks, Market Evidence, Strategy & Calculators, Site Potential, Review report.
5. Guided Investigation, the expert Dossier and the Easy Erf Report consume the same canonical parcel, workspace, evidence, planning, Strategy and Site Potential state.
6. Ask Easy Erf remains grounded in the property evidence pack and report intelligence.
7. My Investigations reopens durable canonical investigation state rather than maintaining a separate dashboard progress engine.

## Capabilities present on current main

- Precision official erf/portion search and canonical parcel opening.
- Property Overview as the zero-commit selected-property entry.
- Versioned Guided Investigation with canonical task definitions and Next Best Step logic.
- Shared evidence/file vault patterns for SG diagrams, paid reports, title evidence and Site Potential assets.
- Evidence provenance, identity trust, contradictions, missing evidence and confidence states.
- Market Evidence, Strategy & Calculators, Site Potential and living Easy Erf Report integration.
- SG TIFF fast extraction path plus safe report preview when available.
- Shared planning confirmation across Guided Investigation, expert Dossier and Report.
- Planning Investigation Job V1 as the first real autonomous Easy Erf investigation job.
- Verified Kouga planning-source metadata for the municipality-wide 2021 Land Use Scheme and St Francis Bay town zoning plan without claiming parcel-level zoning proof.
- Founder-owned Site Potential worker/API/client transport foundations with rollback paths.
- Rollback-safe founder Supabase Google-auth bridge.
- Canonical Easy Erf design system and semantic styling guidance.
- Simplified primary information architecture: Find a Property, How It Works, Pricing; signed-in My Investigations and Account.
- Public-page and Pricing overhaul with no current subscription and no invented payment workflows.
- Durable My Investigations dashboard derived from canonical investigation state.
- Account experience with truthful identity, preferences, billing/access boundaries and admin-only Founder Operations entry.
- Founder Operations V1 with real report-order/provider operational visibility, shared admin navigation and separated developer diagnostics.
- Trusted Founder user support search/detail through a same-origin server boundary with existing `user_roles` admin authorization.
- One controlled Founder support write: grant exactly one complimentary Site Potential beta credit for a recorded support reason, with acting admin stored in the existing entitlement record.

## Recently completed significant work

- PR #86: fast SG TIFF extraction.
- PR #87: unified canonical investigation confirmation state.
- PR #88: canonical report evidence assembly and SG summary.
- PR #89: primary Easy Erf report experience.
- PR #90: portable Supabase migrations.
- PR #91: founder-owned Site Potential worker.
- PR #92: founder-owned signed-in Site Potential API.
- PR #93: rollback-safe founder Site Potential client transport.
- PR #94: rollback-safe founder Supabase Google auth bridge.
- PR #96: autonomous Planning Investigation V1.
- PR #98: verified Kouga planning source artifacts.
- PR #99: continuous Easy Erf design system and coherence guardrails.
- PR #100: public shell, retained public pages and truthful Pricing overhaul.
- PR #101: My Investigations dashboard rebuilt from durable canonical state.
- PR #102: Profile rebuilt as truthful Account while retaining compatible routing.
- PR #103: Founder Operations V1 replacing demo KPIs with real admin-readable operational data.
- PR #104: trusted cross-user Founder support reads for users, properties, evidence processing, Site Potential, entitlements, report orders and provider errors.
- PR #105: audited one-generation complimentary Site Potential grants through the existing beta-credit entitlement store.

## Current Founder Operations state

Founder Operations now extends the existing protected `/admin` architecture rather than running a parallel admin system.

Current operational capabilities:

- real report-order/provider overview
- provider readiness and public-data diagnostics separated from normal operations
- user search by email, name or exact user id
- bounded customer support detail
- durable saved-investigation position derived through `readSavedInvestigationProjection(...)`
- evidence-processing status without exposing storage paths or raw file contents
- Site Potential project/pack status
- purchased and beta Site Potential access
- report orders and recent provider errors
- one controlled entitlement action: grant exactly one complimentary Site Potential generation for a required support reason

The grant action uses the existing `site_potential_beta_credits` record, including `granted_by` and `reason`. It does not create another entitlement ledger and does not trigger Site Potential generation automatically.

The current follow-up tranche exposes the existing beta-credit grant records as visible intervention history, including actor, reason, granted/used/remaining credits, expiry and timestamp. This improves support auditability without adding another write surface or migration.

No refund, revoke, job retry, destructive repair or impersonation control is exposed.

## Design-system requirement

`docs/EASY_ERF_DESIGN_SYSTEM.md` is the lightweight canonical design reference. Every meaningful UI/product tranche must finish by checking whether it creates visual or terminology drift elsewhere.

Founder Operations may use denser tables, logs and operational status, but typography, semantic colors, card/control patterns, responsive behavior and terminology must still clearly belong to Easy Erf.

## Current weaknesses and blockers

- PR #95 remains intentionally gated because Google OAuth is not yet enabled and verified on the founder-owned Supabase project. Do not cut the frontend over until that external dependency is ready.
- The server address route still depends on production `GOOGLE_PLACES_API_KEY`, quota and runtime configuration.
- Site Potential depends on required deployment/runtime configuration and provider availability.
- Kouga planning sources are stronger, but Easy Erf still does not have a verified parcel-specific zoning adapter for the published St Francis Bay zoning plan.
- Founder Operations job retry or destructive support repairs still need an appropriate audited action model before controls are exposed.
- Financial/refund controls remain unavailable until a real payment-provider workflow supports them.
- Provider/public-source availability remains an external dependency. Missing evidence must remain visible rather than being filled with demo values.

## Systems to reuse

Reuse `NormalizedOfficialParcel`, `ErfWorkspaceState`, the Erf File Vault, `SavedMarketEvidence`, `ParcelPlanningAssessment`, `deriveInvestigationFacts`, `GUIDED_TASK_DEFINITIONS`, `canonicalReportAction`, `buildPropertyEvidencePack`, `ReportViewModel`, Strategy helpers, Site Potential resolution/snapshot helpers, `readSavedInvestigationProjection`, the existing `AdminGuard`, existing `user_roles` authorization, trusted server auth/service-role helpers and existing provider audit/readiness infrastructure.

Do not create parallel property facts, evidence ledgers, readiness engines, dashboard progress engines, admin-role systems or navigation selectors.

## Deliberately deferred

Broader cadastral/planning automation, additional municipalities, national coverage, stronger environmental datasets, richer development intelligence, monitoring, property passport, professional collaboration, transaction rooms, portfolio tools, marketplace/fulfilment, enterprise APIs and Earth-observation intelligence remain roadmap work unless a nearer MVP problem justifies pulling them forward.

## Recommended Next Best Project Action

Finish the entitlement intervention-history tranche through the full regression/build gate and merge only if green. After that, inspect the existing failed Site Potential retry path and only expose a Founder support retry if it can preserve ownership validation, retryability rules, generation-spend safety and a durable admin intervention audit. Keep refund/payment actions absent and keep PR #95 gated until founder Supabase Google OAuth is verified.
