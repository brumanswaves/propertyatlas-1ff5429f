# Easy Erf Current Release Contract

Release ID: `EE-R999-01`
Contract status: **FROZEN**
Effective date: 2026-09-03
Canonical repository: `brumanswaves/propertyatlas-1ff5429f`
Merged product baseline: `6078395dab2eadaf9661df53937a53268a9631ff`
Frozen implementation baseline: PR #161 at `5987cb23acfb71c962bc249b0a2067dcfaf6d7a8` before this contract-only commit
Designated active release branch: `release/ee-r999-01`
Sole active implementation PR: `#161`

## Release promise

Prepare the R999 human-reviewed property-investigation flow for safe release by combining the merged founder-only read-only launch preflight with the stateful founder investigation checklist. The release must prevent delivery while any applicable investigation area is missing, pending, or blocked.

## Included source

- Merged PR #160 founder-only, read-only R999 launch preflight.
- PR #161 standard investigation checklist with stable items and explicit `pending`, `complete`, `blocked`, and `not_applicable` states.
- Backward-compatible checklist persistence inside existing structured review content.
- Preservation of report content when checklist state is saved, and preservation of checklist state when reviewed report content is saved.
- Edge Function and database contract that block `mark_ready` when required checklist items are unresolved.
- Focused TypeScript, Deno, and isolated PostgreSQL proof included in PR #161.

## Product boundaries

- Checklist state is operational workflow metadata only.
- Property facts, evidence, provenance, conflicts, calculations, Site Potential, and report findings remain in their canonical systems.
- Active Site Potential remains deterministic parcel/map and street-side build-envelope output. Generated house concepts, rendered buildings, facade concepts, and AI architectural images are excluded.
- No competing evidence model, checklist notes system, or new product scope is included.

## Explicitly excluded

- Any feature outside PR #160 and PR #161.
- Merge of PR #161 or other product code.
- Migration application, Edge Function deployment, production-data mutation, or customer-order mutation.
- Stripe configuration, real checkout, payment, refund, live-mode or arming change.
- Preview, publication, production deployment, DNS change, advertising, or customer contact.
- Secret changes, billing changes, Lovable implementation, or Vercel use.

## Acceptance evidence required before a later release action

1. The exact PR #161 candidate receives inspected repository CI, typecheck, tests, production build, and migration-contract evidence.
2. Review confirms the checklist does not create a competing evidence or property-fact authority.
3. Isolated database proof establishes that missing, pending, or blocked applicable items prevent delivery and that all-resolved items permit the intended transition.
4. After separately approved migration and deployment actions, authenticated browser acceptance proves founder save/reload behavior and delivery blocking against a real R999 order.
5. The signed-in Erf 1570 investigation and living report remain coherent with the checklist and existing canonical next action.
6. Any merge, migration, deploy, publish, real checkout, or production acceptance action receives a separate Class B or Class C owner approval naming the exact candidate and rollback boundary.

## Current blockers

- PR #161 remains draft and unmerged.
- Exact-head CI, final review, and merge acceptance must be inspected after the contract-only commit.
- Migration application and deployed enforcement are not authorized by Portfolio Execution Reset V1.
- Real signed-in browser acceptance, real R999 checkout, and production publication remain unverified and outside this reset.

## Approval classes

- **Class A:** $0, reversible, source-only work inside the frozen scope may continue without repeated approval.
- **Class B:** product-code merge, preview, deploy, publish, additive migration, or bounded production acceptance requires explicit packet-specific owner approval.
- **Class C:** money, billing, secrets, DNS, advertising, customer contact, destructive production changes, credentials, Lovable implementation, or any Vercel use requires separate explicit owner approval and cannot be inferred from Class A or Class B authority.

## Branch authority

`release/ee-r999-01` is the only active release branch for this contract. Other implementation or historical branches are not release authority.

## Change control

Any scope addition, product-baseline replacement, active-PR replacement, or release-branch replacement requires an explicit superseding contract entry. Tests, commits, or agent reports do not expand this release contract.

## Spend

Maximum additional discretionary spend under this contract: **$0**.
