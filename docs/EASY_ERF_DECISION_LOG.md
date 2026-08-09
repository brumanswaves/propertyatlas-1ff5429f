# Easy Erf Decision Log

This is a concise register of durable product and engineering decisions. Exact dates are included only where the repository history or merged PR record makes them reliable; otherwise the date is marked historical.

## EE-001 - Product name and approved logo

- Date: historical; exact date not recorded in this register.
- Decision: The visible product name is Easy Erf. The approved Easy Erf logo is locked and must be used as supplied.
- Rationale: A single current brand prevents repeated visual and copy redesign.
- Supersedes: User-facing ErfStoep / PropertyAtlas naming; internal technical names may remain for compatibility.
- Implementation: Change visible copy and metadata only when in scope; do not redraw, crop, recolor or replace the approved logo.
- Do not regress: Never introduce a competing logo or brand direction.

## EE-002 - Primary MVP user

- Date: historical; exact date not recorded.
- Decision: Serious property buyers and investors are the primary MVP users, while the first-run experience must remain understandable to ordinary home buyers.
- Rationale: The product must have credible evidence and numbers without becoming expert-only software.
- Implementation: Simple Guided UX first; professional depth underneath.

## EE-003 - Guided/simple experience with expert depth

- Date: historical; exact date not recorded.
- Decision: Guided Investigation is the normal-user path; the existing expert Workbench remains available but secondary.
- Rationale: Users need one obvious job and next action, while advanced tools still need to be accessible.
- Implementation: Do not replace canonical Workbench state with a second guided data model.
- Do not regress: Opening Property Overview must not silently start investigation or overwrite state.
- Related: `docs/guided-investigation-phase-1.md`, PR #61.

## EE-004 - Erf 1570 and the Kouga/St Francis pilot

- Date: historical; exact decision date not recorded.
- Decision: Erf 1570 is the gold-standard end-to-end acceptance property; Kouga/St Francis is the initial pilot geography.
- Rationale: The team has real supporting information, documents and decision questions for this property.
- Implementation: Use it for acceptance and regression tests, never as a generic hard-coded special case.
- Related: `docs/EASY_ERF_MASTER_PLAN.md`, PR #56.

## EE-005 - Authority hierarchy

- Date: historical; exact date not recorded.
- Decision: GitHub `main` is code truth and `docs/EASY_ERF_MASTER_PLAN.md` is product truth.
- Rationale: One implementation source and one product-direction source prevent competing roadmaps.
- Supersedes: Older repository documents as equal authorities.
- Implementation: Older PropertyAtlas/ErfStoep docs are consulted for history and rationale only; conflicts are resolved in favor of current main and the Master Plan.

## EE-006 - Property First Read is the normal entry

- Date: 2026-08-08, PR #61.
- Decision: Exact official search, map selection and saved-erf reopen should land on a read-only Property Overview / Property First Read. Guided Investigation begins only through an explicit action.
- Rationale: The first read should orient the user without creating workspace commits or forcing a task list immediately.
- Implementation: Reuse canonical parcel, investigation, planning, vault, market, Strategy and Site Potential state; keep the entry zero-commit.
- Do not regress: Do not make Overview visits start investigation or write derived state.

## EE-007 - One canonical Next Best Action

- Date: 2026-08-08, PR #60.
- Decision: The Guided Task Registry is the sole ranking and execution source for the canonical Next Best Action. Report and Guided surfaces adapt it rather than deriving their own competing action.
- Rationale: Competing actions destroy trust and make progression feel random.
- Implementation: Use `GUIDED_TASK_DEFINITIONS`, `deriveInvestigationFacts` and `canonicalReportAction`; AI-returned next-action text cannot own navigation.
- Related: PR #62 preserves this boundary for Ask Easy Erf.

## EE-008 - Evidence provenance and confidence

- Date: historical; exact date not recorded.
- Decision: Every important fact carries source/provenance and an explicit state such as verified, user-confirmed, working assumption, missing or conflicting. Readability is separate from identity certainty.
- Rationale: A readable document is not automatically the correct property document, and a published rule is not a property-specific right.
- Implementation: Reuse the canonical evidence pack, document trust model, planning assessment and vault state. Preserve quoted evidence and locators.
- Do not regress: Never infer evidence from a missing file, a truthy display string, a generic AI success, or a provider link alone.
- Related: PR #56 and PR #62.

## EE-009 - Deterministic calculations before AI explanation

- Date: historical; exact date not recorded.
- Decision: Maths and geometry are deterministic and visible first; AI may explain, compare and warn but may not invent or silently replace calculations.
- Rationale: Property decisions require inspectable assumptions and formulas.
- Implementation: Reuse StrategyLab and calculator helpers; label property-derived inputs and user assumptions.
- Related: PR #57.

## EE-010 - Site Potential inherits evidence confidence

- Date: historical; exact date not recorded.
- Decision: Site Potential may show useful working envelopes and concepts, but unverified controls remain assumptions and concepts are not approvals or plans.
- Rationale: Visual usefulness must not become a false property right.
- Implementation: Keep planning provenance and Site Potential resolution together; show caveats beside derived outputs.
- Related: PR #56, PR #57 and PR #58.

## EE-011 - Ask Easy Erf is grounded, not generic

- Date: 2026-08-08, PR #62.
- Decision: Ask Easy Erf answers from the canonical Property Evidence Pack/report intelligence with evidence references and calibrated confidence. It does not choose application navigation.
- Rationale: A successful model response is not proof, and model-generated action text must not compete with the application workflow.
- Implementation: Build bounded evidence payloads, preserve uncertainty, and route actions through `canonicalReportAction`.
- Do not regress: Do not add a second chatbot or a parallel fact model.

## EE-012 - Easy Erf Report is the living destination

- Date: historical; exact date not recorded.
- Decision: The report is continuously improved by identity, evidence, market, Strategy, Site Potential and recommendations; it is not only a final static PDF.
- Rationale: Users need one place where the current evidence, gaps and decisions remain visible.
- Implementation: Modules feed shared report view models and canonical actions; print is a presentation of the living report state.
- Related: `docs/easy-erf-report-roadmap.md`, PR #60 and PR #61.

## EE-013 - Paid reports are evidence/commercial pathways

- Date: historical; exact date not recorded.
- Decision: Lightstone, WinDeed and similar reports may be recommended, bought externally or uploaded as evidence, but Easy Erf must not pretend provider integration, payment processing or report analysis exists when it does not.
- Rationale: Paid reports can materially improve ownership, transfer and market context while requiring honest boundaries.
- Implementation: Keep purchase/upload copy, provider links, file provenance and reference-only states explicit.

## EE-014 - Tool-role separation

- Date: historical; exact date not recorded.
- Decision: Codex/GitHub owns implementation, testing and PR work; Lovable is for approved visual refinement, preview/runtime configuration and publishing; ChatGPT/project control-room work holds product strategy and orchestration.
- Rationale: Separate roles reduce duplicated roadmaps, conflicting code and unnecessary AI spend.
- Implementation: One focused branch/tranche, one PR, merge review, production sync and live QA.

## EE-015 - Current next action is integration validation

- Date: 2026-08-09, current-state baseline after PR #63.
- Decision: Before adding broader automation, run a signed-in Erf 1570 end-to-end smoke against the current runtime configuration.
- Rationale: PR #63 closed the known code-path gaps, but repository tests and deployed provider configuration are not the same as a real user journey.
- Supersedes: Treating unit-test green as sufficient proof of the live product path.
- Implementation: Keep the next tranche focused on QA and defects found in the canonical journey; do not expand into national search, new providers or speculative AI features.

## EE-016 - Ten-step Guided journey includes Strategy

- Date: 2026-08-09, PR #63.
- Decision: The deliberate Guided journey is ten steps: Confirm property, Add address, SG diagram, title/paid report, zoning, property checks, Market evidence, Strategy & Calculators, Site Potential, Review report.
- Rationale: Strategy is a core decision pillar and must not exist only in the expert Workbench.
- Implementation: Reuse the existing StrategyLab, workspace state and deterministic calculators; completion is a saved/chosen scenario or explicit skip where the step permits it.
- Do not regress: Keep the canonical task registry and report action aligned with the Guided order.

## EE-017 - Server-side address provider boundary

- Date: 2026-08-09, PR #63.
- Decision: Google autocomplete and geocoding calls use the server-side address suggestions route; the browser must not receive the provider key.
- Rationale: A missing build-time browser key previously made address suggestions silently unavailable and exposed an avoidable credential dependency.
- Implementation: Configure `GOOGLE_PLACES_API_KEY` in the runtime, retain parcel bias and visible error states, and keep working address separate from official parcel identity.
- Do not regress: Never expose a server/provider key in frontend code.
