# Report review packet, 20 September 2026

This draft exposes the existing approved Ask-at-top report candidate for independent review. No redesign, merge or publication is included. The new review branch preserves the original remote report branch without rewriting its history.

Implementation revision: `c5c814c43b1c5bd71f6a3d6f4e9f8f51d78a62e8`. Base: `1fef6f66e1d911aaf492567f9e8c2f04eae13674`. The packaging commit changes documentation and evidence files only. The implementation changes 29 files: report presentation, evidence/action destinations, optional deterministic-envelope evidence handling, synthetic fixtures, tests and records. SG changes are explanatory copy only; no extraction, upload, payment, backend or deployment implementation changes.

## Before and current candidate

All screenshots use synthetic Erf 42. No customer record, credential or private preview URL is included.

| View | Before | Current candidate |
| --- | --- | --- |
| Desktop, supported with conflict | [Before](before-supported-desktop.png) | [After](after-supported-desktop.png) |
| Mobile, supported with conflict | [Before](before-supported-mobile.png) | [After](after-supported-mobile.png) |
| Desktop, sparse evidence | Historical baseline above | [After](after-sparse-desktop.png) |
| Mobile, sparse evidence | Historical baseline above | [After](after-sparse-mobile.png) |

Before images come from recorded source `284a20cfeffb2c2560d428f4bd56e71743d3a704`, before the report design. They are historical design comparisons, not fresh main screenshots. After images were captured on 20 September from the actual component at `c5c814c4`, at desktop 1440x1000 and mobile 390x844. Ask remains above the assessment. Sparse evidence and contradictions remain visible. The synthetic fixture deliberately shows missing satellite context rather than generating imagery. Full-page capture exceeded the browser command deadline; opening screenshots were captured successfully instead.

## Real destinations

- Report evidence links expand their section and retain the caller's order hash: SG `#investigation-sg`, planning `#investigation-planning`, Market `#investigation-market`, Strategy `#investigation-strategy`, documents `#investigation-documents`.
- Editable task buttons call the existing caller with the canonical tab and exact anchor, including `sg-diagram-evidence`. Market uses `listings`; property documents use `reports`. Read-only/frozen views explain that editing is unavailable and retain evidence navigation.
- SG public source: https://csg.esri-southafrica.com/ . Municipal planning source: https://www.kouga.gov.za/ . Market sources: https://www.property24.com/ and https://www.privateproperty.co.za/ . These are external source links, not fetched or represented as current property-specific evidence.
- Professional actions use `https://www.google.com/maps/search/?api=1&query=` plus the encoded profession and saved property location. Example: [Town planner near the synthetic fixture location](https://www.google.com/maps/search/?api=1&query=Town%20planner%20near%20St%20Francis%20Bay%2C%20Kouga%20Local%20Municipality%2C%20Eastern%20Cape). Search results are explicitly not an Easy Erf endorsement. No inquiry, purchase or appointment is submitted.

## Evidence and limits

[Exact implementation browser receipt](browser-c5c814c4.json) records four sparse/supported desktop/mobile cases, evidence reveal and return focus, exact-order hash retention, SG task callback and unsent Ask text retention. It also records the limited stable no-request interval and earlier truncated navigation coverage. No Ask request was submitted.

The existing 19 September implementation checks are retained: 566 focused evidence/report/investigation tests, 220 surrounding journey/auth/payment tests, TypeScript, build and targeted lint using the existing workflow rule. These are development evidence, not customer or production acceptance. The build log was inspected again during packaging. Historical full-suite and built-application results in the [design record](../../report-decision-brief-181.md) belong to the earlier revisions identified there, not this head. Automatic exact-head PR checks must be inspected separately; no workflow is manually rerun for packaging.

The packaging revision preserves these implementation trees: `src` = `409b1a7dcef79e2512a1b86251c1c6e3c1086863`; `scripts` = `5ba4627c80b0f40188178e2b78486c8f1bbc5b74`. Package manifest and lockfile are unchanged. A pre-existing manifest/lock disagreement prevents claiming reproducible `npm ci` acceptance; the earlier checks used the workflow-style install without changing the lockfile.

Retained limits: independent review outstanding; no report merge/publication; synthetic browser evidence does not prove live backend permissions or the persisted customer/admin journey. No live satellite/provider availability claim. No newly human-reviewed claim. Missing documents, planning confirmation, provenance and restrictions remain explicit. Original SG acceptance is separate and cannot be replaced by this report fixture. Whole-product completion remains unverified.

## Security follow-up

The exposed preview URL has not been reopened, copied here or used. Lovable's [official sharing documentation](https://docs.lovable.dev/features/share-project#manage-active-preview-links) describes deleting the single affected entry under Share > Share preview > Your active links; deletion is irreversible and can take up to one minute to propagate. This applies if the exposed URL corresponds to a managed shared preview link. No matching link has been inspected or deleted, and no expiry or invalidation is claimed. The owner must identify the affected entry without sharing its token and perform or specifically authorize that targeted operation. An unmatched publisher token requires Lovable's supported owner/support route; do not reset unrelated credentials.

Immediate tranche: existing approved model and reasoning retained; actual UI selection and billed amount are not independently inspectable here. Additional discretionary cap $0. No paid product AI, purchase, live charge, settings change or new service initiated.
