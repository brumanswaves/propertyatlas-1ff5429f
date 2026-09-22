# PR #189 print-readiness repair

Addresses [review 5779833213](https://github.com/brumanswaves/propertyatlas-1ff5429f/pull/189#issuecomment-5779833213). Tested source: **3016bb735f6e63baca493309c93ca454ddabeaed**. Later evidence-only commits do not change application or test source.

The selected account/order/version now registers authorized SG and map settlements. Print awaits them before cloning. Maps settle after idle/render or an explicit unavailable fallback (8 seconds). A 12-second overall limit cancels preparation with an explicit message and no print. A failed SG image shows an unavailable notice. Concurrent clicks share one preparation. Unmount cancels preparation and removes any retained prepared frame. No report layout redesign or access changes; Ask Easy Erf remains above the assessment.

## Executed checks

- 11 actual-component Chromium cases passed: delayed SG/map; already ready; SG image failure; authorized-preview failure; map error; map timeout; overall preview timeout; sign-out; account change; order change; version change. Delayed and ready exports also assert decoded SG pixels, nonblank map pixels and coalesced duplicate clicks. The delayed case checks removal of an already-prepared frame on sign-out.
- 21 related report/context regression checks passed. TypeScript passed. Targeted lint: zero errors, three existing map dependency warnings.
- Tests mount the actual DeliveredInvestigationReport, SharedInvestigationReport, SG preview and map React component. Auth/read transport and Mapbox rendering are explicitly controlled local fixtures. No real account, provider, map tiles, payment or production system is contacted. The OS print dialog is intercepted; evidence PDF captures the prepared same-origin document.
- External browser requests: zero. No whole rehearsal or unchanged full CI rerun.

[Results](results.json), [source hashes](source.json), [new PDF](delayed-ready-export.pdf), [desktop](settled-desktop.png), [mobile](settled-mobile.png), [SG pixels in PDF](export-sg-page.png), [all pages](contact-sheet.png). The PDF has 18 pages. A solid green canvas and orange SYNTHETIC SG image are intentional timing probes, not real imagery or property evidence.

## Reproduce focused browser checks

With existing repository dependencies and Playwright 1.55.0 available, start `node scripts/print-readiness-preview.mjs` and run `node scripts/verify-print-readiness.mjs`. Set EASY_ERF_PLAYWRIGHT_MODULE to the absolute module path and EASY_ERF_CHROMIUM to the installed browser executable where needed. The fixture binds only 127.0.0.1:4189, uses envFile:false and the existing Node external-network guard. No application backend or credentials are required. The script records HEAD at start.

## Reused evidence and accessible files

The previous [run-16 packet](../rehearsal-run16/REHEARSAL.md) remains unchanged. Its payment/handoff/delivery/isolation evidence is reused, with simulated payment and untested natural session expiry still explicit. Its old export does not establish the newly repaired readiness path.

- [Original run-16 PDF in connected Drive](https://drive.google.com/file/d/15z5WBcu-rtJ0JmIH1cnDKozPSxrxObvU/view). Upload, metadata and streamed raw-file readback verified.
- [New delayed-visual PDF in connected Drive](https://drive.google.com/file/d/1lX2bbV2nikTLfoSloaRqHWADbTUBrsAk/view). Access uses existing authenticated Drive connection, not public sharing. No sharing permission was changed.

For a reviewer using the Drive connector, request raw file download with include_base64=false. Do not treat a failed unauthenticated download as visual acceptance. No signed download URL or credential is retained in this packet.

PR remains draft. No merge, publication, Stripe change/event, real email, paid AI, credential change or Vercel use. Additional discretionary spend $0. Independent review is next.

## Release-check follow-up, 2026-09-22

Independent review [5780415182](https://github.com/brumanswaves/propertyatlas-1ff5429f/pull/189#issuecomment-5780415182) cleared the prior export blocker and confirmed 18 pages. The PDF and historical ZIP are unchanged. [Remaining release checks and decision packet](../pr189-release-checks/README.md) record the successful local production build. The later exact type-only fixture correction clears changed-file lint with exit 0; its emitted JavaScript is unchanged and the retained browser evidence is reused with explicit source binding. PR remains draft.
