# Easy Erf Current Release Contract

Release ID: `EE-R999-01`
Contract status: **ACTIVE RELEASE GATE, CLASS B PACKET PREPARED, NOT AUTHORIZED**
Effective date: 2026-09-04
Canonical repository: `brumanswaves/propertyatlas-1ff5429f`
Canonical Supabase project: `xiqpfhsdlvwrwhclonsg`
Canonical passive publisher project: `8680b46b-3325-4395-9767-a8c0ae2a3a50`
Current GitHub main: `2c50961ff80c8420bee3af06b2b74ce471fd863a`
Merged investigation-checklist baseline: PR #161, merge commit `2c50961ff80c8420bee3af06b2b74ce471fd863a`
Sole active implementation PR: `#162`
Active implementation branch: `chatgpt/ee-r999-customer-notification`
Notification source candidate before release-document reconciliation: `c569d0b4ab86a7cd265ad9cd791fd33a1b7f985b`
Prepared release packet: `docs/EE-R999-01_RELEASE_PACKET.md`

The approval SHA is the exact current PR #162 head named in the control-room approval request after these release documents and all exact-head checks are clean. Any later head change invalidates that approval.

## Release promise

Complete one bounded owner-only R999 vertical slice from an already delivered Human-Reviewed Easy Erf Report to a manually sent customer email, a durable notification receipt, and successful reopening of the same report from the secure account link.

The application prepares the exact message but does not send it automatically. No email provider is added. The founder must send the prepared message manually and may record the receipt only after that send occurred.

## Included source

- Founder-only preparation of a manual email for the canonical authentication email attached to the order owner.
- Fresh recipient verification when the receipt is recorded, preventing a stale prepared address from being accepted after an account email change.
- Single-line, length-limited customer-name and property-reference fields for the email subject and body.
- A secure Easy Erf `My Reports` link rather than a permanent private-file URL.
- Explicit founder confirmation before recording a send.
- A service-role-only receipt RPC that independently verifies the actor has the founder-admin role.
- Fail-closed provider and report-status validation.
- Structured-report and resolved nine-item checklist validation before preparation or receipt recording.
- Idempotent manual-email receipt handling that requires a valid recipient, channel, sent time, and sender.
- One `customer_notified` audit event for the first valid receipt.
- Automatic invalidation of the old receipt if the report is reopened for correction.
- UI reset and clipboard-failure handling that does not falsely report a copied message.
- Focused guardrails, Deno checks, isolated PostgreSQL proof, production build, TypeScript, lint, and whitespace verification.

## Verified GitHub baseline

- PR #161 is merged.
- GitHub main is `2c50961ff80c8420bee3af06b2b74ce471fd863a`.
- PR #162 is open, draft, unmerged, and based on that main commit.
- The product-source candidate `c569d0b4ab86a7cd265ad9cd791fd33a1b7f985b` contains the notification hardening and no temporary formatter or hardening workflow.
- A GitHub Actions formatter verified targeted Prettier and ESLint output for the final changed guardrail file, then removed itself.
- The human-authored release-document head created after this contract must receive clean exact-head workflows before a Class B approval request is valid.

Passing CI proves source behavior only. It does not prove production deployment, publication, manual email delivery, receipt persistence, or customer report access.

## Verified production baseline

Canonical production was inspected read-only on 2026-09-04.

### Existing checklist and founder controls

- Migration `20260903174923_require_resolved_founder_investigation_checklist` is applied.
- `easy-erf-founder-launch-readiness` is active, version 1, hash `ecb67daab80de00fbd5cafbd6e5226900d3260a14772bcf56e4bc2aa9216b9d0`.
- `easy-erf-founder-fulfillment` is active, version 5, hash `e69a84a640d625252327b000a51cb042112e7e16e3f32c5b452539ad371e67a0`.
- `easy-erf-founder-report-upload` is active, version 2, hash `eef189bf0152b7129d718cb7603b1d3ae2c7038511b5a6ce42c469991cfc67c8`.
- `easy-erf-founder-review-content` is active, version 2, hash `0c124be15c9d56f5c405e16145883da4dd06e3fc099271fbcc679e6dff931292`.

These existing functions are not changed or redeployed by this notification packet.

### Notification delta still absent

- Migration `20260903211000_record_manual_report_notification.sql` is not applied.
- Edge Function `easy-erf-founder-customer-notification` is not deployed.
- RPC `public.record_easy_erf_customer_notification(uuid, uuid, text)` does not exist.
- Trigger `clear_easy_erf_customer_notification_on_reopen` does not exist.
- Exact production frontend-source equivalence is unverified.

### Bounded acceptance order

The sole acceptance candidate is order `384be2fe-f7aa-4687-970c-5a6db34cfeba`.

Read-only production inspection established that it:

- is a Stripe TEST-mode Easy Erf investigation order;
- belongs to the founder-admin account;
- references `Erf 1570 - 24 Padrone Cres, St Francis Bay, 6312, South Africa`;
- is already in the delivered `ready` state, with `status_enum=complete`;
- contains a structured report with the bottom line and all five finding sections populated;
- contains all nine standard investigation checklist items, all resolved as `complete` or `not_applicable`;
- has no existing customer-notification receipt.

Order `3ebe9357-8ec1-45aa-ba4c-68412f0ee656` is not the acceptance candidate. It is TEST mode but remains `paid` and has no structured report or checklist.

## Product boundaries

- The notification receipt is operational delivery metadata only.
- Property facts, evidence, provenance, conflicts, calculations, Site Potential, and report findings remain in their existing canonical systems.
- Active Site Potential remains deterministic parcel/map and street-side build-envelope output.
- Generated house concepts, rendered buildings, facade concepts, and AI architectural images remain excluded.
- No automated email provider, marketing automation, CRM, referral marketplace, or new product scope is included.
- No customer email address, secret, or private-file URL may be written into source, logs, or release documents.

## Release stages

1. **Class A source acceptance:** final release-document reconciliation, exact-head CI, code inspection, production read-only inspection, and packet preparation.
2. **Class B controlled release:** merge the exact approved PR #162 head, apply one additive notification migration, deploy one authenticated notification function, publish the exact accepted frontend, and run one owner-only TEST-order acceptance.
3. **Later Class C work:** any real payment, Stripe mutation, secret change, live checkout arming, external customer communication, paid email provider, DNS change, destructive production action, or money movement.

## Current blockers

- PR #162 remains draft and unmerged.
- Final exact-head workflows must be clean after the release documents are committed.
- The notification migration is not applied.
- The notification Edge Function is not deployed.
- The matching frontend is not verified as published.
- Authenticated production preparation, manual owner-only email send, receipt recording, audit persistence, and report-link reopening remain unverified.
- Reopen-trigger behavior is proved in isolated PostgreSQL but remains unverified in production.
- Live Stripe webhook signing-secret equivalence and the genuine R999 purchase journey remain outside this packet.

## Approval classes

- **Class A:** $0 reversible source work, review, tests, CI, documentation, read-only production inspection, and release-packet preparation may continue without repeated approval.
- **Class B:** exact-head merge, the named additive migration, the named authenticated Edge Function deployment, passive exact-source publication, and the bounded founder-owned TEST acceptance require one packet-specific approval.
- **Class C:** real payment, money, billing, Stripe mutation, secrets, DNS, advertising, external customer contact, destructive production changes, credentials, Lovable implementation, or any Vercel use require separate explicit approval.

## Change control

The Class B approval is invalid if any of these differ from the approval request:

- PR number or exact head SHA;
- repository, Supabase project, or passive publisher identity;
- migration or Edge Function name;
- acceptance-order ID;
- release actions or stop conditions;
- expected additional discretionary spend of $0.

A failed step stops the release. Do not expand scope, retry consequential actions automatically, substitute another order, deploy another function, or apply another migration.

## Spend

- Expected additional discretionary spend: **$0**.
- Maximum additional discretionary spend: **$0**.
- Live R999 charge authorized: **no**.
- Paid email provider authorized: **no**.
- Advertising spend authorized: **$0**.
- Existing GitHub Actions, Supabase, passive hosting, and owner email metering: **UNKNOWN**.
