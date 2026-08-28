# Easy Erf Current State

State refreshed: 2026-08-28.

## Canonical sources

- Code truth: GitHub `brumanswaves/propertyatlas-1ff5429f`, branch `main`.
- Current verified `main` baseline before this tranche: `6030b4b2071fc86059ce07095350438eaa9192e9`.
- Product truth: `docs/EASY_ERF_MASTER_PLAN.md`, with the explicit 2026-08-28 owner direction that active Site Potential is deterministic map/build-envelope plus street-side build lines only and does not generate house concepts.
- Backend truth: founder-owned Supabase project `xiqpfhsdlvwrwhclonsg` (`Easy Erf`).
- Erf 1570 remains the gold-standard acceptance property.

## Current MVP objective

Make one real South African property investigation work extremely well end to end, then sell and fulfill the first real **R999 Early Access Easy Erf Property Investigation** before expanding scope.

The commercial MVP is one property for R999, human-assisted and human-reviewed. Easy Erf should use the canonical property file, available public/official evidence, uploaded evidence, deterministic analysis, AI-assisted research where configured, and human review. Unknowns remain unknowns. The offer is once-off, not a subscription.

## Canonical customer journey

1. Find or click a property.
2. Open Property Overview / Property First Read without silently starting an investigation.
3. Explicitly begin or continue Guided Investigation.
4. Complete the canonical ten-step journey: Confirm property, Add address, Add SG diagram, Check title, Confirm zoning, Property checks, Market Evidence, Strategy & Calculators, Site Potential, Review report.
5. Guided, expert Dossier and Easy Erf Report consume the same parcel, workspace, evidence, planning, Strategy and Site Potential state.
6. Ask Easy Erf remains grounded in the same evidence pack and report intelligence.
7. My Investigations reopens durable investigation state rather than maintaining a second progress engine.
8. Early Access human review builds on the same property file instead of creating a separate research product.

## Site Potential product direction

Active Site Potential is now deliberately deterministic.

- Show the parcel/map view with the potential build envelope or build lines supported by current evidence and assumptions.
- Show a street-side / street-level representation of potential build lines and height/envelope limits.
- Do **not** generate house designs, facades, rendered buildings or AI architectural concepts in the active product.
- Generated-design tables, assets, APIs and historical fields may remain temporarily for backward compatibility, but they are not the active user journey or completion contract.
- Site Potential output must preserve planning provenance, assumptions and confidence. A build envelope is not an approved building plan or municipal approval.

Merged PRs #127 and #128 moved the active runtime to this direction. Any stale copy, documentation or persisted legacy projection that still describes selected/generated concepts is compatibility debt and must not be treated as current product truth.

## Current repository state

Recent merged work on `main` includes:

- #118: stabilized the MVP customer journey around auth, zoning, Guided Site Potential, document-reader failure handling, report truthfulness and navigation.
- #119: restored branded Supabase auth transport after #118.
- #120 and #125: reconciled Site Potential state into Guided/shared workspace state.
- #121, #122 and #124: repaired SG preview persistence/recovery and added a deterministic no-model TIFF preview path.
- #123: made SG upload a single-step user-evidence attachment flow while retaining mismatch protection.
- #126: prevented refunded Site Potential packs from becoming the implicit latest pack.
- #127: simplified Site Potential to map and street-side build lines.
- #128: removed retired generated-concept semantics from the active runtime.

At the start of this 2026-08-28 tranche, GitHub had no open pull requests.

## Live founder-backend evidence checked 2026-08-28

Read-only inspection established:

- Supabase project `xiqpfhsdlvwrwhclonsg` reports `ACTIVE_HEALTHY`.
- `extract-erf-asset` is active at version 11.
- `site-potential-api` is active at version 8.
- `render-sg-preview` is active at version 1 with JWT verification enabled.
- The newest checked Erf 1570 SG TIFF has 17 extracted claims and a stored `sgPreviewStoragePath` PNG.
- That SG asset is explicitly bound to canonical Erf 1570 through the existing `user_confirmed` identity binding.
- Its automated `identityMatchStatus` remains `unverified`; user-confirmed binding must not be described as independent cadastral verification.

This proves meaningful backend progress on the SG/report visual path. It does not by itself prove the complete published browser report experience.

## Commercial MVP gap found 2026-08-28

The R999 Early Access offer existed in closed, unmerged PR #107 but was absent from current `main`.

Before this tranche:

- `src/routes/pricing.tsx` contained no R999 offer.
- Repository search found no `R999` or `human-reviewed` commercial copy on current `main`.
- Pricing still described retired Site Potential concept-generation allowances.

The current branch `chatgpt/restore-commercial-mvp-and-project-truth` restores the R999 one-property human-reviewed offer with a fail-closed Stripe-hosted payment-link boundary and updates Pricing to the deterministic Site Potential direction. This branch is not production until merged and published, and its runtime behavior must be verified separately.

## Current MVP acceptance test

A real signed-in user must be able to:

1. Sign in and retain a session.
2. Find/open Erf 1570 and later reopen the same investigation.
3. Establish or review the working address with honest provider failure behavior.
4. Upload/bind/read SG evidence and see extracted findings plus a safe preview when available.
5. Establish and persist working zoning with clear user-confirmed versus municipal-evidence distinction.
6. Complete property checks, Market Evidence and a Strategy scenario with persistence.
7. Accept or skip the deterministic Site Potential envelope/build-line step without generated concepts.
8. Open the living Easy Erf Report and see the same evidence, assumptions, provenance, risks, unknowns and canonical next action.
9. For the commercial MVP, purchase or otherwise enter the R999 Early Access fulfillment path only through a real verified checkout and receive the promised human-reviewed investigation.

Repository tests, database rows and isolated APIs are not substitutes for this end-to-end acceptance test.

## Current verified weaknesses / blockers

- The complete current published browser journey has not been independently re-run in this 2026-08-28 inspection, so full end-to-end production acceptance is still unverified.
- The current saved Erf 1570 durable projection still contains legacy Site Potential fields such as `concepts_ready` in historical state. Active runtime semantics have changed, so this projection is compatibility debt that should be normalized only if it creates a real user-facing defect.
- The R999 offer is being restored in a repository branch, but a real Easy Erf R999 Stripe-hosted checkout has not been verified in this tranche. The UI must remain disabled when the environment variable is absent or invalid.
- Parcel-specific municipal zoning evidence remains weaker than the general Kouga scheme rules. User-confirmed RES1 is not municipal verification.
- Provider availability and external source coverage remain external dependencies. Missing evidence must remain visible.

## Single highest-value next action

Verify and merge the narrow R999/product-truth restoration, then run the canonical signed-in Erf 1570 browser journey from search through report against the current published runtime. Fix only defects found in that real path before adding broader features.

## Spend

Additional discretionary spend for this tranche: $0.

No Lovable build work, paid service, production deployment, database mutation, credential change or billing action is authorized by this state document.
