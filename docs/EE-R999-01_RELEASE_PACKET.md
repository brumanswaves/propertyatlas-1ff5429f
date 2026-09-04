# Easy Erf Class B Release Packet

Release ID: `EE-R999-01`
Packet state: **PREPARED, NOT AUTHORIZED**
Prepared date: 2026-09-04
Canonical repository: `brumanswaves/propertyatlas-1ff5429f`
Canonical Supabase project: `xiqpfhsdlvwrwhclonsg`
Canonical passive publisher project: `8680b46b-3325-4395-9767-a8c0ae2a3a50`
Sole implementation pull request: `#162`
Implementation branch: `chatgpt/ee-r999-customer-notification`
Current production GitHub main: `2c50961ff80c8420bee3af06b2b74ce471fd863a`
Notification source candidate before release-document reconciliation: `c569d0b4ab86a7cd265ad9cd791fd33a1b7f985b`
Bounded owner TEST order: `384be2fe-f7aa-4687-970c-5a6db34cfeba`

The exact approval head is the current PR #162 SHA named in the control-room approval request after this packet receives clean exact-head workflows. Any later commit invalidates the approval.

## WHAT I NEED FROM YOU NOW

Do not approve this packet until the control-room request names the final PR #162 head and reports all required exact-head workflows clean.

During the later production acceptance, one owner action will be required: verify the prepared message is addressed to your own canonical Easy Erf account email, send that one TEST email from your own mail client, then return to Easy Erf so the receipt can be recorded.

## Plain-English purpose

Complete the smallest real R999 delivery loop that is still missing:

`delivered owner TEST report -> exact manual email -> durable receipt -> owner opens the same report`

Easy Erf prepares the message. It does not send automatically, add an email provider, or contact an external customer.

## Verified pre-release facts

### GitHub

- PR #161 is merged at `2c50961ff80c8420bee3af06b2b74ce471fd863a`.
- PR #162 is open, draft, unmerged, mergeable, and based on that current main commit.
- The notification source candidate contains fresh recipient matching, database founder-role verification, fail-closed state checks, stronger idempotency, email-field sanitization, UI reset handling, clipboard error handling, and expanded proof.
- Temporary source-editing workflows removed themselves and are absent from the candidate.
- Final exact-head CI after this release-document update is still required.

### Canonical production

Read-only inspection on 2026-09-04 established:

- Checklist migration `20260903174923_require_resolved_founder_investigation_checklist` is already applied.
- Existing founder functions are already deployed and are not part of this release delta:
  - `easy-erf-founder-launch-readiness`, version 1, hash `ecb67daab80de00fbd5cafbd6e5226900d3260a14772bcf56e4bc2aa9216b9d0`.
  - `easy-erf-founder-fulfillment`, version 5, hash `e69a84a640d625252327b000a51cb042112e7e16e3f32c5b452539ad371e67a0`.
  - `easy-erf-founder-report-upload`, version 2, hash `eef189bf0152b7129d718cb7603b1d3ae2c7038511b5a6ce42c469991cfc67c8`.
  - `easy-erf-founder-review-content`, version 2, hash `0c124be15c9d56f5c405e16145883da4dd06e3fc099271fbcc679e6dff931292`.
- Notification migration `20260903211000_record_manual_report_notification.sql` is not applied.
- Edge Function `easy-erf-founder-customer-notification` is not deployed.
- Receipt RPC `public.record_easy_erf_customer_notification(uuid, uuid, text)` does not exist.
- Receipt-invalidation trigger `clear_easy_erf_customer_notification_on_reopen` does not exist.
- Exact production frontend-source equivalence is unverified.

### Acceptance order

Order `384be2fe-f7aa-4687-970c-5a6db34cfeba` is the only authorized acceptance candidate in this packet. Read-only inspection established that it:

- is TEST mode;
- belongs to the founder-admin account;
- references `Erf 1570 - 24 Padrone Cres, St Francis Bay, 6312, South Africa`;
- is already delivered with `status=ready` and `status_enum=complete`;
- contains a populated structured report;
- contains all nine checklist items with all nine resolved;
- has no customer-notification receipt.

Order `3ebe9357-8ec1-45aa-ba4c-68412f0ee656` must not be substituted. It remains `paid` and does not contain the required structured report or checklist.

## Exact Class B actions proposed

### 1. Freeze the exact source

Immediately before any merge:

1. Re-read PR #162.
2. Confirm its head exactly matches the SHA in the owner approval.
3. Confirm its base is current main `2c50961ff80c8420bee3af06b2b74ce471fd863a`, unless the approval request explicitly records a newly verified main and refreshed packet.
4. Confirm all four required exact-head workflows concluded successfully.
5. Confirm the diff remains limited to the notification flow, its guardrails and proof, one additive migration, and these release documents.
6. Stop if any source, project identity, migration, function, order, or release boundary differs.

### 2. Merge only PR #162

1. Mark PR #162 ready for review only after the freeze checks succeed.
2. Merge only the exact approved head.
3. Do not merge another PR.
4. Inspect the resulting main SHA and post-merge workflows.
5. Stop before production changes if any required post-merge workflow fails or main advances unexpectedly.

### 3. Apply one additive migration

Apply only:

`supabase/migrations/20260903211000_record_manual_report_notification.sql`

Expected effect:

- add service-role-only RPC `public.record_easy_erf_customer_notification(uuid, uuid, text)`;
- independently require the supplied actor to hold the founder-admin role;
- require a Stripe Easy Erf order in `ready` state;
- require the exact canonical order-owner email;
- require a complete structured report and resolved nine-item checklist;
- write one durable `manual_email` receipt into existing structured review content;
- add one `customer_notified` audit event on the first valid write;
- treat an already valid receipt as idempotent;
- clear the old receipt when a delivered report is reopened for correction.

The migration must not rewrite unrelated orders or erase report content.

After applying it, verify read-only that:

- the migration is recorded once;
- the RPC and reopen trigger exist;
- public, anon, and authenticated roles cannot execute the RPC;
- service_role can execute it;
- no other migration was applied.

### 4. Deploy one authenticated Edge Function

Deploy only:

`easy-erf-founder-customer-notification`

Required settings:

- exact accepted post-merge source;
- `verify_jwt=true`;
- no email-provider secret;
- no automatic network call that sends email;
- no other Edge Function deployment.

After deployment, verify the function is active and its deployed source matches the accepted repository source. Stop if source equivalence cannot be established.

### 5. Publish the exact accepted frontend

Use only the passive publication action for publisher project `8680b46b-3325-4395-9767-a8c0ae2a3a50`.

Do not send a Lovable agent implementation, debugging, planning, or source-generation request. Do not use Vercel.

After publication:

1. Confirm GitHub main did not advance unexpectedly.
2. Confirm the published frontend corresponds to the accepted post-merge source.
3. Confirm signed-out users cannot access founder fulfillment or notification controls.
4. Confirm the notification panel appears only for a delivered read-only report.
5. Stop if the publisher adds, edits, commits, or merges source.

### 6. Run one bounded owner-only TEST acceptance

Use only order:

`384be2fe-f7aa-4687-970c-5a6db34cfeba`

Before any write, re-verify that:

- `livemode=false`;
- the order belongs to the founder-admin account;
- it still references `Erf 1570 - 24 Padrone Cres, St Francis Bay, 6312, South Africa`;
- it remains delivered with `status=ready` and `status_enum=complete`;
- its structured report is complete;
- all nine checklist items are resolved;
- it has no notification receipt;
- no other order will change.

Then perform this flow once:

1. Sign in as the founder and open the delivered report from `/admin/fulfillment`.
2. Open the customer-notification panel.
3. Prepare the exact email.
4. Verify the recipient is the founder's own canonical Easy Erf account email.
5. Verify the subject and body identify the correct property and contain the secure Easy Erf `My Reports` link.
6. Verify the interface states that Easy Erf has not sent the message automatically.
7. Owner action: send that exact message once from the owner's mail client to the verified owner email.
8. Return to Easy Erf, select the explicit sent confirmation, and record the notification receipt once.
9. Verify read-only that the receipt contains `status=sent`, `channel=manual_email`, the canonical recipient, a sent timestamp, and founder sender ID.
10. Verify exactly one `customer_notified` audit event exists for the receipt.
11. Open the owner TEST email and follow its link while signed in as the owner.
12. Verify the link opens the same delivered Erf 1570 report.
13. Stop. Do not reopen the report, create another order, send another message, or contact another address.

If the owner cannot perform the manual send, stop after message preparation. Do not record a receipt for an unsent message.

## Acceptance conditions

This release is accepted only if all of the following are independently inspected:

- exact approved PR #162 head merged;
- required post-merge workflows successful;
- only the named migration applied;
- receipt RPC and invalidation trigger present with the expected privilege boundary;
- only the named Edge Function deployed with `verify_jwt=true`;
- deployed function source equivalent to accepted repository source;
- published frontend equivalent to accepted repository source;
- founder-only access enforced;
- exact owner-only recipient and property details prepared;
- one owner TEST email actually sent manually;
- one valid durable receipt persisted only after the send;
- one matching audit event persisted;
- the owner opened the same delivered report through the message link;
- no live payment, Stripe mutation, secret change, external customer contact, or unapproved spend occurred.

CI, migration success, function deployment success, and publication success are each necessary but are not substitutes for the end-to-end acceptance evidence.

## Stop conditions

Stop without expanding scope if:

- PR #162 head differs from the approved SHA;
- any required workflow fails;
- GitHub main changes unexpectedly;
- any additional PR, migration, or Edge Function would be required;
- canonical repository, Supabase project, or publisher identity differs;
- the acceptance order reports `livemode=true`;
- the acceptance order is no longer founder-owned, no longer delivered, no longer references the expected property, or already has a receipt;
- any other order would change;
- the prepared recipient differs from the canonical founder account email;
- the prepared property or report link is wrong;
- an email provider, paid service, or secret would be required;
- the publisher modifies GitHub source;
- source equivalence cannot be verified;
- a secret value or customer credential would be exposed;
- any action would make a real charge, mutate Stripe, change DNS, contact an external customer, use Lovable for implementation, use Vercel, or incur discretionary spend;
- the owner TEST email was not actually sent.

Do not retry a consequential action automatically. Record the exact verified state and prepare a focused repair proposal.

## Rollback

Rollback is authorized only as part of a separately approved execution of this exact packet and only when a release step fails after a production change.

### Frontend rollback

Passively republish pre-release main `2c50961ff80c8420bee3af06b2b74ce471fd863a`. Do not edit source inside the publisher.

### Edge Function rollback

If exact deletion is available and independently verified safe, remove only `easy-erf-founder-customer-notification`.

If exact deletion is unavailable, restore the pre-release frontend so no UI calls the function and prepare a fail-closed disabled function version for separate explicit approval. Do not alter any existing founder function.

### Database rollback

Apply one explicit rollback migration that only:

1. drops trigger `clear_easy_erf_customer_notification_on_reopen` from `public.report_orders`;
2. drops function `public.clear_easy_erf_customer_notification_on_reopen()`;
3. revokes and drops function `public.record_easy_erf_customer_notification(uuid, uuid, text)`.

Preserve any receipt and audit evidence already written. Do not erase customer-notification history or roll back an unrelated migration.

### Acceptance-order boundary

The accepted write boundary is one notification receipt and one audit event on order `384be2fe-f7aa-4687-970c-5a6db34cfeba`. Do not alter report findings, checklist state, delivery state, payment state, or another order to compensate for a failed release.

## Explicitly prohibited

This packet does not authorize:

- live checkout arming;
- a real R999 charge;
- Stripe business-profile, Payment Link, webhook, price, account, or billing mutation;
- secret or credential changes;
- automatic email sending or a paid email provider;
- DNS changes;
- advertising;
- external customer contact;
- any production order other than the named founder-owned TEST order;
- report or checklist edits during notification acceptance;
- report reopening during notification acceptance;
- new product scope;
- another PR merge;
- another migration or Edge Function deployment;
- Lovable implementation, debugging, agent chat, or plan mode;
- Vercel;
- discretionary spend.

## Spend

- Expected additional discretionary spend: **$0**.
- Maximum additional discretionary spend: **$0**.
- Live payment authorized: **no**.
- Paid email provider authorized: **no**.
- Recurring spend enabled: **none**.
- Existing GitHub Actions, Supabase, passive hosting, and owner email metering: **UNKNOWN**.

## What remains unverified before approval

- Final PR #162 exact head after this packet commit.
- Final exact-head workflow conclusions.
- Final diff and security review.

## What remains unverified until an approved release is executed

- Post-merge CI.
- Production migration behavior.
- Production function deployment and exact-source equivalence.
- Exact-source frontend publication.
- Signed-in founder notification controls.
- Manual owner TEST email delivery.
- Durable receipt and audit-event persistence.
- Owner reopening the same report through the email link.
- Production reopen-trigger behavior.
- Live Stripe webhook signing-secret equivalence.
- A genuine live R999 payment and external-customer fulfillment journey.
