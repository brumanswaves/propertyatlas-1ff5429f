# Issue 198 rendered report provenance repair

Implements issue comment 5913661263. Tested implementation: b0ca9c46f081996584e7e69da83c0d0d55221429, based on main 7740788a575def442422914bd8a0315d2f4ac395. The final receipt-only commit preserves the tested src tree; see source-binding.json. Actor: existing sole Codex task and checkout. No delegated or competing writer.

## Wording for review

- Populated Ownership heading: **Ownership and deeds evidence; not certified by Easy Erf**.
- Empty Ownership heading remains **Not verified by Easy Erf**.
- Generic document context label: **Recorded evidence; check source provenance**.
- Municipal context: **Recorded amounts retain their source provenance and confidence; inclusion does not establish a document identity match.**
- Missing municipal value: **No municipal roll value is recorded in the available evidence.**

Per-value canonical provenance, source/page attribution, PII redaction, ownership disclaimer, and the R1 area discrepancy remain intact. No evidence state, identity metadata, permissions or values were upgraded. Only four presentation strings changed; no persistence, geometry, account or backend code changed.

## Verification

- Nine added canonical cases: ready/partial user-attached, mixed documents, genuinely matched, deed-only, legacy absent source identity metadata, empty/inaccessible evidence, mismatch and excluded archived evidence.
- Actual ReportOwnershipSection and SharedInvestigationReport are rendered together with municipal context and printOnly output. Tests verify populated values, each source/page, individual provenance, redaction and network/mutation spies. Existing R1 tests remain passing.
- Full local readiness suite: **174 files, 1818 tests passed**. TypeScript and whitespace checks exit 0. Changed-file ESLint with prettier/prettier enabled and formatter check exit 0. Command receipts and logs are adjacent.
- Local bundled Playwright and installed Chromium opened the native details elements in actual-renderer static HTML for all nine cases. Expanded Ownership and municipal text matched print-media text in all nine cases; **zero requests**. No app hydration, session navigation or external services. The fixture contains synthetic data only.
- Mixed-source PDF exported locally and independently read back with pypdf: corrected heading, unverified disclosure and neutral source label present; old heading absent. This checks printable content, not full visual layout or an operating-system printer.
- Normal configured non-deploying build exit 0 at the tested source. Existing .env identity is recorded by hash only, unchanged. Node network-denial preload recorded zero attempts. This is process-level denial, not an OS firewall claim. Actual target: Nitro cloudflare-module, compatibility 2026-09-25. Existing route-export and chunk-size warnings remain nonfatal. See build receipt/log for versions.
- Remote CI was not dispatched and is **not a pass**. Skip-ci commits preserve the production-contact restriction.

## Preservation and limitations

The retained human-authored unapproved draft remains unchanged (SHA256 b9034e85b1ca1a82a842c303fe8fda533e15ac1142ecd1fda8e4c227c6da6b3c). Its content is not in this packet. No production navigation, extraction, report approval, delivery, merge or publication. Geometry save remains **1/1 consumed**, with retained reported revision 59 to 60. No geometry evidence was replaced or regenerated.

Unchanged geometry, source/account isolation and earlier acceptance evidence retain their original attribution. Source tests and PDF fixtures do not establish live Erf 1570 or whole-product acceptance. The missing official-area claim and historical site note remain outside scope. No new maps/provider/AI processing or discretionary paid operation was initiated; additional cap $0. Actual account credit billing is not available in this receipt.

Next: independent focused review of the exact draft candidate, then separately authorized release if accepted. The separately approved read-only Founder preflight still requires a normal session already authorized for Founder Operations; no such session has been established in this source run. Customer acceptance requires the actual bound customer session. Human report approval and delivery remain separate gates. No background job remains after this task.

## Reproduction and binding

SHA256SUMS.txt hashes committed Git bytes, excluding itself. Portable text logs normalize line endings/trailing whitespace and label NUL markers; raw local logs remain retained. The scripts retain artifacts/issue198-rendered output paths. The browser runner uses the installed local bundled runtime path; it is not a live-site adapter. The test's optional EE_RENDER_EVIDENCE_DIR exports all nine synthetic normal/print HTML pairs; two representative mixed-source files are retained here. No screenshots were regenerated for timestamps. Source-binding.json and the final PR head bind the evidence to the candidate.
