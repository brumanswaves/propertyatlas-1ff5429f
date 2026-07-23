import { describe, expect, it } from "vitest";
import {
  buildSitePotentialFreeAllowance,
  calculateSitePotentialFreePackUsage,
  chooseSitePotentialEntitlementSource,
  isSitePotentialFreeEligible,
  type SitePotentialFreePackRow,
} from "../betaServer";

function row(iso: string): SitePotentialFreePackRow {
  return { created_at: iso };
}

const NOW = new Date("2026-07-23T12:00:00.000Z");

describe("Site Potential free allowance", () => {
  it("counts rolling 24h, 7d, and 30d usage", () => {
    const rows = [
      row("2026-07-23T10:00:00.000Z"), // within 24h
      row("2026-07-20T10:00:00.000Z"), // within 7d
      row("2026-07-05T10:00:00.000Z"), // within 30d
    ];
    expect(calculateSitePotentialFreePackUsage(rows, NOW)).toEqual({
      used24Hours: 1,
      used7Days: 2,
      used30Days: 3,
    });
  });

  it("allows repeat use on the same erf when rolling limits still have room", () => {
    const sameErf = [row("2026-07-05T00:00:00.000Z")];
    const free = buildSitePotentialFreeAllowance({ rows: sameErf, now: NOW });
    expect(free.remaining24Hours).toBe(1);
    expect(free.remaining7Days).toBe(3);
    expect(free.remaining30Days).toBe(5);
    expect(isSitePotentialFreeEligible(free)).toBe(true);
  });

  it("denies free eligibility when the daily limit is used", () => {
    const free = buildSitePotentialFreeAllowance({
      rows: [row("2026-07-23T09:00:00.000Z")],
      now: NOW,
    });
    expect(free.remaining24Hours).toBe(0);
    expect(isSitePotentialFreeEligible(free)).toBe(false);
  });

  it("denies free eligibility when the weekly limit is used", () => {
    const rows = [
      row("2026-07-22T12:00:00.000Z"),
      row("2026-07-21T12:00:00.000Z"),
      row("2026-07-20T12:00:00.000Z"),
    ];
    const free = buildSitePotentialFreeAllowance({ rows, now: NOW });
    expect(free.remaining7Days).toBe(0);
    expect(isSitePotentialFreeEligible(free)).toBe(false);
  });

  it("denies free eligibility when the monthly limit is used", () => {
    const rows = Array.from({ length: 6 }, (_, i) =>
      row(new Date(NOW.getTime() - (i + 8) * 24 * 60 * 60 * 1000).toISOString()),
    );
    const free = buildSitePotentialFreeAllowance({ rows, now: NOW });
    expect(free.remaining30Days).toBe(0);
    expect(isSitePotentialFreeEligible(free)).toBe(false);
  });

  it("picks free_allowance before beta or purchased credits", () => {
    const free = buildSitePotentialFreeAllowance({ rows: [], now: NOW });
    expect(
      chooseSitePotentialEntitlementSource({
        free,
        betaCreditsRemaining: 5,
        purchasedCredits: 5,
      }),
    ).toBe("free_allowance");
  });

  it("falls back to beta_credit then site_potential_credit", () => {
    const used = buildSitePotentialFreeAllowance({
      rows: [row("2026-07-23T09:00:00.000Z")],
      now: NOW,
    });
    expect(
      chooseSitePotentialEntitlementSource({
        free: used,
        betaCreditsRemaining: 1,
        purchasedCredits: 0,
      }),
    ).toBe("beta_credit");
    expect(
      chooseSitePotentialEntitlementSource({
        free: used,
        betaCreditsRemaining: 0,
        purchasedCredits: 1,
      }),
    ).toBe("site_potential_credit");
    expect(
      chooseSitePotentialEntitlementSource({
        free: used,
        betaCreditsRemaining: 0,
        purchasedCredits: 0,
      }),
    ).toBeNull();
  });
});
