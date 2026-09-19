# Report decision brief: design candidate

Issue #181 item 8. Current source base: merged main `1fef6f66e1d911aaf492567f9e8c2f04eae13674`.
Branch: `codex/report-decision-brief-181`. Original approved design `9762338c` is preserved on a local safety branch. The 19 September continuation remains local and unpublished; no competing PR or full CI rerun. See `REPORT_CURRENT_ACCEPTANCE_2026-09-19.md` for current evidence and gates. Historical verification below belongs to the earlier design candidate unless explicitly dated.

## Reader problems addressed

1. The first screen was dominated by Ask and methodology before any assessment.
2. Property identity, findings and caveats were repeated at multiple levels.
3. Empty evidence sections occupied the same visual weight as useful findings.
4. Saved Strategy numbers were buried far below the decision context.
5. Report task buttons could be enabled without a destination; evidence and professional actions were not distinct.

## Implemented hierarchy

Property and review status, compact expandable Ask Easy Erf, evidence-supported assessment, selected Strategy figures with their input basis, material conflicts and missing-evidence categories, then three prioritized actions. Detailed identity/SG/title, planning/Site Potential, Market/Strategy, optional checks/location, all findings/actions, and document/source/work records remain in six expandable sections. The existing print document expands them.

All canonical findings, source records and individual grouped planning requirements remain available. No calculation, evidence status, canonical action ranking, saved content, frozen report approval or permission is changed. Following owner design acceptance, Ask Easy Erf remains prominently at the top immediately beneath the property heading, in a compact expandable panel before the assessment. The R999 entry is not removed or repositioned by this batch.

## Preview and evidence

With the repository's existing dependencies installed, run `node scripts/report-preview.mjs`, then open:

- `http://127.0.0.1:4188/scripts/fixtures/report-preview.html?evidence=sparse`
- `http://127.0.0.1:4188/scripts/fixtures/report-preview.html?evidence=supported`
- Add `&editable` to inspect the genuine report task callback with a clearly labelled synthetic caller. This preview does not execute an investigation task.

The preview renders the real report component and canonical assembly from synthetic fixtures, with no application route or backend. Server egress is blocked. The browser fixture intercepts all external navigation before any provider is contacted. It also fails on backend or mutation requests merely from reading/navigating.

`REPORT_PHASE=after node scripts/verify-report-decision-brief.mjs` captures desktop/mobile opening and full screenshots, planning evidence, Strategy detail, and an interaction receipt in `artifacts/report-after`. Before screenshots use the same fixtures with `REPORT_SOURCE_ROOT` pointing to the detached base checkout, and a separate `REPORT_PORT=4189` preview.

The existing built-app Founder fixture additionally operates the actual application route with synthetic authenticated data, captures `report-decision-brief-app-1440.png` and `report-decision-brief-app-390.png`, verifies the existing deterministic map, and checks that evidence destinations are not obscured by the pinned order header.

## Verification and boundaries

- Focused report/render/provenance/guardrails: 6 files, 96 tests passed.
- Full Vitest: 163 files, 1649 tests passed, including the final pinned-header follow-up. The second readiness run was justified by that actual built-browser defect; it was not a retry seeking green results.
- TypeScript, node-server production build and diff check passed. Targeted ESLint: zero errors/warnings. Known build warnings concern existing chunk sizes/imports and the existing test file under routes.
- Four synthetic report cases: 1440px and 390px, sparse and supported-with-conflict. Evidence reveal, source provenance, origin focus, exact-order hash preservation, canonical task callback and professional/source external destinations are tested.
- Built application: existing Founder fixture, 29 acceptance groups; no real backend/provider traffic. Synthetic lifecycle writes elsewhere in that existing fixture are mocks, not production actions. Reading the report itself must issue no mutation requests.
- Before report heights: 13,753/14,697px desktop, 24,458/26,185px mobile. After collapsed opening/evidence index: 2,286/2,475px desktop, 2,978/3,459px mobile. Details remain available; this is reduced initial reading length, not deletion of evidence.
- Owner's Ask-at-top follow-up: 4 focused files / 61 tests passed. Desktop/mobile sparse/supported checks confirm first-viewport placement above the assessment, a working question field and retention of an unsent question across collapse/reopen. No question is submitted and no AI/backend request occurs. The full-suite and built-app results above belong to the preceding candidate; this narrowly scoped ordering change receives focused, typecheck, lint, build and browser verification.

Limitations: not a real-user comprehension study or production acceptance. Component fixtures deliberately show the honest missing-satellite fallback; the built-app map uses a synthetic style and recorded boundary, not live satellite imagery. External destinations are intercepted, so their current service availability is not claimed. Existing authenticated backend permissions are unchanged and are not re-proven by mocked browser tests. The owner accepted the design direction with Ask Easy Erf retained at the top; independent review remains outstanding. No merge/publication is authorized. SG redesign and #182 saving/history are not marked complete here.

No purchased credits, paid API/provider call, production access or additional service was initiated. Actual account spend is UNKNOWN, with a $0 additional discretionary cap.
