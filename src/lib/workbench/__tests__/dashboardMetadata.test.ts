import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import {
  DASHBOARD_METADATA_SELECT,
  dashboardProgress,
  validateDashboardRows,
  type DashboardMetadata,
} from "../dashboardMetadata";
const row = (patch: Record<string, unknown> = {}) =>
  ({
    user_id: "owner-A",
    parcel_id: "csg:lpi:test",
    created_at: null,
    projectionVersion: 1,
    projectionParcelId: "csg:lpi:test",
    startedAt: null,
    currentStepId: null,
    reportStarted: false,
    marketEvidenceStarted: false,
    strategyScenarioCount: 0,
    chosenScenarioId: null,
    identityStatus: "none",
    sitePotentialState: "not_started",
    ...patch,
  }) as DashboardMetadata;
describe("dashboard metadata meaning and boundary", () => {
  it("requests only named columns and scalar leaf paths", () => {
    const fields = DASHBOARD_METADATA_SELECT.split(",");
    expect(new Set(fields).size).toBe(fields.length);
    expect(fields).not.toContain("user_data");
    expect(DASHBOARD_METADATA_SELECT).not.toMatch(
      /\*|savedMarketEvidence|researchQuery|reportBody|notes|document/,
    );
    expect(
      fields.every(
        (f) => ["user_id", "parcel_id", "created_at"].includes(f) || /:\w+->\w+/.test(f),
      ),
    ).toBe(true);
  });
  it("preserves real false and zero without manufacturing a start timestamp", () => {
    const p = dashboardProgress(row());
    expect(p.reportStarted).toBe(false);
    expect(p.marketEvidenceStarted).toBe(false);
    expect(p.strategyScenarioCount).toBe(0);
    expect(p.started).toBeNull();
    expect(p.sitePotentialState).toBe("not_started");
  });
  it.each([{}, { projectionVersion: 2 }, { projectionParcelId: "other" }])(
    "keeps unsupported or absent status unknown %j",
    (patch) => {
      const value = Object.keys(patch).length
        ? row(patch)
        : ({ user_id: "owner-A", parcel_id: "csg:lpi:test" } as DashboardMetadata);
      const p = dashboardProgress(value);
      expect(p.source).toBe("none");
      expect(p.reportStarted).toBeNull();
      expect(p.strategyScenarioCount).toBeNull();
      expect(p.started).toBeNull();
    },
  );
  it("uses canonical chosen scenario independently of a missing count", () => {
    const p = dashboardProgress(row({ strategyScenarioCount: null, chosenScenarioId: "chosen" }));
    expect(p.chosenScenarioId).toBe("chosen");
    expect(p.strategyScenarioCount).toBeNull();
  });
  it("does not invent a first step for an unknown stored step", () => {
    const p = dashboardProgress(
      row({ startedAt: "2026-01-01T00:00:00Z", currentStepId: "future-step" }),
    );
    expect(p.started).toBe(true);
    expect(p.currentStepIndex).toBeNull();
    expect(p.currentStepLabel).toBe("Status unavailable");
  });
  it("uses supported step and timestamp metadata", () => {
    const p = dashboardProgress(
      row({
        startedAt: "2026-01-01T00:00:00Z",
        currentStepId: "market",
        lastViewedAt: "2026-01-03T00:00:00Z",
      }),
    );
    expect(p.currentStepIndex).toBe(7);
    expect(p.lastActivityAt).toBe("2026-01-03T00:00:00Z");
  });
  it.each([
    { reportStarted: "false" },
    { strategyScenarioCount: -1 },
    { sitePotentialState: "invented" },
  ])("invalid status is unknown %j", (patch) => {
    const p = dashboardProgress(row(patch));
    for (const key of Object.keys(patch)) expect(p[key as keyof typeof p]).toBeNull();
  });
  it.each([
    { user_id: "owner-B" },
    { parcel_id: "" },
    { projectionParcelId: "other" },
    { displayTitle: {} },
    { user_data: {} },
    { created_at: "not-a-date" },
  ])("rejects mismatched/malformed rows %j", (patch) => {
    expect(() => validateDashboardRows([row(patch)], "owner-A")).toThrow();
  });
  it("rejects duplicates across the entire result", () =>
    expect(() => validateDashboardRows([row(), row()], "owner-A")).toThrow());
  it("keeps legacy identity usable with no invented projection", () => {
    const legacy = {
      user_id: "owner-A",
      parcel_id: "manual:test",
      created_at: null,
      erfNumber: 0,
      portion: 0,
    };
    expect(validateDashboardRows([legacy], "owner-A")[0]).toEqual(legacy);
    expect(dashboardProgress(legacy as DashboardMetadata).source).toBe("none");
  });
});
