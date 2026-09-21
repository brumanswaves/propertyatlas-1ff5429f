# Separate Stripe Sandbox setup request, not executed

Authorize or provide access to one separately isolated Easy Erf Stripe Sandbox, one R999 once-off ZAR test checkout configuration, and a test webhook listener forwarding only to the isolated local handler at http://127.0.0.1:54325/functions/v1/easy-erf-stripe-webhook. This is a future setup request, not approval to perform it during packaging.

Service: Stripe Sandbox and a local listener. Purpose: prove actual hosted checkout, signature validation, exact customer/property/review-request/order binding and persisted paid state. Expected and maximum additional spend: R0/$0. No recurring paid service, live charge or purchase is authorized. Cheaper alternative: the existing explicitly simulated local webhook checks, already completed, which do not establish real Stripe acceptance.

Before any event, independently verify the new Sandbox account identity and all webhook destinations. The previously connected Easy Erf test account had a webhook to canonical production Supabase xiqpfhsdlvwrwhclonsg. Do not use that account's event path or alter its webhook. No production host may be a destination in the proposed Sandbox. Route only checkout.session.completed, checkout.session.async_payment_succeeded and checkout.session.expired as needed by the existing handler; confirm supported events against the handler before setup.

Store future Sandbox credentials only in the isolated local runtime, never this PR, chat, screenshots or browser storage. No credentials, permissions, SMTP, DNS, production or existing webhook changes are covered. No new cloud project or public tunnel is authorized. If a local listener cannot establish a verified separate boundary without such changes, stop that external step and report the exact requirement.

Stop rules: wrong account, any production destination, ambiguous routing, live-mode key, extra spend, unavailable Sandbox authority or additional external configuration. After explicit approval and successful setup verification, Codex may run a separately scoped real test checkout acceptance. This document itself does not authorize generating events.
