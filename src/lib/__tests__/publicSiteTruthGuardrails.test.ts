import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function routeSource(name: string) {
  return readFileSync(join(process.cwd(), "src", "routes", name), "utf8");
}

function componentSource(name: string) {
  return readFileSync(join(process.cwd(), "src", "components", "property", name), "utf8");
}

function projectSource(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

describe("public Easy Erf product truth guardrails", () => {
  it("does not revive the retired fake report-order flow", () => {
    const source = routeSource("reports.tsx");

    expect(source).not.toContain('from("report_orders")');
    expect(source).not.toContain("Order placed (pending)");
    expect(source).not.toContain("Order report");
    expect(source).toMatch(/does not currently process payment/i);
  });

  it("does not publish subscription terms while no subscription is sold", () => {
    const source = routeSource("subscriptions.tsx");

    expect(source).not.toMatch(/subscriptions automatically renew/i);
    expect(source).not.toMatch(/partial-period refunds/i);
    expect(source).not.toMatch(/cancel your subscription at any time/i);
    expect(source).toMatch(/does not currently sell a subscription/i);
  });

  it("does not fake contact or partnership delivery in browser state", () => {
    for (const route of ["contact.tsx", "partnerships.tsx"]) {
      const source = routeSource(route);
      expect(source).not.toContain("setSent(true)");
      expect(source).not.toMatch(/your (message|inquiry) has been received/i);
      expect(source).toMatch(/not yet connected/i);
    }
  });

  it("keeps How It Works free of retired scoring and modelled-value promises", () => {
    const source = routeSource("how-it-works.tsx");

    expect(source).not.toMatch(/estimated value/i);
    expect(source).not.toMatch(/investor and development scores/i);
    expect(source).not.toMatch(/save and monitor/i);
    expect(source).not.toMatch(/unlock deeper insights/i);
    expect(source).toMatch(/Guided Investigation/);
    expect(source).toMatch(/Site Potential/);
    expect(source).toMatch(/Easy Erf Report/);
  });

  it("keeps the current commercial decision explicit on Human Review", () => {
    const source = routeSource("pricing.tsx");

    expect(source).toMatch(/Human Review · R999/);
    expect(source).toMatch(/once-off · one property · no subscription/i);
    expect(source).toMatch(/Choose one investigation focus/i);
    expect(source).toMatch(/Tell us about your situation — not a new question/i);
    expect(source).not.toMatch(/R\s*[\d,.]+\s*(?:\/|per)\s*month/i);
    expect(source).not.toMatch(/subscriptions automatically renew|auto-renew/i);
  });

  it("keeps the R999 Human Review investigation controlled and TEST-only", () => {
    const source = routeSource("pricing.tsx");
    const scope = projectSource("src", "lib", "humanReview", "scope.ts");
    const checkout = projectSource(
      "supabase",
      "functions",
      "easy-erf-r999-checkout",
      "index.ts",
    );

    expect(source).toContain("HUMAN_REVIEW_FOCUS_OPTIONS.map");
    expect(source).toContain("{HUMAN_REVIEW_SCOPE_BOUNDARY}");
    expect(source).toContain("{HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT}");
    expect(source).toContain("HUMAN_REVIEW_NOT_INCLUDED.map");
    expect(scope).toContain('label: "Property Check"');
    expect(scope).toContain('label: "Property Potential"');
    expect(scope).toContain('label: "Check My Intended Use"');
    expect(scope).not.toContain('label: "Before I Buy"');
    expect(source).toContain('supabase.functions.invoke("easy-erf-r999-checkout"');
    expect(source).toContain('data?.mode !== "test"');
    expect(source).toContain('url.hostname !== "buy.stripe.com"');
    expect(scope).toMatch(/does not provide legal, tax, engineering, architectural, valuation/i);
    expect(source).toMatch(/does not invent a construction quotation or per-m² build-cost estimate/i);
    expect(scope).toMatch(/buy \/ do-not-buy recommendation/i);
    expect(source).not.toMatch(/ask us anything|what do you want to know/i);
    expect(checkout).toContain("EASY_ERF_R999_PAYMENT_LINK_IDS");
    expect(checkout).toContain("STRIPE_SECRET_KEY");
    expect(checkout).toContain("link.livemode");
    expect(checkout).toContain("price.unit_amount !== 99900");
    expect(checkout).toContain('price.currency.toLowerCase() !== "zar"');
    expect(checkout).toContain('verifiedUrl.searchParams.set("client_reference_id", requestRow.id)');
    expect(checkout).not.toMatch(/sk_(test|live)_|whsec_|plink_[A-Za-z0-9]{8,}/);
    expect(scope).not.toMatch(/guaranteed|approved building plan included/i);
  });

  it("keeps active Site Potential deterministic", () => {
    const source = projectSource(
      "src",
      "components",
      "property",
      "dossier",
      "SitePotentialTab.tsx",
    );

    expect(source).toMatch(/Where could a building potentially fit\?/i);
    expect(source).toMatch(/buildable envelope on the map and the same limits from the street side/i);
    expect(source).toMatch(/There are no AI house concepts, generated renders, or facade images/i);
    expect(source).not.toMatch(/generate a visual concept pack/i);
  });

  it("keeps the active workbench free of generated-concept completion semantics", () => {
    const source = componentSource("OfficialParcelPanel.tsx");

    expect(source).toMatch(/parcel\/map build envelope and street-side build lines/i);
    expect(source).toMatch(/review and accept the deterministic build envelope/i);
    expect(source).toMatch(/Accept the deterministic build envelope or skip Site Potential/i);
    expect(source).not.toMatch(/Concepts are visual starting points/i);
    expect(source).not.toMatch(/generate a visual concept pack/i);
    expect(source).not.toMatch(/Select a preferred concept/i);
  });

  it("does not claim stale investor scoring as a live roadmap capability", () => {
    const source = routeSource("roadmap.tsx");

    expect(source).not.toMatch(/Investor-grade scoring/i);
    expect(source).not.toMatch(/Premium research tools/i);
    expect(source).toMatch(/product direction, not a delivery calendar/i);
  });
});
