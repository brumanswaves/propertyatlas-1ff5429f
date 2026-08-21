# Easy Erf Controlled Idea Backlog

This is an ordered inventory of future ideas, not a replacement for the Master Plan. Roadmap placement can change only through an explicit product decision.

## NOW

### Complete canonical founder-backend cutover and signed-in acceptance

- Idea: Keep repository/CLI ownership on the founder-owned Easy Erf backend, enable and verify Google OAuth there, then run the full signed-in Erf 1570 journey before publishing the frontend cutover.
- Expected value: Removes the largest gap between repository confidence and a genuinely usable production investigation while preventing new work from drifting back onto rollback infrastructure.
- Dependencies: Existing founder Supabase project, Google OAuth configuration, rollback-safe auth bridge, current Site Potential API/client transport and a signed-in acceptance account.
- Why now: Guided, Dossier and Report already share canonical planning, evidence, Strategy and Site Potential state. The remaining highest-risk gap is proving those paths together on the canonical backend.

### Validate Erf 1570 end to end in the real product

- Idea: Validate search -> Property Overview -> Guided -> Strategy -> Site Potential -> Market -> Report with a signed-in smoke after the PR #63 rescue.
- Expected value: Closes the largest current flow gap and proves the MVP for the canonical property.
- Dependencies: Existing Guided Task Registry, StrategyLab, workspace state, Google Places configuration, Site Potential runtime configuration and a review-environment account.
- Why now: Current main now contains the intended ten-step path, but no signed-in real-product smoke has been completed locally.

### Validate the live address path

- Idea: Verify the server-side Google Places autocomplete/geocoding route and parcel-biased South African suggestions in the review environment.
- Expected value: Makes Add Address reliable without exposing a browser credential dependency.
- Dependencies: Server route, production `GOOGLE_PLACES_API_KEY`, provider quota and review-environment QA.
- Why now: The server boundary now exists, but provider configuration and live response behavior remain external dependencies.

### Complete signed-in runtime validation

- Idea: Run the canonical Erf 1570 journey with real configuration and confirm Site Potential entitlement, file reading, report updates and no render loops.
- Expected value: Separates repository confidence from real product confidence.
- Dependencies: Site Potential beta/generation/worker flags, worker secret, provider and Supabase server configuration.
- Why now: No local signed-in browser smoke command is available.

## NEXT

### Stronger cadastral retrieval

- Idea: Broaden official parcel retrieval beyond viewport-loaded map features while preserving exact identity and pilot-source provenance.
- Expected value: More reliable erf search and reopen flows.
- Dependencies: Public CSG/Kouga query limits, pagination, registry refresh and source licensing.
- Why now: Pilot search works, but broader coverage remains a known limitation.

### Municipal planning and zoning integrations

- Idea: Add property-specific municipal zoning, planning controls and official documents.
- Expected value: Replace working assumptions with stronger evidence for build-envelope and strategy decisions.
- Dependencies: Municipal data access, document provenance, jurisdiction mapping and legal review.
- Why now: Published rules are currently context, not proof of a property-specific right.

### Paid-provider integration

- Idea: Make Lightstone/WinDeed acquisition and evidence attachment more durable without pretending Easy Erf owns provider data.
- Expected value: Better ownership, transfer, valuation and deeds-level context.
- Dependencies: Provider agreements/APIs, licensing, payment/commercial decision and secure file handling.
- Why now: Current links and uploads are useful pathways, but not live provider integration.

### Document intelligence

- Idea: Improve extraction, lineage handling, identity matching and user-confirmed evidence across SG, title and paid reports.
- Expected value: More usable evidence with fewer false mismatches.
- Dependencies: Existing extraction contract, provenance rules, safe redaction and representative documents.
- Why now: Document trust is central to the MVP and must improve without weakening anti-hallucination rules.

### Address intelligence

- Idea: Resolve address, suburb, municipality and parcel context through one canonical working-address model.
- Expected value: Better market matching without overwriting official identity.
- Dependencies: Secure Google/server provider path and canonical workspace state.
- Why now: Address is a shared input across Market, Guided and reports.

### Listing and comparable automation

- Idea: Expand the reviewed importer/evidence flow to more permitted providers and stronger comparable handling.
- Expected value: Faster market evidence collection and strategy context.
- Dependencies: Provider permission, server-side contracts, review/edit UX and no browser scraping.
- Why now: Property24 is narrow and evidence must remain user-reviewed.

### Environmental and public datasets

- Idea: Add flood, coastal, heritage, geology, access and infrastructure evidence where public sources are reliable.
- Expected value: Better risk and feasibility decisions.
- Dependencies: Source availability, geospatial normalization and explicit confidence/provenance.
- Why now: These are important unknowns but should follow identity and planning foundations.

## THEN

### Robust deterministic build envelope

- Idea: Calculate a more complete buildable envelope from verified zoning, setbacks, coverage, height, density, servitudes, access and topography.
- Expected value: More credible Site Potential and development feasibility.
- Dependencies: Property-specific planning evidence and deterministic geometry; never treat assumptions as rights.
- Why not now: Current controls are often working assumptions.

### Development scenario intelligence

- Idea: Compare build-to-sell, build-to-rent, flip, hold, STR, BRRRR, bond and land-bank scenarios with transparent sensitivity.
- Expected value: Better decisions from the same property evidence.
- Dependencies: StrategyLab, saved evidence, market inputs and deterministic formulas.
- Why not now: Core Strategy exists, but integration and evidence quality need to stabilize first.

### Financial decision intelligence

- Idea: Add deeper affordability, residual value, return, risk and sensitivity explanations.
- Expected value: Make calculations easier to interpret without replacing the maths.
- Dependencies: Calculator outputs, canonical assumptions and report integration.
- Why not now: Avoid adding interpretation before the evidence and scenario state are consistently integrated.

### Risk scoring

- Idea: Build explainable risk categories from evidence gaps, contradictions, planning constraints, market context and scenario sensitivity.
- Expected value: Faster prioritization of material unknowns.
- Dependencies: Evidence confidence, contradiction detection and explicit score explanations.
- Why not now: A score without complete provenance would create false precision.

## LATER

### Property passport

- Idea: A durable longitudinal property record containing documents, reports, inspections, images, concepts, quotes, decisions and changes.
- Expected value: Turns an investigation into a reusable asset.
- Dependencies: Stable evidence/file model, account persistence, permissions and change tracking.
- Why not now: The current canonical file and report foundations are still consolidating.

### Monitoring and alerts

- Idea: Notify users about planning, listing, market or public-record changes for a property.
- Expected value: Ongoing value after the first investigation.
- Dependencies: Durable property passport, scheduled source checks, permissions and provider terms.
- Why not now: Requires stronger sources and a stable identity record.

### Professional/local property team

- Idea: Connect users with planners, architects, engineers, conveyancers, builders and other local specialists.
- Expected value: Convert evidence gaps into qualified next actions.
- Dependencies: Partner model, compliance, verification and commercial terms.

### Transaction and due-diligence room

- Idea: Shared property workspace for documents, tasks, reviews, decisions and professional collaboration.
- Expected value: Support real transactions beyond individual research.
- Dependencies: Permissions, audit trail, secure storage and property passport.

### Portfolio tools

- Idea: Compare multiple properties, scenarios, risks and evidence readiness across a portfolio.
- Expected value: Extend Easy Erf from single-property decisions to portfolio allocation.
- Dependencies: Stable single-property model and account-backed persistence.

### Professional marketplace and fulfilment

- Idea: Route planning, legal, inspection, finance and building work to appropriate professionals.
- Expected value: Complete the investigation-to-action loop.
- Dependencies: Verified marketplace supply, commercial agreements and compliance.

### Enterprise APIs

- Idea: Expose property intelligence and investigation workflows to professional or enterprise systems.
- Expected value: New distribution and recurring product use.
- Dependencies: Stable contracts, licensing, security, tenancy and support model.

### Additional municipalities and national coverage

- Idea: Extend beyond Kouga/St Francis to more municipalities and eventually national official coverage.
- Expected value: Larger addressable market.
- Dependencies: Cadastral retrieval, municipal source mapping, refresh operations and support.
- Why not now: The MVP is intentionally one pilot geography and one gold-standard property.

### Satellite / Earth-observation intelligence

- Idea: Use satellite or Earth-observation data for physical, environmental or development context.
- Expected value: Additional property intelligence where ground data is sparse.
- Dependencies: Commercial datasets, geospatial methods, privacy/legal review and validation.

### International expansion

- Idea: Adapt the evidence, planning and property workflow to other countries.
- Expected value: Long-term market expansion.
- Dependencies: New cadastral, legal, planning, provider and compliance systems.
- Why not now: It would dilute the South African pilot before the core journey is proven.
