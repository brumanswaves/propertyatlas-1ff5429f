# Saved boundary context and future recovery metadata

Issue #201. Base: 8c350b30952b8a8f9dc95dd70d0b852c44560b93. Tested implementation: 8814f64ab1dfdcc81413746c05f0bbbf8cbabbb7. Existing sole writer, branch codex/201-saved-boundary-context. Receipt-only changes preserve the tested src tree.

## Corrected output for review

For a revision-60-style record with an identity-bound valid ring and no normalized point:

> A saved parcel boundary is available. Representative point metadata is unavailable; the boundary is map context, not a surveyed position or boundary confirmation.

Map position itself remains Not established. No centroid, legacy-coordinate promotion, surveyed position or official area is invented. Missing/invalid rings instead say: No validated parcel boundary or representative point is available for this erf. A mismatched normalized parcel is rejected; a ring without normalized identity is not used by the shared assembly.

Future exact recovery preserves valid area aliases through the existing canonical area rules, including the projected-area caveat. It does not import new zoning, height or other arbitrary feature properties. Existing valid same-source metadata and site inputs remain unchanged; manual-source area/coordinates are not promoted by an official-boundary recovery. Normalized valid same-source coordinates are retained, but no new representative point is derived.

## Retained live area evidence, not a new lookup

The original browser tool output at 2026-09-28T21:08:22.018Z, call_KqiDeTLYmigsL0PqwQLLb2yM, contains one exact feature for LPI C03400140000157000000 and parcel key E108C034001400001570000000. Its GEOM_AREA is **618.7 m²**; Shape__Area is **906.2578125**, a separate projected fallback, not the registered extent. See retained-area-evidence.json and the sanitized official-only excerpt. Full wire bytes are not claimed: the retained console output collapses polygon coordinates to [Array].

The issue's independent metadata read reported that revision60 did not retain rawProperties/GEOM_AREA. This source repair does not backfill it. The existing record therefore keeps official area unknown until a separately scoped future data action. The reported document-derived602 remains separate, user-attached and unverified; it is neither copied into official area nor suppressed. No further lookup or production read/write occurred here.

## Validation

- 175 test files, **1,835 tests passed**, including17 new shared assembly/recovery/report cases. Normal and printable actual SharedInvestigationReport rendering use the same fixture. Provider/persistence spies and input comparisons establish no calls or mutation during pure derivation.
- Unknown point/area, valid area, missing/invalid provider area, absent/invalid rings, cross-parcel rejection, conflicting legacy coordinates, manual-to-official transition, same-source metadata and unverified document-area risk/recommendation preservation are covered.
- **12 isolated geometry cases passed**, including saved-ring no-lookup, failure/conflict/readback and delayed A-B-A account/order transitions. **29 exact-order lifecycle cases passed**, including queue isolation and stale account/order/role responses. These use mocked transport and synthetic records, not production acceptance.
- The first geometry run timed out at the15-second load event during cold Vite dependency optimization. The retained local runner used DOMContentLoaded with a60-second navigation budget; test assertions unchanged. The second run passed. Original evidence was not overwritten.
- Local browser expanded the actual static report Location details and compared printable text: exact parity, **zero requests**. normal.html/print.html and cropped Location screenshots are synthetic output, not the live customer report or full layout acceptance.
- TypeScript, changed-file ESLint with prettier/prettier enabled, and git diff --check passed. Normal configured non-deploying build passed with unchanged .env hash, no application configuration overrides and zero observed network attempts through the Node denial preload. This is process-level denial, not an OS firewall claim. See receipts for versions, configuration identity, command and exit code.
- No remote CI dispatched; skip-ci commits avoid production-contacting workflows. Zero CI runs is not a CI pass.

## Preservation and remaining gates

Original draft SHA256 remains b9034e85b1ca1a82a842c303fe8fda533e15ac1142ecd1fda8e4c227c6da6b3c. No report tab reload, human text replacement, approval or delivery. The generated geometry contradiction is repaired in source instead of asking the human summary to hide it. After an independently reviewed and separately authorized release, Brandon can revise the historical draft warning and substantively review planning, physical constraints and financial assumptions. No automatic approval.

Maps8/10, static images0/5, geometry save1/1 consumed, delivery0/1; original acceptance cap$10 unchanged. No live allowance used. Additional discretionary spending initiated$0; account-wide billing UNKNOWN. Stripe TEST/disarmed and business-profile/signature/customer/recipient/rights gates remain as previously recorded, not retested here. No backend, migration, extraction, release or provider processing.

## Evidence binding

source-binding.json binds the tested implementation and src tree. SHA256SUMS.txt hashes committed evidence bytes except itself. Logs normalize line endings/trailing whitespace and label NUL markers; raw originals remain under artifacts/issue201. Test/build scripts preserve local output paths. Next actor: independent reviewer of this draft candidate. No ongoing builder is claimed.
