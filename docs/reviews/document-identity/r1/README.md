# PR 199 R1: registered extent provenance

Amends independent review 5345100213 against e283128e88678026235d1da8e2cdb331c9631b86. See source-binding.json for tested implementation and exact source blobs. The final evidence-only commit has the same src tree.

## Corrected report wording

For the canonical synthetic regression (900 m2 official, 600 m2 uploaded):

> The official cadastral record states 900 m2 while an uploaded document states a registered extent of 600 m2. The extent document's identity has not been independently matched. Easy Erf keeps both values and does not choose between them.

The unchanged recommendation is to reconcile through a land surveyor or conveyancer. Report risk and recommendation detail both inherit this disclosure. For a genuinely matched extent source only, the disclosure says: `The extent document is identity-matched.` An unrelated matched document cannot upgrade the extent source.

Only the area-warning projection and canonical tests changed. Both numeric values, claim status/confidence, source references and discrepancy remain. No identity metadata or report draft was modified.

## Verification

Seven new canonical-module regression cases cover ready/partial user-attached extents, both mixed document orders, genuine matched extent with unrelated unverified evidence, mismatch and parent context. The tests inspect actual report risk and recommendation output and retain both areas and references. Focused: 34 files, 515 tests. Full readiness suite: 174 files, 1809 tests. ESLint with prettier/prettier enabled, TypeScript and whitespace checks exit 0. Configured local build receipt/log are adjacent; application configuration preserved and Node request-denial preload used. This is process-level denial, not an OS firewall assertion.

Original PR199 evidence remains in the parent directory, attributed to its original commit. Unaffected geometry, account/order isolation and prior acceptance evidence retain their original attribution. No browser diagnostics, extraction, live data operations or screenshots were repeated. Existing open human-authored unapproved draft was not navigated, edited or overwritten. No report approval, delivery, merge or publication. Existing live-save allowance remains consumed 1/1.

Remote CI is not a pass: no workflow dispatched; skip-ci commit messages preserve the production-contact boundary. No provider or discretionary paid action initiated, cap $0. Local tests are not live acceptance. Whole-product acceptance remains open. Next actor: independent reviewer for focused R1 review of amended exact candidate, then a separate owner release decision if accepted.

SHA256SUMS.txt hashes committed Git file bytes, excluding itself. Build runner retains its artifacts/issue199-r1 output path and requires the adjacent guard there for reproduction.
