# Report decision brief: design candidate

Issue #181 item 8 only. Source base: `284a20cfeffb2c2560d428f4bd56e71743d3a704`.
Branch: `codex/report-decision-brief-181`. No competing PR while #182 is frozen for review.

## Reader problems addressed

1. The first screen was dominated by Ask and methodology before any assessment.
2. Property identity, findings and caveats were repeated at multiple levels.
3. Empty evidence sections occupied the same visual weight as useful findings.
4. Saved Strategy numbers were buried far below the decision context.
5. Report task buttons could be enabled without a destination; evidence and professional actions were not distinct.

## Implemented hierarchy

Property and review status, evidence-supported assessment, selected Strategy figures with their input basis, material conflicts and missing-evidence categories, then three prioritized actions. Detailed identity/SG/title, planning/Site Potential, Market/Strategy, optional checks/location, all findings/actions, and document/source/work records remain in six expandable sections. The existing print document expands them.

All canonical findings, source records and individual grouped planning requirements remain available. No calculation, evidence status, canonical action ranking, saved content, frozen report approval or permission is changed. Ask remains available after the assessment, rather than acting as the report's opening. The R999 entry is not removed or repositioned by this batch.

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
- Before report heights: 13,753/14,697px desktop, 24,458/26,185px mobile. After collapsed opening/evidence index: 2,278/2,467px desktop, 2,970/3,451px mobile. Details remain available; this is reduced initial reading length, not deletion of evidence.

Limitations: not a real-user comprehension study or production acceptance. Component fixtures deliberately show the honest missing-satellite fallback; the built-app map uses a synthetic style and recorded boundary, not live satellite imagery. External destinations are intercepted, so their current service availability is not claimed. Existing authenticated backend permissions are unchanged and are not re-proven by mocked browser tests. Owner design review and independent review are outstanding. No merge/publication is authorized. SG redesign and #182 saving/history are not marked complete here.

No purchased credits, paid API/provider call, production access or additional service was initiated. Actual account spend is UNKNOWN, with a $0 additional discretionary cap.
