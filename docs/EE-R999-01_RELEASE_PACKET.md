# EE-R999-01 Automatic Report Email Release Packet

Release ID: `EE-R999-01`
Packet revision: `EE-R999-01-RP-AUTO-EMAIL-01`
Packet state: **CLASS A PREPARATION, NOT AUTHORIZED FOR RELEASE**
Prepared date: 2026-09-04
Canonical repository: `brumanswaves/propertyatlas-1ff5429f`
Canonical Supabase project: `xiqpfhsdlvwrwhclonsg`
Canonical passive publisher project: `8680b46b-3325-4395-9767-a8c0ae2a3a50`
Current production GitHub main: `3289cec346d5e84d971340a1297f32f070b08417`
Release candidate: PR `#164`
Release branch: `chatgpt/ee-r999-automatic-report-email`
Final approval SHA: **to be frozen after exact-head checks are clean**
Owner TEST order: `384be2fe-f7aa-4687-970c-5a6db34cfeba`

## Frozen acceptance outcome

The commercial release remains accepted only when one genuine R999 investigation completes:

`confirmed property -> verified Stripe payment -> correct customer and parcel order -> founder investigation -> evidence-backed report -> automatic customer email -> customer opens the exact report`

This packet addresses the automatic notification portion and prepares one owner-only TEST acceptance. It does not authorize the genuine live R999 charge.

## Product outcome

After the founder completes a report and clicks **Mark web report ready**:

1. the existing ready transition completes;
2. Easy Erf automatically submits a branded report-ready email to the canonical order customer;
3. the email contains a deep link to `/orders?report=<order-id>`;
4. Easy Erf records the provider result against the exact delivered report version;
5. a failed attempt is visible and can be retried from the delivered order;
6. no manual prepare, copy, send, checkbox, or receipt-recording workflow remains.

## Exact source scope

### Pull request

- PR: `#164`
- Branch: `chatgpt/ee-r999-automatic-report-email`
- Exact head: to be stated in the release approval after final CI and review
- Base: current main `3289cec346d5e84d971340a1297f32f070b08417`

### Migration included

`supabase/migrations/20260904114500_automatic_report_ready_email.sql`

Purpose:

- retire the manual receipt RPC;
- add service-role-only `record_easy_erf_customer_email_attempt`;
- bind receipts to the exact ready report version;
- verify founder-admin actor, canonical customer email, structured report, and resolved checklist;
- record `sent` or `failed` provider outcomes;
- preserve report content;
- keep success idempotent for the same report version;
- clear the previous notification receipt when the report is reopened.

### Edge Functions included

1. `easy-erf-founder-customer-notification`
   - `verify_jwt=true`
   - resolves the recipient from the order owner;
   - validates the exact ready report and checklist;
   - submits HTML and text email through Resend;
   - uses an order and report-version idempotency key;
   - records provider success or failure.

2. `easy-erf-founder-fulfillment`
   - `verify_jwt=true`
   - preserves the existing readiness and transition controls;
   - invokes the customer-notification function only after a successful `mark_ready` transition;
   - returns notification outcome separately from report-delivery outcome.

### Frontend publication included

The exact merged source is to be passively published through Lovable project:

`8680b46b-3325-4395-9767-a8c0ae2a3a50`

Lovable is publisher only. No Lovable implementation, debugging, planning, or source generation is included.

### Configuration changes included

The later release approval must explicitly authorize only these canonical Supabase secrets or environment values:

- `RESEND_API_KEY`
- `EASY_ERF_REPORT_FROM_EMAIL`
- optional `EASY_ERF_REPORT_REPLY_TO`
- `EASY_ERF_APP_URL=https://easyerf.co.za`
- `EASY_ERF_CUSTOMER_EMAIL_ENABLED=true`

The enable flag remains false or unset until controlled acceptance begins.

## Email-provider boundary

Proposed provider: **Resend**.

Expected discretionary cost for the owner-only TEST and initial low-volume release: **$0**, subject to the provider's current free-plan limits and domain-verification requirements.

Maximum additional discretionary spend under this packet: **$0**.

Stop if:

- a paid plan is required;
- DNS verification incurs a fee;
- provider usage would exceed the free allowance;
- another email provider or paid service becomes necessary.

Cheaper alternative: manual founder email. It was rejected because it adds unnecessary operational steps and does not match the desired admin workflow.

## Canonical production baseline

Before this candidate:

- GitHub main is `3289cec346d5e84d971340a1297f32f070b08417`.
- The founder fulfillment route is reachable in production.
- Manual notification migration `20260904090724_record_manual_report_notification` is applied.
- `easy-erf-founder-customer-notification` is active as version 1.
- `easy-erf-founder-fulfillment` is active as version 5.
- The automatic-email migration is not applied.
- The automatic-email function versions are not deployed.
- The PR #164 frontend is not published.
- Automatic customer email is not enabled.

## Owner-only acceptance identity

Use only:

- Order: `384be2fe-f7aa-4687-970c-5a6db34cfeba`
- Property: Erf 1570, 24 Padrone Crescent, St Francis Bay
- Parcel: `csg:lpi:c03400140000157000000`
- Customer: founder-owned Easy Erf account
- Mode: Stripe TEST

Stop if any identity differs or if another order would change.

## Proposed release actions

These actions require one later exact owner approval.

### 1. Freeze and merge

1. Confirm PR #164 remains open, draft, mergeable, and based on current main.
2. Confirm its exact head equals the approval SHA.
3. Confirm every required exact-head workflow concluded successfully.
4. Inspect the final changed-file set and review threads.
5. Mark only PR #164 ready for review.
6. Merge only the exact approved head.
7. Verify the resulting main SHA and tree.

### 2. Apply one migration

Apply only:

`supabase/migrations/20260904114500_automatic_report_ready_email.sql`

Then verify:

- it is recorded once;
- the manual receipt RPC is absent;
- the automatic attempt RPC exists;
- public, anon, and authenticated roles cannot execute it;
- service role can execute it;
- no other migration was applied;
- no report order changed merely because the migration was applied.

### 3. Configure the free email path

1. Use the approved Resend account.
2. Verify an Easy Erf sender domain or subdomain.
3. Create one restricted sending API key.
4. Save it only as `RESEND_API_KEY` in Supabase project `xiqpfhsdlvwrwhclonsg`.
5. Save the approved Easy Erf sender address as `EASY_ERF_REPORT_FROM_EMAIL`.
6. Save the optional reply-to address if approved.
7. Save `EASY_ERF_APP_URL=https://easyerf.co.za`.
8. Keep `EASY_ERF_CUSTOMER_EMAIL_ENABLED` false or unset.

Do not expose any key or DNS token in chat, source, screenshots, or logs.

### 4. Deploy two functions

Deploy only the accepted merged versions of:

- `easy-erf-founder-customer-notification`, `verify_jwt=true`;
- `easy-erf-founder-fulfillment`, `verify_jwt=true`.

Verify deployed source hashes and versions against the merged source. No other function may be deployed.

### 5. Publish the exact frontend

Passively publish only the exact merged main revision through the canonical Lovable project. Verify:

- `/admin/fulfillment` still renders the investigation queue;
- the manual email workflow is absent;
- delivered orders show automatic email status and exceptional retry behavior;
- signed-out and non-admin users cannot access founder controls;
- no Lovable-generated source change occurred.

### 6. Controlled owner-only TEST acceptance

1. Re-verify the exact TEST order, property, parcel, customer, report, checklist, and absence of an automatic receipt.
2. Set `EASY_ERF_CUSTOMER_EMAIL_ENABLED=true` only within the approved acceptance boundary.
3. Reopen the exact owner TEST report.
4. Redeliver it once by marking it ready.
5. Verify the report transition completed.
6. Verify one email submission was attempted automatically without another admin click.
7. Verify the canonical owner email, exact property, and exact report link were used.
8. Verify a success receipt contains:
   - `status=sent`;
   - `channel=automatic_email`;
   - `provider=resend`;
   - canonical recipient;
   - exact report version;
   - provider message ID;
   - attempted and sent timestamps;
   - founder sender ID.
9. Verify exactly one `customer_notified` event exists for that report version.
10. Invoke the retry path once and verify it returns the existing receipt without another event or provider send.
11. Verify the owner receives the email.
12. Open the email link and verify it opens the exact Erf 1570 report in the owner dashboard.
13. Set `EASY_ERF_CUSTOMER_EMAIL_ENABLED=false` immediately after acceptance unless continued operation is separately authorized.
14. Verify no other order, customer, report, payment, Stripe object, or secret changed.

A provider API success is only evidence that the provider accepted the message. Inbox receipt and report opening require separate evidence.

## Acceptance actions after TEST

Before automatic email remains enabled for real customers:

- verify the accepted sending domain;
- confirm the sender and reply-to presentation;
- inspect the email in desktop and mobile clients;
- verify no spam or phishing warning;
- verify the dashboard link preserves authentication and opens the correct order;
- define a visible failed-send operational queue or alert;
- confirm continued usage remains within the approved $0 provider tier.

## Rollback

1. Disable `EASY_ERF_CUSTOMER_EMAIL_ENABLED` first.
2. Preserve provider IDs, receipts, failure records, and audit events.
3. Restore the previous deployed versions:
   - `easy-erf-founder-customer-notification` version 1;
   - `easy-erf-founder-fulfillment` version 5.
4. Republish previous frontend main `3289cec346d5e84d971340a1297f32f070b08417` if required.
5. Do not down-migrate after any email attempt. Use an explicit reviewed forward repair or rollback migration.
6. Do not delete reports, customers, orders, payments, or notification evidence.

## Prohibited actions

This packet does not authorize:

- merging PR #164;
- applying the migration;
- deploying either function;
- publishing the frontend;
- creating or activating a paid Resend plan;
- saving or changing secrets;
- changing DNS;
- enabling automatic email;
- sending an email;
- contacting an external customer;
- live checkout arming;
- a genuine R999 charge;
- Stripe mutation;
- another PR, migration, function, provider, or feature;
- Lovable implementation;
- Vercel;
- destructive production work;
- discretionary spend above $0.

Those actions remain blocked until one exact consolidated release approval is issued.

## Spend

- Class A work executed: **$0 additional discretionary spend**.
- Expected owner-only TEST provider spend: **$0**.
- Maximum additional discretionary spend: **$0**.
- Paid plan or recurring spend authorized: **no**.
- Customer money movement authorized: **no**.
- Existing GitHub Actions, Supabase, hosting, DNS, and account metering: **UNKNOWN**.

## What remains unverified

Before release approval:

- final exact PR #164 SHA;
- clean exact-head workflow conclusions after all source and document changes;
- final code and security review;
- exact current Resend free-plan and domain-verification constraints;
- sender-domain choice and ownership.

Until production acceptance:

- production migration behavior;
- deployed function source equivalence;
- frontend publication equivalence;
- valid Resend API key and domain configuration;
- automatic provider submission;
- durable success and failure receipts;
- duplicate-send protection against the real provider;
- owner inbox receipt;
- exact report opening from the email;
- continued $0 provider operation;
- genuine live R999 end-to-end commercial acceptance.
