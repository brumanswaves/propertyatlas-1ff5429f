# Easy Erf Current State

Baseline entering Founder Operations V1: 2026-08-15, GitHub `main` at `c21115ed99a02a1f971e93f46ae1392529271369` after merged PR #102.

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

## Current Founder Operations tranche

The existing protected `/admin` architecture is being evolved into **Easy Erf Founder Operations** rather than creating a second admin system.

Founder Operations V1 is deliberately read-first. It uses operational data the existing admin role can already read safely:

- report orders
- provider audit activity
- provider settings/health
- existing provider readiness diagnostics
- existing public-data diagnostics

The old demo KPIs such as indexed demo-property counts are not valid founder metrics and are being removed.

Cross-user investigation records, evidence, Site Potential jobs, entitlement adjustments, refunds and repair actions are not being exposed through a browser-side privilege bypass. Those need a trusted support boundary with admin authorization, least privilege and an audit trail before they become operational controls.

## Design-system requirement

`docs/EASY_ERF_DESIGN_SYSTEM.md` is the lightweight canonical design reference. Every meaningful UI/product tranche must finish by checking whether it creates visual or terminology drift elsewhere.

Founder Operations may use denser tables, logs and operational status, but typography, semantic colors, card/control patterns, responsive behavior and terminology must still clearly belong to Easy Erf.

## Current weaknesses and blockers

- PR #95 remains intentionally gated because Google OAuth is not yet enabled and verified on the founder-owned Supabase project. Do not cut the frontend over until that external dependency is ready.
- The server address route still depends on production `GOOGLE_PLACES_API_KEY`, quota and runtime configuration.
- Site Potential depends on required deployment/runtime configuration and provider availability.
- Kouga planning sources are stronger, but Easy Erf still does not have a verified parcel-specific zoning adapter for the published St Francis Bay zoning plan.
- Founder Operations does not yet have a trusted cross-user support API for investigations, assets, Site Potential jobs, entitlements or audited interventions.
- Provider/public-source availability remains an external dependency. Missing evidence must remain visible rather than being filled with demo values.

## Systems to reuse

Reuse `NormalizedOfficialParcel`, `ErfWorkspaceState`, the Erf File Vault, `SavedMarketEvidence`, `ParcelPlanningAssessment`, `deriveInvestigationFacts`, `GUIDED_TASK_DEFINITIONS`, `canonicalReportAction`, `buildPropertyEvidencePack`, `ReportViewModel`, Strategy helpers, Site Potential resolution/snapshot helpers, the existing `AdminGuard`, existing `user_roles` authorization and existing provider audit/readiness infrastructure.

Do not create parallel property facts, evidence ledgers, readiness engines, dashboard progress engines, admin-role systems or navigation selectors.

## Deliberately deferred

Broader cadastral/planning automation, additional municipalities, national coverage, stronger environmental datasets, richer development intelligence, monitoring, property passport, professional collaboration, transaction rooms, portfolio tools, marketplace/fulfilment, enterprise APIs and Earth-observation intelligence remain roadmap work unless a nearer MVP problem justifies pulling them forward.

## Recommended Next Best Project Action

Finish Founder Operations V1, run the full regression/build gate and merge if green. Then build the narrow trusted support boundary needed for cross-user investigation visibility and audited support actions, while keeping PR #95 gated until founder Supabase Google OAuth is verified.
