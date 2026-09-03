# Easy Erf Current Release Contract

Release ID: `EE-R999-01`
Contract status: **ACTIVE RELEASE GATE, CLASS B PACKET PREPARED**
Effective date: 2026-09-03
Canonical repository: `brumanswaves/propertyatlas-1ff5429f`
Canonical Supabase project: `xiqpfhsdlvwrwhclonsg`
Canonical Lovable publisher project: `8680b46b-3325-4395-9767-a8c0ae2a3a50`
Current GitHub main before PR #161: `4c3ad41165db3ac19314b3aa42e89dbd1bae2534`
Merged launch-readiness baseline: PR #160, merge commit `6078395dab2eadaf9661df53937a53268a9631ff`
Sole active implementation PR: `#161`
Active implementation branch: `chatgpt/founder-investigation-checklist-state`
Prepared release packet: `docs/EE-R999-01_RELEASE_PACKET.md`

## Release promise

Prepare the R999 human-reviewed property-investigation flow for safe release by combining the merged founder-only launch preflight with the stateful founder investigation checklist. The release must prevent delivery while any applicable investigation area is missing, pending, or blocked.

## Included source

- Merged PR #160 founder-only, read-only R999 launch preflight.
- PR #161 standard investigation checklist with nine stable items and explicit `pending`, `complete`, `blocked`, and `not_applicable` states.
- Backward-compatible checklist persistence inside existing structured review content.
- Preservation of report content when checklist state is saved, and preservation of checklist state when reviewed report content is saved.
- Edge Function validation that blocks delivery and optional PDF upload until the structured report and checklist are resolved.
- Database enforcement that blocks ready or complete delivery states when the report or checklist is unresolved.
- Focused TypeScript, Deno, full-suite, production-build, lint, whitespace, and isolated PostgreSQL proof.

## Verified source evidence

For the product candidate preceding this release-document update, the inspected exact-head workflows established:

- Stripe and Human Review Edge Function type checks succeeded.
- Focused payment and fulfillment guardrails succeeded.
- Full repository tests succeeded.
- Founder fulfillment migration proof succeeded in isolated PostgreSQL.
- Human Review migration proof succeeded in isolated PostgreSQL.
- Production bundle and generated routes succeeded.
- TypeScript, changed-file lint, and patch-whitespace checks succeeded.
- Public browser acceptance ran without invoking live checkout.

The final release-document head must receive clean exact-head workflows before any owner merge approval is used.

## Verified production baseline

- The new migration `20260903111500_require_resolved_founder_investigation_checklist.sql` is not applied in canonical production.
- The function `easy-erf-founder-launch-readiness` is not deployed in canonical production.
- Current production function baselines are:
  - `easy-erf-founder-fulfillment`, version 4, hash `14c39b18d23b522e01298ad317f69d80a62dca468b02b023f226208d38f3c277`.
  - `easy-erf-founder-report-upload`, version 1, hash `a8a660fdc46268199b332e764137656e69a5c29dfd27a30244be419b19eae620`.
  - `easy-erf-founder-review-content`, version 1, hash `2d88117fd33c3b930305526931deadc54a92dc09949faee935735e13c2af64f1`.
- The current published Lovable project is connected to the Easy Erf project and reports source based on current main before PR #161.

## Product boundaries

- Checklist state is operational workflow metadata only.
- Property facts, evidence, provenance, conflicts, calculations, Site Potential, and report findings remain in their canonical systems.
- Active Site Potential remains deterministic parcel/map and street-side build-envelope output.
- Generated house concepts, rendered buildings, facade concepts, and AI architectural images are excluded.
- No competing evidence model, checklist notes system, or new product scope is included.

## Current release stages

1. Source acceptance and final exact-head CI.
2. One Class B approval for the exact PR head, merge, additive migration, named function deployments, exact-source publication, read-only launch preflight, and bounded authenticated checklist acceptance.
3. A later separate Class C approval for any live R999 charge, Stripe mutation, secret change, customer communication, or money movement.

## Current blockers

- PR #161 remains draft and unmerged.
- Final exact-head workflows must succeed after the release packet and contract are committed.
- The migration and four required Edge Function deployments are not authorized yet.
- Exact-source frontend publication is not authorized yet.
- Authenticated production save, reload, blocked-delivery, and resolved-delivery behavior remain unverified.
- Stripe business-profile correction, signing-secret equivalence, live checkout arming, and a real R999 purchase remain outside this Class B packet.

## Approval classes

- **Class A:** $0, reversible, source-only work, review, tests, CI, documentation, read-only production inspection, and release-packet preparation may continue without repeated approval.
- **Class B:** merge of the exact PR head, additive migration, named Edge Function deployments, exact-source publication, read-only preflight, and bounded non-payment production acceptance require one packet-specific approval.
- **Class C:** real payment, money, billing, Stripe mutation, secrets, DNS, advertising, customer contact, destructive production changes, credentials, Lovable implementation, or any Vercel use require separate explicit approval.

## Change control

Any source, migration, function, publisher, project identity, production action, or acceptance expansion beyond the prepared packet invalidates the approval request. A passing CI run does not prove the live R999 customer journey.

## Spend

- Maximum additional discretionary spend for the prepared Class B packet: **$0**.
- Live R999 charge authorized: **no**.
- Advertising spend authorized: **$0**.
- Existing GitHub Actions, Supabase, and Lovable metering: **UNKNOWN**.
