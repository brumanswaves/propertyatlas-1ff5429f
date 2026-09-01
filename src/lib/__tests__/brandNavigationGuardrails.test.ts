import { describe, expect, it } from "vitest";
import { BRAND } from "../brand";
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_PRODUCT_LINKS,
  FOOTER_RESOURCE_LINKS,
  PRIMARY_NAV_LINKS,
  SECONDARY_OR_LEGACY_PUBLIC_ROUTES,
  SIGNED_IN_NAV_LINKS,
} from "../navigation";

describe("Easy Erf brand and navigation guardrails", () => {
  it("keeps canonical customer-facing terminology", () => {
    expect(BRAND.site).toBe("Easy Erf");
    expect(BRAND.workflow).toBe("Guided Investigation");
    expect(BRAND.reports).toBe("Easy Erf Report");
    expect(BRAND.savedArea).toBe("My Properties");
    expect(BRAND.aiAction).toBe("Ask Easy Erf");
    expect(JSON.stringify(BRAND)).not.toMatch(/PropertyAtlas|ErfStoep/i);
  });

  it("keeps primary navigation focused on the three customer entry decisions", () => {
    expect(PRIMARY_NAV_LINKS).toEqual([
      { to: "/", label: "Find a Property" },
      { to: "/how-it-works", label: "How It Works" },
      { to: "/pricing", label: "Done for You" },
    ]);
  });

  it("keeps account navigation separate and consistently named", () => {
    expect(SIGNED_IN_NAV_LINKS).toEqual([
      { to: "/dashboard", label: "My Properties" },
      { to: "/profile", label: "Account" },
    ]);
  });

  it("does not allow secondary or legacy marketing routes back into primary navigation", () => {
    const primaryRoutes = new Set<string>(PRIMARY_NAV_LINKS.map((link) => link.to));
    for (const route of SECONDARY_OR_LEGACY_PUBLIC_ROUTES) {
      expect(primaryRoutes.has(route)).toBe(false);
    }
  });

  it("keeps supporting content in the footer rather than primary navigation", () => {
    const footerRoutes = new Set<string>([
      ...FOOTER_PRODUCT_LINKS,
      ...FOOTER_RESOURCE_LINKS,
      ...FOOTER_LEGAL_LINKS,
    ].map((link) => link.to));

    expect(footerRoutes).toContain("/dashboard");
    expect(footerRoutes).not.toContain("/orders");
    expect(footerRoutes).toContain("/faq");
    expect(footerRoutes).toContain("/data-sources");
    expect(footerRoutes).toContain("/about");
    expect(footerRoutes).toContain("/contact");
    expect(footerRoutes).not.toContain("/subscriptions");
    expect(footerRoutes).not.toContain("/features");
  });
});
