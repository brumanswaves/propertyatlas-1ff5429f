import { describe, expect, it } from "vitest";
import {
  buildSitePotentialFreeAllowance,
  calculateSitePotentialFreePackUsage,
  chooseSitePotentialEntitlementSource,
  isSitePotentialFreeEligible,
  type SitePotentialFreePackRow,
} from "../betaServer";

const NOW = new Date("2026-07-23T12:00:00.000Z");

function hoursAgo(hours: number) {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function row(created_at: string, parcelId = "same-erf"): SitePotentialFreePackRow & {
  parcel_id: string;
} {
  return { created_at, parcel_id: parcelId };
}

function allowance(rows: SitePotentialFreePackRow[]) {
  return buildSitePotentialFreeAllowance(calculateSitePotentialFreePackUsage(rows, NOW));
}

describe("Site Potential free allowance rolling limits", () => {
  it("marks a user with no recent usage as free-eligible", () => {
    const free = allowance([]);

    expect(free).toMatchObject({
      used24Hours: 0,
      used7Days: 0,
      used30Days: 0,
      remaining24Hours: 1,
      remaining7Days: 3,
      remaining30Days: 6,
    });
    expect(isSitePotentialFreeEligible(free)).toBe(true);
  });

  it("allows a second free pack for the same parcel after the rolling 24-hour limit clears", () => {
    const free = allowance([row(hoursAgo(25))]);

    expect(free).toMatchObject({
      used24Hours: 0,
      used7Days: 1,
      used30Days: 1,
      remaining24Hours: 1,
      remaining7Days: 2,
      remaining30Days: 5,
    });
    expect(isSitePotentialFreeEligible(free)).toBe(true);
  });

  it("does not independently block free eligibility because history is for the same parcel", () => {
    const sameParcelFree = allowance([row(daysAgo(2)), row(daysAgo(4))]);
    const differentParcelFree = allowance([row(daysAgo(2), "erf-a"), row(daysAgo(4), "erf-b")]);

    expect(sameParcelFree).toEqual(differentParcelFree);
    expect(isSitePotentialFreeEligible(sameParcelFree)).toBe(true);
  });

  it("allows three packs for one parcel inside seven days when timestamps respect the daily limit", () => {
    const free = allowance([row(daysAgo(2)), row(daysAgo(4))]);

    expect(free).toMatchObject({
      used24Hours: 0,
      used7Days: 2,
      used30Days: 2,
      remaining24Hours: 1,
      remaining7Days: 1,
      remaining30Days: 4,
    });
    expect(isSitePotentialFreeEligible(free)).toBe(true);
  });

  it("blocks a fourth pack inside the rolling seven-day window", () => {
    const free = allowance([row(daysAgo(2)), row(daysAgo(4)), row(daysAgo(6))]);

    expect(free).toMatchObject({
      used24Hours: 0,
      used7Days: 3,
      remaining7Days: 0,
    });
    expect(isSitePotentialFreeEligible(free)).toBe(false);
  });

  it("allows six packs for one parcel inside 30 days when daily and weekly limits permit", () => {
    const free = allowance([
      row(daysAgo(8)),
      row(daysAgo(10)),
      row(daysAgo(12)),
      row(daysAgo(16)),
      row(daysAgo(20)),
    ]);

    expect(free).toMatchObject({
      used24Hours: 0,
      used7Days: 0,
      used30Days: 5,
      remaining24Hours: 1,
      remaining7Days: 3,
      remaining30Days: 1,
    });
    expect(isSitePotentialFreeEligible(free)).toBe(true);
  });

  it("blocks a seventh pack inside the rolling 30-day window", () => {
    const free = allowance([
      row(daysAgo(4)),
      row(daysAgo(8)),
      row(daysAgo(12)),
      row(daysAgo(16)),
      row(daysAgo(20)),
      row(daysAgo(24)),
    ]);

    expect(free).toMatchObject({
      used30Days: 6,
      remaining30Days: 0,
    });
    expect(isSitePotentialFreeEligible(free)).toBe(false);
  });

  it("counts historical packs from different parcels toward the same user limits", () => {
    const free = allowance([row(daysAgo(2), "erf-a"), row(daysAgo(3), "erf-b"), row(daysAgo(4), "erf-c")]);

    expect(free).toMatchObject({
      used7Days: 3,
      remaining7Days: 0,
    });
    expect(isSitePotentialFreeEligible(free)).toBe(false);
  });

  it("ignores parcel identity when computing freeEligible", () => {
    const sameParcel = isSitePotentialFreeEligible(allowance([row(daysAgo(10))]));
    const differentParcel = isSitePotentialFreeEligible(allowance([row(daysAgo(10), "other-erf")]));

    expect(sameParcel).toBe(true);
    expect(differentParcel).toBe(true);
  });

  it("falls back to beta/test or purchased credits when free allowance is exhausted", () => {
    const freeEligible = false;

    expect(
      chooseSitePotentialEntitlementSource({
        freeEligible,
        betaCreditsRemaining: 1,
        purchasedCredits: 0,
      }),
    ).toBe("beta_credit");
    expect(
      chooseSitePotentialEntitlementSource({
        freeEligible,
        betaCreditsRemaining: 0,
        purchasedCredits: 1,
      }),
    ).toBe("site_potential_credit");
    expect(
      chooseSitePotentialEntitlementSource({
        freeEligible,
        betaCreditsRemaining: 0,
        purchasedCredits: 0,
      }),
    ).toBeNull();
  });
});
