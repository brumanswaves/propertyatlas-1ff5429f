# Easy Erf Current Release Contract

Release ID: `EE-R999-01`
Contract status: **ACTIVE RELEASE GATE, AUTOMATIC EMAIL CANDIDATE IN CLASS A**
Effective date: 2026-09-04
Canonical repository: `brumanswaves/propertyatlas-1ff5429f`
Canonical Supabase project: `xiqpfhsdlvwrwhclonsg`
Canonical passive publisher project: `8680b46b-3325-4395-9767-a8c0ae2a3a50`
Current GitHub main: `3289cec346d5e84d971340a1297f32f070b08417`
Active implementation PR: `#164`
Active implementation branch: `chatgpt/ee-r999-automatic-report-email`
Prepared release packet: `docs/EE-R999-01_RELEASE_PACKET.md`
Bounded owner TEST order: `384be2fe-f7aa-4687-970c-5a6db34cfeba`

The approval SHA is the exact PR #164 head stated in the later release request after all exact-head checks and source review are clean. Any later head change invalidates that approval.

## Frozen release outcome

One genuine R999 Easy Erf Done-for-You Property Investigation must complete this journey:

`exact property -> verified payment -> correct customer and parcel order -> founder investigation -> evidence-backed report -> automatic customer email -> customer opens the exact report`

The release is not accepted until the complete commercial journey is independently verified. Source checks, a migration, an email-provider response, or a published frontend are not substitutes for that outcome.

## Product correction in PR #164

The retired manual workflow required the founder to prepare, copy, send, confirm, and separately record an email after a report was finished. That is not the intended operating model.

The target workflow is:

1. Founder completes the investigation and report.
2. Founder marks the report ready once.
3. Easy Erf submits a branded transactional email automatically to the canonical order customer.
4. The email links directly to the exact report in the customer's authenticated dashboard.
5. Easy Erf records success or failure against that exact delivered report version.
6. A failed send leaves one recovery retry control. Normal delivery requires no separate notification work.

## Included source boundary

PR #164 is limited to the frozen customer journey and includes:

- automatic report-ready email submission after the successful ready transition;
- server-side recipient resolution from the order owner, never from browser input;
- ready-report, structured-report, resolved-checklist, property, and report-version validation;
- branded HTML and text email with `/orders?report=<order-id>` deep link;
- disabled-by-default provider configuration;
- deterministic idempotency key for the exact order and delivered report version;
- durable success and failure receipts without changing the reviewed report body;
- one audit event for a successful customer notification and one failure event for a failed attempt;
- clearing the prior receipt when a report is reopened and redelivered;
- one exceptional retry control for failed or historical unsent reports;
- retirement of the manual prepare/copy/confirm/record workflow;
- isolated database proof, Deno checks, focused tests, full tests, build, TypeScript, lint, and whitespace verification.

## Canonical state before this candidate

### GitHub and frontend

- PR #163 was merged into current main `3289cec346d5e84d971340a1297f32f070b08417`.
- The founder fulfillment route is reachable in production and was confirmed by owner screenshots.
- Production still contains the manual notification UX and does not yet contain PR #164.

### Supabase

- Canonical project: `xiqpfhsdlvwrwhclonsg`.
- Manual notification migration `20260904090724_record_manual_report_notification` is applied.
- `easy-erf-founder-customer-notification` is active as version 1 with `verify_jwt=true`.
- `easy-erf-founder-fulfillment` is active as version 5 with `verify_jwt=true`.
- The automatic-email migration in PR #164 is not applied.
- The automatic-email function versions in PR #164 are not deployed.

### Acceptance order

Only order `384be2fe-f7aa-4687-970c-5a6db34cfeba` may be used for the owner-only TEST acceptance. It is associated with:

- Erf 1570;
- 24 Padrone Crescent, St Francis Bay;
- canonical parcel `csg:lpi:c03400140000157000000`;
- the founder-owned Easy Erf account;
- a completed structured report and resolved nine-item investigation checklist.

No other order may be substituted without a new verified packet.

## Required production configuration

Automatic email remains fail-closed until the following are separately approved, configured, and verified:

- transactional email provider: Resend;
- verified Easy Erf sending domain or subdomain;
- `RESEND_API_KEY` in canonical Supabase secrets;
- `EASY_ERF_REPORT_FROM_EMAIL` using the verified Easy Erf domain;
- optional `EASY_ERF_REPORT_REPLY_TO`;
- `EASY_ERF_APP_URL=https://easyerf.co.za`;
- `EASY_ERF_CUSTOMER_EMAIL_ENABLED=true` only for the controlled acceptance and later approved operation.

No secret value may appear in source, logs, screenshots, release documents, or chat.

## Release stages

### Class A, authorized now

- branch implementation;
- code and security review;
- focused and full tests;
- isolated migration proof;
- Deno, lint, TypeScript, build, and whitespace checks;
- read-only inspection;
- provider and DNS planning;
- release-packet preparation.

### Class B, requires one exact release approval

- merge PR #164 at one exact accepted SHA;
- apply only `supabase/migrations/20260904114500_automatic_report_ready_email.sql`;
- deploy only the accepted versions of:
  - `easy-erf-founder-customer-notification`;
  - `easy-erf-founder-fulfillment`;
- passively publish the exact merged frontend;
- create or configure the approved Resend sender without paid-plan activation;
- save the named secrets and configuration;
- run one owner-only TEST acceptance against the exact authorized order;
- temporarily enable automatic email only within the approved acceptance boundary.

### Class C, not authorized by the automatic-email packet

- live checkout arming;
- a genuine R999 charge;
- Stripe mutation;
- external customer contact;
- paid email plan or other discretionary spend;
- destructive database work;
- unrelated feature work.

## Acceptance requirements for automatic email

The owner-only TEST acceptance must establish:

1. The exact owner TEST order is reopened and redelivered once.
2. The ready transition submits one email automatically.
3. The provider accepts the exact recipient, subject, and dashboard link.
4. One sent receipt is persisted for the exact report version.
5. One matching `customer_notified` event is persisted.
6. Repeating the send path does not create a duplicate provider send or duplicate event.
7. The owner receives the email and opens the exact Erf 1570 report from its link.
8. No other order, customer, report, payment, or Stripe record changes.
9. The enable flag can be disabled immediately after acceptance.

A provider acceptance response is not proof that the message reached the inbox. Inbox receipt and report opening remain separate acceptance evidence.

## Stop conditions

Stop if:

- PR #164 head differs from the approved SHA;
- any required exact-head check fails or is cancelled;
- main advances unexpectedly;
- the repository, Supabase project, publisher project, migration, function, order, parcel, recipient, or report version differs;
- a paid email plan or nonzero discretionary spend is required;
- the sender domain cannot be verified safely;
- the email would be sent to an external customer during TEST acceptance;
- source equivalence cannot be established;
- any action would arm live checkout, charge money, mutate Stripe, expose a secret, use Vercel, or expand scope.

## Rollback boundary

- Disable `EASY_ERF_CUSTOMER_EMAIL_ENABLED` first.
- Preserve all email receipts, provider IDs, and audit events.
- Restore the prior founder fulfillment and notification Edge Function versions if required.
- Republish prior frontend main `3289cec346d5e84d971340a1297f32f070b08417` if the frontend must be rolled back.
- Do not down-migrate after an email attempt. Use a reviewed forward repair or explicit rollback migration.
- Do not delete a genuine report or payment record.

## Spend

- Current Class A discretionary spend: **$0**.
- Maximum additional discretionary spend authorized now: **$0**.
- Paid Resend plan authorized: **no**.
- Live R999 charge authorized: **no**.
- External customer contact authorized: **no**.
- Existing GitHub Actions, Supabase, hosting, DNS, and email-account metering: **UNKNOWN**.
