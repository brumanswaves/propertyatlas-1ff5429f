import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migration = source(
  "supabase/migrations/20260829113000_secure_easy_erf_stripe_fulfillment.sql",
);
const webhook = source("supabase/functions/easy-erf-stripe-webhook/index.ts");
const checkout = source("supabase/functions/easy-erf-r999-checkout/index.ts");
const paymentContract = source(
  "supabase/functions/_shared/easyErfStripePaymentContract.ts",
);
const config = source("supabase/config.toml");
const admin = source("src/routes/admin.tsx");
const pricing = source("src/routes/pricing.tsx");
const takeover = source("src/components/humanReview/HumanReviewTakeoverCard.tsx");

describe("Easy Erf Stripe payment authority", () => {
  it("removes the legacy customer-write policies and keeps customer access read-only", () => {
    expect(migration).toMatch(/drop policy if exists "Users can manage own report orders"/);
    expect(migration).toMatch(/drop policy if exists "Users manage own report orders"/);
    expect(migration).toMatch(
      /revoke insert, update, delete on table public\.report_orders from anon, authenticated/,
    );
    expect(migration).toMatch(/create policy "Users read own report orders"[\s\S]*for select/);
    expect(migration).toMatch(/create policy "Admins read report orders"[\s\S]*for select/);
    expect(migration).not.toMatch(/create policy[\s\S]{0,160}for all/i);
  });

  it("allows Stripe's trusted server path to write without trusting the browser", () => {
    expect(migration).toMatch(
      /create or replace function public\.record_easy_erf_stripe_payment/,
    );
    expect(migration).toMatch(/security definer/);
    expect(migration).toMatch(/revoke all on function public\.record_easy_erf_stripe_payment/);
    expect(migration).toMatch(
      /grant execute on function public\.record_easy_erf_stripe_payment[\s\S]*to service_role/,
    );
    expect(migration).toMatch(/unique \(provider_order_ref\)/);
    expect(migration).toMatch(/on conflict \(provider_order_ref\) do update/);
  });

  it("requires the exact R999 ZAR offer before recording payment", () => {
    expect(migration).toMatch(
      /lower\(coalesce\(p_currency, ''\)\) <> 'zar' or p_amount_total <> 99900/,
    );
    expect(migration).toMatch(/Customer email is required/);
    expect(migration).toMatch(/Property reference is required/);
  });

  it("does not regress a later fulfilment state when Stripe retries an event", () => {
    expect(migration).toMatch(
      /when public\.report_orders\.status in \('pending', 'paid'\) then 'paid'/,
    );
    expect(migration).toMatch(
      /when public\.report_orders\.status_enum in \([\s\S]*'pending'::public\.report_order_status,[\s\S]*'paid'::public\.report_order_status[\s\S]*\) then 'paid'::public\.report_order_status/,
    );
  });
});

describe("Easy Erf signed Stripe webhook", () => {
  it("uses Stripe signature verification over the raw request body", () => {
    expect(webhook).toContain('request.headers.get("stripe-signature")');
    expect(webhook).toContain("rawBody = await request.text()");
    expect(webhook).toContain("stripe.webhooks.constructEventAsync(");
    expect(webhook).toContain("Stripe.createSubtleCryptoProvider()");
  });

  it("fails closed unless secrets and an accepted Easy Erf Payment Link are configured", () => {
    for (const requiredName of [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "EASY_ERF_R999_PAYMENT_LINK_IDS",
    ]) {
      expect(webhook).toContain(requiredName);
    }
    expect(webhook).toContain("acceptedPaymentLinkIds.size === 0");
  });

  it("uses the authenticated Human Review owner before legacy email matching", () => {
    expect(webhook).toContain("reviewRequest?.user_id ?? null");
    expect(webhook).toContain("human_review_owner_resolved");
    expect(webhook).toContain('.eq("email", order.customerEmail)');
    expect(webhook).not.toContain('.ilike("email", order.customerEmail)');
    expect(webhook).toContain('admin.rpc(\n    "record_easy_erf_stripe_payment"');
    expect(webhook).not.toMatch(/user[_-]?id.*request\.json/i);
  });

  it("takes the property from the Easy Erf brief before legacy Stripe fields", () => {
    expect(webhook).toContain("reviewRequest?.property_reference_hint?.trim()");
    expect(webhook).toContain("order.propertyReference?.trim()");
    expect(webhook).toContain("p_property_reference: propertyReference");
    expect(paymentContract).toContain("propertyReference: string | null");
    expect(paymentContract).toContain("New Human");
    expect(paymentContract).toContain("Review checkouts keep property and review questions inside Easy Erf.");
  });

  it("resolves a standalone erf using both numeric and legacy string saved-property values for legacy sessions", () => {
    expect(webhook).toContain("parseStandaloneErfNumber(propertyReference)");
    expect(webhook).toContain('.contains("user_data", userDataFilter)');
    expect(webhook).toContain("filters.push({ erfNumber: numeric }, { erf: numeric })");
    expect(webhook).toContain("parcelIds.size === 1");
    expect(webhook).toContain("saved_property_erf_ambiguous");
    expect(webhook).toContain("saved_property_erf_unresolved");
    expect(webhook).not.toMatch(/parcelIds\.values\(\)\.next\(\)\.value\s+as\s+string/);
  });

  it("exposes the webhook without weakening its authentication boundary", () => {
    expect(config).toMatch(
      /\[functions\.easy-erf-stripe-webhook\][\s\S]*verify_jwt = false/,
    );
    expect(webhook).toContain("Stripe signature was invalid.");
  });

  it("does not hard-code Stripe secrets or accepted link ids in source", () => {
    expect(webhook).not.toMatch(/sk_(test|live)_/);
    expect(webhook).not.toMatch(/whsec_/);
    expect(webhook).not.toMatch(/plink_[A-Za-z0-9]{8,}/);
    expect(migration).not.toMatch(/sk_(test|live)_|whsec_|plink_[A-Za-z0-9]{8,}/);
  });
});

describe("Easy Erf payment operations surfaces", () => {
  it("requires map/property confirmation before the controlled payment handoff", () => {
    expect(pricing).toContain("Erf numbers repeat across South Africa");
    expect(pricing).toContain("Find and confirm property on map");
    expect(pricing).toContain("Human Review is locked to this parcel");
    expect(pricing).toContain("hasConfirmedParcel");
    expect(pricing).toContain("parcelId,");
    expect(pricing).toContain("propertyReferenceHint: propertyReference");
    expect(pricing).toContain("Stripe handles payment only.");
    expect(pricing).not.toContain("Property address, Erf or LPI reference");
    expect(takeover).toContain("Want Easy Erf to review this property for you?");
    expect(takeover).toContain("What you get");
    expect(takeover).toContain("Yes — get Human Review · R999");
    expect(takeover).toContain("Erf numbers can repeat in different places");
  });

  it("rejects checkout unless the brief carries a confirmed canonical parcel", () => {
    expect(checkout).toContain("isConfirmedParcelId(brief.parcelId)");
    expect(checkout).toContain("Confirm the exact property on the Easy Erf map before starting Human Review checkout.");
    expect(checkout).toContain("confirmedParcelId = brief.parcelId.trim()");
    expect(checkout).toContain("parcel_id: confirmedParcelId");
    expect(checkout).toContain("property_reference_hint: propertyReference");
    expect(checkout).not.toContain("resolveSavedParcel");
    expect(checkout).not.toContain("savedPropertyFilters");
  });

  it("binds the confirmed property and review brief to the signed-in Easy Erf user", () => {
    expect(pricing).toContain("Sign in before payment so the paid Human Review");
    expect(pricing).toContain("signedInEmail");
    expect(pricing).toContain("authReady && !signedInEmail");
    expect(pricing).toContain('supabase.auth.getUser()');
    expect(pricing).toContain("SIGN_IN_REQUIRED_MESSAGE");
    expect(checkout).toContain("user_id: user.id");
    expect(checkout).toContain("scope_acknowledged_at: new Date().toISOString()");
  });

  it("resolves only a verified R999 Stripe link in the explicitly approved launch mode", () => {
    expect(pricing).toContain('supabase.functions.invoke("easy-erf-r999-checkout", {');
    expect(pricing).toContain('(checkoutMode !== "test" && checkoutMode !== "live")');
    expect(pricing).toContain('url.hostname !== "buy.stripe.com"');
    expect(checkout).toContain("bearerToken(request)");
    expect(checkout).toContain("admin.auth.getUser(token)");
    expect(checkout).toContain("EASY_ERF_R999_PAYMENT_LINK_IDS");
    expect(checkout).toContain("STRIPE_SECRET_KEY");
    expect(checkout).toContain("EASY_ERF_R999_CHECKOUT_MODE");
    expect(checkout).toContain("EASY_ERF_R999_LIVE_ENABLED");
    expect(checkout).toContain('configured === "live"');
    expect(checkout).toContain('checkoutMode === "live" && !liveCheckoutIsArmed()');
    expect(checkout).toContain("link.livemode !== expectedLivemode");
    expect(checkout).toContain("price.unit_amount !== 99900");
    expect(checkout).toContain('price.currency.toLowerCase() !== "zar"');
    expect(checkout).toContain("mode: checkoutMode");
    expect(checkout).not.toMatch(/sk_(test|live)_|plink_[A-Za-z0-9]{8,}/);
    expect(config).toMatch(/\[functions\.easy-erf-r999-checkout\][\s\S]*verify_jwt = false/);
  });

  it("lets Founder Operations display and open guest or matched-user orders safely", () => {
    expect(admin).toContain("user_id: string | null");
    expect(admin).toContain("parcel_id: string | null");
    expect(admin).toContain("provider: string");
    expect(admin).toContain("payload: unknown");
    expect(admin).toContain('orderPayloadText(order, "propertyReference")');
    expect(admin).toContain('orderPayloadText(order, "customerEmail")');
    expect(admin).toContain('/admin/fulfillment#order-${order.id}');
    expect(admin).toContain("Open / change review");
  });
});
