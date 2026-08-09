# Easy Erf repository instructions

Before material Easy Erf work, read:

- `docs/EASY_ERF_MASTER_PLAN.md` - product truth and delivery direction.
- `docs/EASY_ERF_CURRENT_STATE.md` - concise operational state.

For product-direction decisions, also consult `docs/EASY_ERF_DECISION_LOG.md`.

## Authority and scope

- GitHub `main` is code truth.
- `docs/EASY_ERF_MASTER_PLAN.md` is product truth and must not be replaced by a competing roadmap.
- Older PropertyAtlas/ErfStoep documents are historical context. Current Master Plan decisions and current `main` win when they differ.
- Before implementing, determine whether the capability already exists and which canonical state owns it.
- Work on one focused implementation tranche at a time. Stay within the requested scope and report unrelated problems instead of silently expanding scope.

## Engineering guardrails

- Reuse the canonical property, evidence, investigation, report, Market, Strategy and Site Potential state.
- Do not create duplicate fact or evidence models.
- Preserve explicit `verified`, `working`, `assumed`, `missing` and `conflicting` states.
- Do not fabricate paid-provider, official, municipal or market integrations.
- Do not redesign the approved Easy Erf logo.
- Keep Ask Easy Erf grounded in canonical property intelligence and evidence.
- Use deterministic maths and geometry first where applicable; use AI for interpretation second.
- Prefer existing architecture and patterns. Avoid unrelated cleanup and refactors.
- Run focused tests while developing. Reserve the full suite for merge readiness or when explicitly required.
- Keep completion summaries concise and include tests, limitations and deferred work.

## Product boundaries

- The default UX is simple and guided; expert depth remains underneath.
- Erf 1570 is the gold-standard acceptance property, not a hard-coded special case.
- Easy Erf Report is the living destination of the investigation.
- The Guided Task Registry owns the canonical Next Best Action. Report and Ask must adapt that action rather than invent competing workflow actions. Other surfaces must not introduce a competing canonical next-action ranking; Market Evidence remains a canonical evidence and Strategy input without an assumed navigation contract.
- Site Potential outputs must inherit evidence confidence and clearly expose assumptions.
- Do not use Lovable as a parallel roadmap. Codex/GitHub owns implementation and tests; Lovable is reserved for approved visual refinement, preview and publishing work.
