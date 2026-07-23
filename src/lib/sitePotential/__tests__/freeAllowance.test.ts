import { describe, expect, it } from "vitest";
import {
  buildSitePotentialFreeAllowance,
  calculateSitePotentialFreePackUsage,
  chooseSitePotentialEntitlementSource,
  isSitePotentialFreeEligible,
  type SitePotentialFreePackRow,
} from "../betaServer";

const NOW = new Date("2026-07-23T12:00:00.000Z");

function row(iso: string, _parcelId?: string): SitePotentialFreePackRow {
  return { created_at: iso };
}

function hoursAgo(hours: number) {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("Site Potential free allowance", () => {
  it("counts rolling 24h, 7d, and 30d usage across same and different parcels", () => {
    const rows = [
      row(hoursAgo(2), "erf-A"),
      row(daysAgo(3), "erf-A"),
      row(daysAgo(3), "erf-B"),
      row(daysAgo(20), "erf-C"),
    ];
    expect(calculateSitePotentialFreePackUsage(rows, NOW)).toEqual({
      used24Hours: 1,
      used7Days: 3,
      used30Days: 4,
    });
  });

  it("ignores rows older than 30 days", () => {
    const rows = [row(daysAgo(45), "erf-old"), row(daysAgo(3), "erf-A")];
    expect(calculateSitePotentialFreePackUsage(rows, NOW)).toEqual({
      used24Hours: 0,
      used7Days: 1,
      used30Days: 1,
    });
  });

  it("allows a second pack on the same erf after 25 hours", () => {
    const rows = [row(hoursAgo(25), "erf-A")];
    const free = buildSitePotentialFreeAllowance(
      calculateSitePotentialFreePackUsage(rows, NOW),
    );
    expect(free).toEqual({
      used24Hours: 0,
      used7Days: 1,
      used30Days: 1,
      remaining24Hours: 1,
      remaining7Days: 2,
      remaining30Days: 5,
    });
    expect(isSitePotentialFreeEligible(free)).toBe(true);
  });

  it("allows three packs within seven days", () => {
    const rows = [
      row(hoursAgo(25), "erf-A"),
      row(daysAgo(3), "erf-A"),
    ];
    const free = buildSitePotentialFreeAllowance(
      calculateSitePotentialFreePackUsage(rows, NOW),
    );
    expect(free.remaining7Days).toBe(1);
    expect(isSitePotentialFreeEligible(free)).toBe(true);
  });

  it("blocks a fourth pack inside the same seven-day window", () => {
    const rows = [
      row(hoursAgo(25), "erf-A"),
      row(daysAgo(2), "erf-A"),
      row(daysAgo(4), "erf-A"),
    ];
    const free = buildSitePotentialFreeAllowance(
      calculateSitePotentialFreePackUsage(rows, NOW),
    );
    expect(free.remaining7Days).toBe(0);
    expect(isSitePotentialFreeEligible(free)).toBe(false);
  });

  it("allows six packs across 30 days on the same erf", () => {
    const rows = [
      row(hoursAgo(25), "erf-A"),
      row(daysAgo(8), "erf-A"),
      row(daysAgo(12), "erf-A"),
      row(daysAgo(16), "erf-A"),
      row(daysAgo(20), "erf-A"),
    ];
    const free = buildSitePotentialFreeAllowance(
      calculateSitePotentialFreePackUsage(rows, NOW),
    );
    expect(free.used30Days).toBe(5);
    expect(free.remaining30Days).toBe(1);
    expect(isSitePotentialFreeEligible(free)).toBe(true);
  });

  it("blocks the seventh pack inside a 30 day window", () => {
    const rows = [
      row(hoursAgo(25), "erf-A"),
      row(daysAgo(8), "erf-A"),
      row(daysAgo(12), "erf-A"),
      row(daysAgo(16), "erf-A"),
      row(daysAgo(20), "erf-A"),
      row(daysAgo(25), "erf-A"),
    ];
    const free = buildSitePotentialFreeAllowance(
      calculateSitePotentialFreePackUsage(rows, NOW),
    );
    expect(free.used30Days).toBe(6);
    expect(free.remaining30Days).toBe(0);
    expect(isSitePotentialFreeEligible(free)).toBe(false);
  });

  it("counts cross-parcel usage against the same rolling limits", () => {
    const rows = [
      row(hoursAgo(25), "erf-A"),
      row(daysAgo(2), "erf-B"),
      row(daysAgo(4), "erf-C"),
    ];
    const free = buildSitePotentialFreeAllowance(
      calculateSitePotentialFreePackUsage(rows, NOW),
    );
    expect(free.used7Days).toBe(3);
    expect(free.remaining7Days).toBe(0);
    expect(isSitePotentialFreeEligible(free)).toBe(false);
  });

  it("picks free_allowance before beta or purchased credits when eligible", () => {
    expect(
      chooseSitePotentialEntitlementSource({
        freeEligible: true,
        betaCreditsRemaining: 5,
        purchasedCredits: 5,
      }),
    ).toBe("free_allowance");
  });

  it("falls back to beta_credit then site_potential_credit", () => {
    expect(
      chooseSitePotentialEntitlementSource({
        freeEligible: false,
        betaCreditsRemaining: 1,
        purchasedCredits: 0,
      }),
    ).toBe("beta_credit");
    expect(
      chooseSitePotentialEntitlementSource({
        freeEligible: false,
        betaCreditsRemaining: 0,
        purchasedCredits: 1,
      }),
    ).toBe("site_potential_credit");
    expect(
      chooseSitePotentialEntitlementSource({
        freeEligible: false,
        betaCreditsRemaining: 0,
        purchasedCredits: 0,
      }),
    ).toBeNull();
  });
});
