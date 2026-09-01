# Easy Erf Current State

_Last refreshed: 2026-09-01_

This file is the concise operational snapshot for the Easy Erf control room. The product source of truth remains `docs/EASY_ERF_MASTER_PLAN.md`; GitHub `main` remains the code source of truth.

## Canonical baseline before this branch

- GitHub `main`: `828b4379a31e9beb2f8fb394e956a7b99ff7ec61` after PR #152.
- Production frontend: Lovable deployment `33c0cd32-e26c-4517-a374-cf1dc56fcbc9`, serving `https://easyerf.co.za`.
- Canonical backend/runtime project: Supabase `xiqpfhsdlvwrwhclonsg`.
- Live charging through the Easy Erf application remains OFF unless separately armed through the approved live-mode gates.
- Active Site Potential remains deterministic parcel/build-envelope plus street-side build lines only. Generated architectural concepts are not part of the active product.

## R999 commercial proof completed in TEST

The full controlled TEST journey has been executed for Erf 1570:

1. exact property selected and confirmed from the Easy Erf map/property flow
2. controlled R999 brief created while signed in
3. Stripe TEST R999 payment completed
4. payment attached to the correct Easy Erf account and canonical parcel
5. founder fulfillment moved the order from paid to processing through the audited transition contract
6. the actual property evidence was reviewed
7. a structured Human-Reviewed Easy Erf Report was saved
8. the order moved from processing to ready through the audited transition contract
9. the completed web report appeared as the primary customer deliverable

Gold-standard TEST order property:
- 24 Padrone Crescent, St Francis Bay
- Erf 1570
- LPI `C03400140000157000000`
- canonical parcel `csg:lpi:c03400140000157000000`

The TEST proved the payment, ownership, founder queue, report authoring and delivery mechanics. It also exposed a product-positioning issue: the phrase **Human Review** understated the service and implied a quick final check rather than the real customer value.

## Current product decision being implemented

The R999 Early Access offer is now:

**Done-for-You Property Investigation · R999**

**You choose the property. We do the investigation.**

The customer confirms the exact parcel and tells Easy Erf what matters most. Easy Erf plus a human reviewer then completes or reviews the standard Easy Erf investigation on the customer's behalf, reusing work already present in the same canonical property file.

The standard investigation includes, as applicable and as evidence/inputs allow:
- parcel and working-address confirmation
- cadastral / SG / boundary evidence review
- ownership, transfer, title indicators and paid-report evidence
- working zoning and planning position
- standard property checks and evidence-gap review
- useful market evidence and comparable context
- relevant deterministic Strategy calculations
- deterministic Site Potential where sufficiently supported
- final Human-Reviewed Easy Erf Report showing facts, potential, risks, unknowns and next checks

The three existing focus choices remain for compatibility but now mean **review emphasis**, not reduced product scope:
- Overall Property Check
- Property Potential
- Check My Intended Use

## Included property-data-report rule

During Early Access, the product may include the review of **one third-party property data report at no extra charge where coverage is available**.

Locked truth rules:
- public customer copy is provider-neutral unless specific provider rights are verified
- provider may vary
- Easy Erf may use the report as investigation evidence
- a branded Lightstone, WinDeed or other provider PDF is supplied to the customer only when the applicable subscription/report terms permit redistribution
- do not advertise `Free Lightstone Report` until contractual redistribution rights are independently verified
- unlimited paid third-party documents are not part of the R999 package

## Recent commercial/product PR sequence

- PR #145: controlled Human Review product, shared report and founder fulfillment foundations
- PR #146: correct Easy Erf customer domain
- PR #147: fail-closed checkout mode/live arming gate
- PR #148: authenticated customer ownership
- PR #149: payment-only Stripe checkout and account-aware UI
- PR #150: confirmed map parcel required before R999 checkout
- PR #151: stronger property-level R999 value proposition
- PR #152: tangible pre-payment report proof, How It Works explanation, post-payment status, action-first founder queue and guided report editor

## Active implementation branch

`chatgpt/done-for-you-investigation-offer`

This branch is converting the R999 customer and founder workflow from narrow `Human Review` positioning to the done-for-you investigation product while preserving the proven payment and fulfillment contracts.

No production publish, backend deployment, Stripe mutation, database schema change or live-payment activation is authorized by this branch itself.

## Known launch work still separate

### Stripe business profile
The connected LIVE Easy Erf Stripe account still needs a separately approved business-profile cleanup before launch, including replacing the legacy `www.xyzboatsupplies.com` business URL with Easy Erf information.

### Live credentials / webhook
A real live launch still requires separate authorization and verification of:
- LIVE Stripe secret key in Easy Erf runtime
- LIVE webhook signing secret for the Easy Erf endpoint
- accepted LIVE Payment Link ID
- checkout mode `live`
- final `EASY_ERF_R999_LIVE_ENABLED=true` arming step

The existing Stripe API cannot reveal the current webhook signing secret. Do not guess it or silently recreate the webhook.

### Live canary
A real R999 live payment is a separate spend/production authorization. TEST success does not authorize a real charge.

## Gold-standard evidence reality for Erf 1570

Useful evidence currently includes:
- official CSG parcel identity
- user-confirmed working address 24 Padrone Crescent
- user-confirmed working `RES1` zoning classification
- General Plan 12252 evidence visibly showing Erf 1570 and Padrone Crescent, while remaining a parent subdivision plan rather than automatically the individual SG diagram
- uploaded third-party property report with ownership, transfer, valuation and land-use evidence
- real discrepancy between approximately 619 m² cadastral extent and 602 m² registered extent shown in the uploaded report

The product must preserve these evidence limitations rather than flattening them into false certainty.

## Immediate next execution path

1. finish the done-for-you branch
2. update guardrails and canonical product docs
3. run full exact-head CI and browser acceptance
4. open PR
5. merge only with explicit approval
6. publish only with explicit approval
7. review the live customer and founder journey visually
8. keep live payments OFF until the separate launch checklist is approved and verified
