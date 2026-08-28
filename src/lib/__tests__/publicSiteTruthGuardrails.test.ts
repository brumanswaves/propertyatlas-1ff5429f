import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function routeSource(name: string) {
  return readFileSync(join(process.cwd(), "src", "routes", name), "utf8");
}

function componentSource(name: string) {
  return readFileSync(join(process.cwd(), "src", "components", "property", name), "utf8");
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

  it("keeps the current commercial decision explicit on Pricing", () => {
    const source = routeSource("pricing.tsx");

    expect(source).toMatch(/without a subscription/i);
    expect(source).toMatch(/does not currently operate a live in-app paid report checkout/i);
    expect(source).toMatch(/No subscription right now/i);
    expect(source).not.toMatch(/R\s*[\d,.]+\s*(?:\/|per)\s*month/i);
    expect(source).not.toMatch(/subscriptions automatically renew|auto-renew/i);
  });

  it("keeps the R999 Early Access investigation real and fail-closed", () => {
    const source = routeSource("pricing.tsx");

    expect(source).toMatch(/Easy Erf Property Investigation/);
    expect(source).toMatch(/R999/);
    expect(source).toMatch(/one property, introductory price/i);
    expect(source).toContain("VITE_EASY_ERF_R999_PAYMENT_LINK");
    expect(source).toContain('url.hostname !== "buy.stripe.com"');
    expect(source).toMatch(/Secure checkout is being connected/);
    expect(source).toMatch(/human review/i);
    expect(source).toMatch(/Anything we cannot verify is labelled as unresolved/i);
    expect(source).not.toMatch(/guaranteed|official zoning certificate|approved building plan included/i);
  });

  it("keeps active Site Potential deterministic", () => {
    const source = routeSource("pricing.tsx");

    expect(source).toMatch(/Build envelope, not generated house concepts/i);
    expect(source).toMatch(/parcel map and a street-side view/i);
    expect(source).toMatch(/does not generate house designs, facades or AI building concepts/i);
    expect(source).not.toMatch(/Site Potential concept generation is currently controlled/i);
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
