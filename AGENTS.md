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

## Mandatory Codex execution header and credit controls

Every Codex implementation prompt prepared for Easy Erf MUST explicitly state all of the following before the task instructions:

1. `Model`
2. `Reasoning`
3. `Expected credit risk` (`Low`, `Medium`, or `High`)
4. `Maximum intended scope` such as named files, components, or issues
5. `Stop conditions` describing when Codex must stop instead of expanding the task

Do not send or recommend a Codex implementation prompt without this header.

### Default model policy

- `Luna`: trivial, mechanical, low-risk work only, such as tiny one-file edits, simple scans, or narrow test cleanup.
- `Terra` with `High` reasoning: default for normal Easy Erf implementation and focused debugging.
- `Sol` with `High` reasoning: exceptional use only for difficult architecture, unusually hard debugging, or consequential review where Terra is genuinely insufficient.
- Do not escalate from Luna or Terra to Sol unless the user is explicitly told why and approves the escalation.
- Do not let a Codex task silently broaden model choice, reasoning level, or scope.

### Credit-risk policy

- Before any Codex task with `Medium` or `High` expected credit risk, explain why the task is expected to cost more before recommending that it be run.
- Prefer the smallest useful Codex task. Give exact files, known root cause, expected behavior, and focused tests whenever possible.
- Avoid broad repository archaeology when ChatGPT/GitHub inspection can identify the relevant files first.
- Do not ask Codex to reread long project documents for small fixes. For ordinary implementation, start with `AGENTS.md` and `docs/EASY_ERF_CURRENT_STATE.md`; consult the Master Plan or Decision Log only when the task actually changes product behavior, architecture, roadmap, evidence rules, UX philosophy, or commercial direction.
- Run focused tests during development. Run the full suite once at merge readiness unless there is a specific reason to do otherwise.
- If the task begins touching materially more files or systems than the stated maximum intended scope, STOP and report the expansion before continuing.
- Do not spawn additional agents, perform adjacent refactors, or fix unrelated issues unless explicitly requested.

### Required prompt header format

Use this format at the top of future Easy Erf Codex prompts:

```text
CODEX EXECUTION SETTINGS
Model: <Luna | Terra | Sol>
Reasoning: <level>
Expected credit risk: <Low | Medium | High>
Maximum intended scope: <named files/components/issues or clear boundary>
Stop conditions: <conditions that require stopping and reporting before continuing>
```

## Product boundaries

- The default UX is simple and guided; expert depth remains underneath.
- Erf 1570 is the gold-standard acceptance property, not a hard-coded special case.
- Easy Erf Report is the living destination of the investigation.
- The Guided Task Registry owns the canonical Next Best Action. Report and Ask must adapt that action rather than invent competing workflow actions. Other surfaces must not introduce a competing canonical next-action ranking; Market Evidence remains a canonical evidence and Strategy input without an assumed navigation contract.
- Site Potential outputs must inherit evidence confidence and clearly expose assumptions.
- Do not use Lovable as a parallel roadmap. Codex/GitHub owns implementation and tests; Lovable is reserved for approved visual refinement, preview and publishing work.
