# Easy Erf Class B Release Packet

Release ID: `EE-R999-01`
Packet state: **PREPARED, NOT AUTHORIZED**
Prepared date: 2026-09-03
Canonical repository: `brumanswaves/propertyatlas-1ff5429f`
Canonical Supabase project: `xiqpfhsdlvwrwhclonsg`
Canonical Lovable publisher project: `8680b46b-3325-4395-9767-a8c0ae2a3a50`
Sole implementation pull request: `#161`
Current production frontend baseline before this release: GitHub main `4c3ad41165db3ac19314b3aa42e89dbd1bae2534`
Bounded owner TEST order: `3ebe9357-8ec1-45aa-ba4c-68412f0ee656`

## WHAT I NEED FROM YOU NOW

Do not approve this packet until the final PR #161 head and its exact-head workflows are reported clean in the control-room approval request.

## Plain-English purpose

Install the founder investigation checklist, make the database refuse unfinished reports, publish the matching founder screens, and prove the behavior on one existing owner-only TEST order for Erf 1570. This packet does not enable live checkout or charge R999.

## Verified pre-release facts

- The named acceptance order is TEST mode, belongs to the owner email, references Erf 1570, and is currently in `paid` state.
- The production database does not contain migration `20260903111500_require_resolved_founder_investigation_checklist`.
- The production database does not currently contain the new checklist-enforcement trigger or function.
- `easy-erf-founder-launch-readiness` is not currently deployed.
- Current production function rollback baselines are:
  - `easy-erf-founder-fulfillment`, version 4, hash `14c39b18d23b522e01298ad317f69d80a62dca468b02b023f226208d38f3c277`.
  - `easy-erf-founder-report-upload`, version 1, hash `a8a660fdc46268199b332e764137656e69a5c29dfd27a30244be419b19eae620`.
  - `easy-erf-founder-review-content`, version 1, hash `2d88117fd33c3b930305526931deadc54a92dc09949faee935735e13c2af64f1`.
- The source candidate has clean inspected product, migration, Deno, focused-test, full-test, build, TypeScript, lint, and whitespace evidence before the final release-document commits.

## Class B actions proposed after exact-head owner approval

### 1. Freeze and merge the exact source

1. Re-read PR #161 immediately before merge.
2. Refuse execution if its head differs from the SHA named in the owner approval.
3. Confirm all required exact-head workflows are successful.
4. Confirm the diff remains limited to the founder checklist, its guardrails, one additive migration, release documentation, and governance already present on current main.
5. Mark the PR ready and merge only the exact approved head.
6. Inspect post-merge workflows and stop if any required check fails.

### 2. Apply one additive database safety rule

Apply only:

`supabase/migrations/20260903111500_require_resolved_founder_investigation_checklist.sql`

Plain-English effect:

- An Easy Erf R999 report cannot be marked ready or complete unless the structured report is complete.
- All nine standard investigation items must be `complete` or `not_applicable`.
- `pending`, `blocked`, missing, malformed, or incomplete checklist data keeps the report from being delivered.

No existing row is rewritten by the migration itself.

### 3. Deploy only four named authenticated functions

Deploy from the exact accepted post-merge source:

1. `easy-erf-founder-launch-readiness`, `verify_jwt=true`.
2. `easy-erf-founder-fulfillment`, `verify_jwt=true`.
3. `easy-erf-founder-report-upload`, `verify_jwt=true`.
4. `easy-erf-founder-review-content`, `verify_jwt=true`.

Do not deploy any other Edge Function.

### 4. Publish the exact accepted frontend

Use only the passive publish action for Lovable project `8680b46b-3325-4395-9767-a8c0ae2a3a50`.

Do not send a Lovable agent message, implementation request, debugging request, plan-mode request, or source-generation request.

After publication:

1. Confirm GitHub `main` did not advance unexpectedly.
2. Confirm the published project reports the accepted post-merge source.
3. Stop if the publisher adds, edits, or merges source.

### 5. Run the founder launch-readiness inspection

While live checkout remains disarmed, open the authenticated founder route:

`/admin/launch-readiness`

Inspect only safe status signals for:

- runtime mode;
- checkout arming state;
- Stripe key mode;
- R999 Payment Link amount and status;
- return URL;
- webhook-secret presence;
- required webhook endpoint and events;
- Stripe account capability;
- Easy Erf business-profile identity.

The read-only inspection may report that webhook signing-secret equivalence is `not_verified`. It must not expose any secret value or mutate Stripe or Supabase.

### 6. Run one bounded authenticated checklist acceptance

Use only order:

`3ebe9357-8ec1-45aa-ba4c-68412f0ee656`

Before changing it, re-verify that:

- `livemode=false`;
- it belongs to the owner email;
- it references Erf 1570;
- its state is still `paid`;
- no other customer or order will be affected.

Then perform this one flow:

1. Start the founder review.
2. Save a valid structured report.
3. Save the nine-item checklist with at least one item still `pending` or `blocked`.
4. Reload the page and verify both the report and checklist persisted.
5. Attempt to mark the report ready.
6. Verify delivery is refused and the order remains in review.
7. Change every item to `complete` or `not_applicable`.
8. Reload again and verify the resolved checklist persisted without erasing the report.
9. Mark the report ready.
10. Verify the order becomes ready or complete.
11. Verify the owner can open the finished report from the signed-in account.
12. Stop after this one order. Do not create another test order and do not retry automatically.

If marking ready triggers an email, the recipient must be the owner email only. Stop if any different address would receive a message.

## Acceptance conditions

This Class B release passes only if:

- the exact approved PR head is merged;
- post-merge workflows succeed;
- the one named migration is present in canonical production;
- the four named functions are active from the accepted source;
- the frontend publication matches the accepted source;
- GitHub does not advance unexpectedly;
- launch readiness is reachable only to the founder and performs no writes;
- unresolved checklist state blocks delivery;
- resolved checklist state permits delivery;
- report and checklist content survive save and reload;
- the owner can reopen the finished TEST report;
- no live payment, Stripe mutation, secret change, external customer contact, or unapproved spend occurs.

## Stop conditions

Stop without further action if:

- PR #161 head differs from the approved SHA;
- any required workflow fails;
- any additional migration or function would be needed;
- the canonical Supabase or Lovable project identity differs;
- checkout is armed or the named order reports `livemode=true`;
- the named order is not owned by the owner email or no longer references Erf 1570;
- any order other than the named TEST order would change;
- a secret value would be exposed;
- the publisher modifies GitHub source;
- any action would charge money, mutate Stripe, contact an external customer, change DNS, use Vercel, or use Lovable for implementation;
- any incremental paid service or discretionary spend would be required.

## Rollback

### Database rollback

The enforcement function and trigger did not exist before this release. If rollback is required, apply one explicit rollback migration that:

1. Drops trigger `enforce_easy_erf_review_delivery_readiness` from `public.report_orders`.
2. Drops function `public.enforce_easy_erf_review_delivery_readiness()`.

Do not roll back any unrelated migration.

### Edge Function rollback

Redeploy the three prior function sources from pre-release GitHub main `4c3ad41165db3ac19314b3aa42e89dbd1bae2534`:

- `easy-erf-founder-fulfillment`;
- `easy-erf-founder-report-upload`;
- `easy-erf-founder-review-content`.

The new launch-readiness function is authenticated, founder-only, and read-only. If exact function deletion is unavailable, restore the prior frontend so the route is not exposed and leave the function dormant until a separately authorized removal method is available.

### Frontend rollback

Passively republish pre-release source `4c3ad41165db3ac19314b3aa42e89dbd1bae2534`. Do not edit source inside Lovable.

### TEST order boundary

The named owner TEST order may end in `processing` or `ready` if acceptance stops. Do not alter any other order to compensate. Record its final state and prepare a focused cleanup proposal only if needed.

## Explicitly prohibited

This packet does not authorize:

- live checkout arming;
- a real R999 charge;
- Stripe business-profile, Payment Link, webhook, price, account, or billing mutation;
- secret or credential changes;
- DNS changes;
- advertising;
- external customer contact;
- any production order other than the named owner TEST order;
- new product scope;
- any additional PR merge;
- any additional migration or Edge Function deployment;
- Lovable implementation, debugging, agent chat, or plan mode;
- Vercel;
- discretionary spend.

## Spend

- Expected additional discretionary spend: **$0**.
- Maximum additional discretionary spend: **$0**.
- Live payment authorized: **no**.
- Recurring spend enabled: **none**.
- Existing GitHub Actions, Supabase, Lovable hosting, and owner-test email metering: **UNKNOWN**.

## What remains unverified

- The final PR #161 exact head after this packet is committed.
- Final exact-head and post-merge CI.
- Production migration and function deployment behavior.
- Exact-source publication behavior.
- Authenticated browser save, reload, block, complete, and reopen behavior.
- Stripe business-profile correctness and webhook signing-secret equivalence.
- A real live R999 payment and customer fulfillment journey.
