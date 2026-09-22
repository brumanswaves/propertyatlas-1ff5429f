# Easy Erf isolated customer-to-delivery rehearsal

This is synthetic local acceptance, not a production launch or real Stripe acceptance. The actual combined application was exercised with real local Auth, database and private Storage. No production data was copied.

## Download and inspect

[Download the final PDF](delivered-report-final.pdf). [Browse screenshots](screenshots/). [Results matrix](#results-matrix). [Persisted records and denial evidence](evidence/persistence-handoff-delivery-denial.json). [Exact source binding](source-identification.json). [Executed assertion excerpts](ASSERTIONS.md).

The original local preview URL refers to the owner's machine, not the reviewer's loopback interface. It is not a hosted review URL. No account credentials, browser sessions or signed URLs are included. During packaging PID 44420 was absent and port 4178 was unreachable; no restart or local data change was performed.

## Source and environment

Repository: brumanswaves/propertyatlas-1ff5429f.
Sole writer: existing owner-authorized Codex task.
Historical rehearsal branch: codex/product-journey-completion.
Review branch: codex/rehearsal-repairs-review.
Candidate source commit: e57160e7d1fbfaf25c9a41388804a592a30cb8d4.
HEAD: 23ff503828db85b68d56ed5c15c8f5b6f1926ac7.
Fresh inspected main: 84a6e99f7985ba7d5b1b3a29d2c19c76acae2b95.
HEAD's starting tree matched main. Rehearsal source included uncommitted fixes. Those five files are now committed unchanged (apart from Git line-ending normalization). Exact final file SHA256 values and historical binding limitations are in source-identification.json. Nothing was merged or published.

Local Supabase project ee-r999-isolated runs in existing WSL/Podman machine podman-vc-pr68-auth, with only this task's network ee-r999-investigation-test (172.30.87.0/24). API 54321, Postgres 54322, local mail capture 54324, closed function gateway 54325, Deno function handlers 54326. No hosted Supabase project was created or linked.

Isolation: local container ports are published inside WSL and protected by task-specific nftables input/forward rejection rules. They are not claimed to be natively loopback-bound containers. Node denies external networking; Deno is limited to loopback and cached imports. Browser interception and the manual wrapper's CSP deny external requests. A container outbound probe failed as intended. Existing unrelated containers and files were preserved. No browser storage or production draft was cleared.

## Walkthrough evidence

1. Normal sign-in, map search, exact synthetic parcel, address, customer SG PDF receipt and original-byte verification: screenshots/customer-upload-desktop.png and customer-upload-mobile.png.
2. Same-byte reselection created one SG attachment. Save, leave, Back/Forward and reload preserved the file and investigation. Sparse self-service report: screenshots/customer-sparse-report.png.
3. R999 help from the existing investigation saved the actual review brief and invoked the actual checkout handler. Stripe API responses and the hosted checkout page were explicitly simulated: screenshots/simulated-payment-boundary.png.
4. Locally signed synthetic webhook events passed through the actual handler and payment RPC. The exact owner, parcel and order persisted. No direct database mark-paid shortcut was used.
5. Investigator accepted a real local Auth invite, opened the assigned customer investigation and preserved the customer's original without granting AI permission. Additional synthetic title evidence used a labelled local extraction fixture. Working zoning, a manual comparable, Strategy and deterministic Site Potential persisted: screenshots/worker-site-desktop.png and worker-site-viewport.png.
6. Founder wrote and approved the human-only summary through the actual staff UI, then used the actual delivery button. Notification output was captured locally. No real email was sent. Ask Easy Erf stays at the top, unavailable for this human-only version.
7. Customer A reopened the delivered report on mobile and desktop: screenshots/customer-combined-mobile.png and customer-delivered-desktop.png. Report state remained frozen after subsequent investigation changes.
8. Print / Save PDF prepared the authorized report only. The browser print dialog was intercepted for automation and the exact prepared document exported locally. See delivered-report-final.pdf. This proves prepared-document export, not an operating-system printer dialog.

## Results matrix

| Check | Result | Limit |
|---|---|---|
| Local frontend/Auth/database/Storage/functions and outbound isolation | Passed | Synthetic provider responses; no production acceptance |
| Customer sign-in, exact erf, upload, preview, save/reopen | Passed | Synthetic PDF and parcel |
| Original-byte hash and duplicate reselection | Passed | One SG attachment remained |
| Retained work, Back/Forward/reload | Passed | Found and fixed null-versus-empty sync false conflict |
| Zoning, Checks, Strategy and Site Potential | Passed | Saved user assumptions, not professional validation |
| Sparse self-service report | Passed | Visual inspection and existing design, no AI quality claim |
| R999 handoff keeps customer investigation | Passed | Checkout provider and payment events simulated |
| Actual owner/property/order binding and paid persistence | Passed | Locally signed synthetic event through real handler |
| Invalid/duplicate webhook, unpaid/expired events | Passed | No real Stripe events or card declines |
| Staff role separation and human approval/delivery | Passed | Real isolated UI and persisted records |
| Customer B report, evidence route and direct Storage access denied | Passed | followup.json plus primary receipt |
| Sign-out and missing/invalid token protection | Passed | Natural timed session expiry not tested |
| Desktop/mobile report and PDF preparation | Passed | 21-page final export; no live satellite imagery |
| Interrupted upload over a failing connection | Passed | Browser Storage POST aborted with connection reset; visible error, no new asset, original hash preserved |
| Actual cancelled/declined Stripe checkout | Not tested | Unpaid/expired synthetic events only |
| Natural Auth expiry and refresh recovery | Not tested | Sign-out and invalid-token checks are narrower |
| Real Stripe Sandbox checkout/webhook | Blocked | Only connected Easy Erf test account is available and its webhook points to production |
| Lightstone purchase/retrieval/integration | Not tested | Provider integration pending; no calls or manufactured receipts |
| Paid AI and answer quality | Not tested | No paid AI; one title extraction fixture, human-only report |
| Production/customer launch acceptance | Not tested | No deployment or production writes |

The complete selected human-only journey passed in evidence/receipt.json. Earlier run folders contain failures and diagnostics; do not treat their aggregate as a clean pass. Run-13's denied staff AI read preserved the customer's absent permission. The run-16 result label inherited from the old harness mentions SG extraction; only synthetic title extraction ran in this route. Customer SG was preserved without extraction.

## Persisted evidence

Order: 354d398c-a45e-4df4-97a3-8eb5eecdad39.
Version: 1babfa1d-2e51-448f-93fc-9810ea1912b3.
Frozen report SHA256: 416752759aa1786f7f27b95b22cb1be37fd3eefef74d3b2709dc6298070f8067.
See [persistence receipt](evidence/persisted-delivery.json), [run receipt](evidence/receipt.json), [sanitized response evidence](evidence/persistence-handoff-delivery-denial.json) and [follow-up assertions](evidence/followup.json). Provider requests are synthetic captures only. Local notification links retain the application's canonical URL string, but no request or email was sent there. No reviewer should follow those notification links; use the downloadable evidence instead.

## Repairs and remaining gates

Implemented and checked: normalize legacy empty Site Potential inputs in sync comparison, preserving genuine conflicts; add delivered-report printing; preserve image URLs and report map canvas for export. Focused regression tests, TypeScript and local build passed. Lint has zero errors and three pre-existing map hook dependency warnings. Existing focused SG/payment checks passed. No repeated full CI or broad audit.

The remaining financial acceptance step needs a separate Stripe Sandbox. Exact bounded request: authorize or provide access to one separately isolated Easy Erf Stripe Sandbox, one R999 test checkout configuration and one webhook route to this isolated local handler only; maximum spend R0; no production endpoint, live charges, changes to the existing test account webhook, or recurring paid service. Stop if separate isolation or local-only routing cannot be established. This request does not authorize a Supabase/cloud project or production configuration change.

No owner action is needed to inspect the completed local rehearsal. Real Stripe, Lightstone, paid AI and production acceptance remain separate gates. Additional discretionary spend incurred by this rehearsal: R0; account-level Codex credit consumption is not independently measured.


## Review binding and limits

The whole run-16 journey predates the final map-buffer correction. The retained final follow-up verified that correction, PDF preparation, sign-in/sign-out and Customer B report/direct Storage denial. The final source snapshot matches the candidate repair files. No full journey was rerun for this packaging task. The receipt source field is the historical base HEAD, not proof that the dirty repairs were already committed. The source identification file explicitly records this limitation.

The final PDF has 21 pages. [All-page contact sheet](screenshots/export-final-contact-sheet.png). Some sections span pages and the last page is short. Real map/satellite data was replaced by a synthetic parcel and blank style. UI official-source labels describe the mocked fixture path, not a newly verified official property.

[Stripe Sandbox setup request](STRIPE_SANDBOX_REQUEST.md) is prepared only. No Stripe operation was performed during packaging.
