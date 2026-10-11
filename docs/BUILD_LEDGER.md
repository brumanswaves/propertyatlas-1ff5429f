# Easy Erf Build Ledger

Ledger refreshed: 2026-08-28.

## Source-only R999 readiness quantity repair — 2026-10-11

- VERIFIED base: fetched canonical `main` at `a385b7ab99480a42209be513c2abddb764d9ae15` (PR #206). Candidate branch: `codex/readiness-line-item-quantity`; final revision is recorded in the review handoff.
- EXECUTED by Codex through local shell tools: forward `item.quantity` in `easy-erf-founder-launch-readiness/index.ts`. The readiness helper and checkout's independent quantity validation are unchanged.
- VERIFIED regression runs the actual endpoint in the existing VM harness with isolated Supabase/Stripe doubles. Quantity 1 passes the payment-link check; 0, 2, -1, 1.5, null and undefined fail. The new valid-one case failed before the repair (27 passed, 1 failed). After repair all 136 payment tests across 13 files pass. TypeScript `--noEmit`, changed-source ESLint, whitespace and ordinary non-deploying production build pass. Deno 2.9.6 type checks pass for readiness, checkout and webhook (binary SHA-256 matches the repository workflow).
- VERIFIED governance: `AGENTS.md`, `BUILD_GOVERNANCE.md`, current state and relevant Master Plan read. `PROJECT_BRIEF.md` and repository `.agents/skills` are absent; no substitute governance was invented.
- Review: one production line added; no price, amount, mode, redirect, authorization or runtime checkout validation relaxed. Tests exercise the endpoint mapping rather than only the helper. Independent review remains pending.
- BLOCKED draft-PR discovery: GitHub GraphQL and REST pull-list requests return `Forbidden`. A local draft review packet is prepared; no merge or deploy authorized.
- No Stripe API calls, real checkout/readiness requests, customer writes, property document reads, provider/model calls, payments, production or credential changes. Both excluded assets and derivatives remain untouched. Additional discretionary service spend $0; platform task credit cost UNKNOWN. Existing USD2 allowance unused by this task.
- Live readiness, signature binding and real R999 acceptance remain UNKNOWN. Parent owns independent review and deployment coordination; owner performs a real R999 test only after parent confirms readiness. This receipt proves offline source behavior only.

## Original product promise

Make one real South African property investigation work extremely well end to end. Easy Erf should help a user identify a property, organize trustworthy evidence, understand planning and development potential, test strategy and financial assumptions, identify unknowns and risks, and leave with one clear next action.

The immediate commercial proof is the first real **R999 Early Access Easy Erf Property Investigation** for one property, fulfilled with the canonical Easy Erf investigation plus human review rather than waiting for complete automation.

## Canonical systems

- Application code: GitHub `brumanswaves/propertyatlas-1ff5429f`, branch `main`.
- Product direction: `docs/EASY_ERF_MASTER_PLAN.md` plus explicit owner decisions recorded in current project state.
- Operational state: `docs/EASY_ERF_CURRENT_STATE.md`.
- Canonical remote backend: founder-owned Supabase project `xiqpfhsdlvwrwhclonsg` (`Easy Erf`).
- Local Supabase config: `supabase/config.toml` is local-stack configuration only and is not remote ownership proof.
- Erf 1570 is the canonical end-to-end acceptance property.

## Current repository baseline

Verified before this tranche:

- GitHub `main` at `6030b4b2071fc86059ce07095350438eaa9192e9`.
- No open pull requests at the start of the 2026-08-28 inspection.
- PR #127 merged the deterministic parcel/map plus street-side Site Potential direction.
- PR #128 removed retired generated-concept semantics from the active runtime.

The current implementation branch is `chatgpt/restore-commercial-mvp-and-project-truth`. It is not production merely because commits exist on the branch.

## Locked active Site Potential direction

The active MVP Site Potential surface is:

`parcel/map build envelope -> street-side build lines / height envelope -> explicit accept or skip -> same state in Guided and Report`

Active Site Potential does not generate house concepts, rendered buildings, facade concepts or AI architectural images. Historical generated-design assets, tables and fields may remain for compatibility, but they do not define the active user journey.

A deterministic envelope remains only as authoritative as the zoning, building lines, coverage, height, frontage and geometry evidence beneath it.

## Current commercial MVP

Offer:

- **R999** introductory price.
- **One property**.
- Human-assisted and human-reviewed Easy Erf Property Investigation.
- Uses the same canonical property file, public/official sources, uploaded evidence, deterministic analysis, AI-assisted research where configured, and human review.
- Deliverable emphasis: Property Truth, Property Potential, deal killers/key risks, conflicts, unknowns, next steps, and Strategy/financial analysis where relevant.
- No recurring subscription.
- Not a zoning certificate, legal/title opinion, valuation, approved building plan or professional sign-off.
- Checkout must fail closed unless a verified HTTPS Stripe-hosted `buy.stripe.com` payment link is configured.

At the start of this tranche, this offer was absent from `main`. The prior implementation existed only in closed, unmerged PR #107.

## Current MVP acceptance test

A signed-in user must be able to complete and later reopen the canonical Erf 1570 investigation against the founder backend:

1. Sign in and retain the session.
2. Search/open Erf 1570 and reopen durable investigation state.
3. Establish/review working address with visible provider failures.
4. Upload/bind/read SG evidence and see extracted findings plus a safe preview when available.
5. Establish and persist working zoning while preserving the distinction between user confirmation and municipal evidence.
6. Complete property checks, Market Evidence and Strategy persistence.
7. Complete or skip deterministic Site Potential using the parcel/map and street-side build envelope, without generated concepts.
8. Open the living Easy Erf Report with the same evidence, provenance, assumptions, risks, unknowns and canonical next action.
9. For commercial acceptance, enter the R999 Early Access fulfillment path through a real verified checkout and receive the promised human-reviewed investigation.

Repository tests, database rows, commits and isolated API success do not satisfy this acceptance test by themselves.

## Live founder-backend evidence checked 2026-08-28

Read-only inspection established:

- Supabase project `xiqpfhsdlvwrwhclonsg` reports `ACTIVE_HEALTHY`.
- `extract-erf-asset` version 11 is active.
- `site-potential-api` version 8 is active.
- `render-sg-preview` version 1 is active with JWT verification enabled.
- The checked deployed `render-sg-preview` implementation is deterministic TIFF-to-PNG processing and contains no AI-provider call.
- Newest checked canonical Erf 1570 SG TIFF: 17 extracted claims and a persisted `sgPreviewStoragePath` PNG.
- That asset carries `identityBinding = user_confirmed` for canonical Erf 1570.
- Its automated `identityMatchStatus` remains `unverified`; the user-confirmed binding is evidence attachment, not independent cadastral verification.

These facts establish backend progress on the SG visual/report-support path. They do not independently prove that the current published browser report renders the preview correctly.

## Current saved-state observation

The current Erf 1570 saved-investigation projection still contains historical Site Potential fields such as `progressState: concepts_ready` on one record. This is legacy persisted state from the retired generation flow.

Current classification: compatibility debt. It becomes a defect only if the active UI/report interprets that legacy state incorrectly after PR #128. Do not rewrite production state preemptively without a reproduced user-facing problem.

## Current tranche executed

On branch `chatgpt/restore-commercial-mvp-and-project-truth`:

- Pricing restores the R999 one-property human-reviewed Early Access investigation.
- Checkout remains disabled unless a valid Stripe-hosted HTTPS payment link is configured.
- Pricing removes stale active Site Potential concept-generation language and states the deterministic map/street-side build-envelope direction.
- Public product-truth tests now guard the R999 offer, fail-closed checkout and no-generated-concept Site Potential copy.
- `docs/EASY_ERF_CURRENT_STATE.md` and this ledger are refreshed from current repository and live-backend evidence.

These branch changes still require CI/build verification and review before merge acceptance.

## Current blocker

The repository has materially more capability than the currently verified product acceptance evidence.

The single largest remaining proof gap is a fresh, real signed-in browser run of the current published Easy Erf journey from Erf 1570 search through the living report after the latest Site Potential and SG changes.

A second commercial gap remains until a real R999 checkout is configured and verified. The code must not invent that checkout.

## Next action

Complete repository verification for the current R999/product-truth branch, merge only if the evidence is clean, then perform the real signed-in Erf 1570 production acceptance run and fix defects found in that path before starting broader features.

## Owner action required

None for the current zero-cost repository verification tranche.

A later real payment-link activation or production publication may require explicit owner action/approval depending on the system being changed.

## Spend

Additional discretionary spend for this 2026-08-28 tranche: **$0**.

No Lovable build action, paid provider, database mutation, billing change, credential change or production publish has been performed in this tranche.
