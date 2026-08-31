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
const config = source("supabase/config.toml");
const admin = source("src/routes/admin.tsx");
const pricing = source("src/routes/pricing.tsx");

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

  it("uses exact account matching and a server-only payment RPC", () => {
    expect(webhook).toContain('.eq("email", order.customerEmail)');
    expect(webhook).not.toContain('.ilike("email", order.customerEmail)');
    expect(webhook).toContain('admin.rpc(\n    "record_easy_erf_stripe_payment"');
    expect(webhook).not.toMatch(/user[_-]?id.*request\.json/i);
  });

  it("resolves a standalone erf only through one unique saved-property parcel", () => {
    expect(webhook).toContain("parseStandaloneErfNumber(order.propertyReference)");
    expect(webhook).toContain('.contains("user_data", userDataFilter)');
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
  it("resolves only the verified TEST R999 Stripe checkout server-side", () => {
    expect(pricing).toContain('supabase.functions.invoke("easy-erf-r999-checkout")');
    expect(pricing).toContain('data?.mode !== "test"');
    expect(pricing).toContain('url.hostname !== "buy.stripe.com"');
    expect(checkout).toContain("EASY_ERF_R999_PAYMENT_LINK_IDS");
    expect(checkout).toContain("STRIPE_SECRET_KEY");
    expect(checkout).toContain("link.livemode");
    expect(checkout).toContain("price.unit_amount !== 99900");
    expect(checkout).toContain('price.currency.toLowerCase() !== "zar"');
    expect(checkout).not.toMatch(/sk_(test|live)_|plink_[A-Za-z0-9]{8,}/);
    expect(config).toMatch(/\[functions\.easy-erf-r999-checkout\][\s\S]*verify_jwt = false/);
  });

  it("lets Founder Operations display guest and matched-user orders safely", () => {
    expect(admin).toContain("user_id: string | null");
    expect(admin).toContain("parcel_id: string | null");
    expect(admin).toContain("provider: string");
    expect(admin).toContain("payload: unknown");
    expect(admin).toContain('orderPayloadText(order, "propertyReference")');
    expect(admin).toContain('orderPayloadText(order, "customerEmail")');
    expect(admin).toMatch(/Read-only payment and fulfilment truth/);
  });
});
