import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("Easy Erf MVP regression guardrails", () => {
  it("keeps the trusted account recovery and verification UX", () => {
    const auth = source("../../routes/auth.tsx");
    expect(auth).toContain("Forgot your password?");
    expect(auth).toContain("resetPasswordForEmail");
    expect(auth).toContain("Show password");
    expect(auth).toContain("Check your email");
    expect(auth).toContain("emailRedirectTo: authRedirect");
    expect(auth).toContain('authRedirect("/auth?oauth=1")');
  });

  it("keeps the global header readable on light pages", () => {
    const nav = source("../../components/layout/TopNav.tsx");
    expect(nav).toContain("bg-primary/95");
    expect(nav).toContain("text-white/80");
    expect(nav).not.toContain("Start free");
  });

  it("keeps the R999 human-reviewed investigation as the commercial MVP", () => {
    const pricing = source("../../routes/pricing.tsx");
    expect(pricing).toContain("R999");
    expect(pricing).toContain("once-off");
    expect(pricing).toContain("Human-reviewed before delivery");
    expect(pricing).toContain("Property Truth");
    expect(pricing).toContain("key risks or deal killers");
    expect(pricing).not.toContain("Start free");
  });

  it("keeps Site Potential focused on site evidence rather than concept generation", () => {
    const sitePotential = source("../../components/property/dossier/SitePotentialTab.tsx");
    const guided = source("../../components/property/investigation/GuidedSitePotentialStep.tsx");
    expect(sitePotential).not.toContain("Generate three independent Site Potential concepts");
    expect(sitePotential).not.toContain("beta-redeem");
    expect(sitePotential).not.toContain("Generate 3 concepts");
    expect(sitePotential).toContain("approximate buildable area");
    expect(guided).toContain("no longer requires generating multiple AI house concepts");
  });

  it("keeps the working-zoning choice visually prominent", () => {
    const repairs = source("../../styles/mvp-repairs.css");
    expect(repairs).toContain('label[for="guided-zone-code"]');
    expect(repairs).toContain("Confirm this first");
    expect(repairs).toContain("#guided-zone-code");
  });
});
