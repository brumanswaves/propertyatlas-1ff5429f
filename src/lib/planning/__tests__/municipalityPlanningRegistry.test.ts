import { describe, expect, it } from "vitest";
import {
  activePlanningSources,
  canAttemptOfficialZoningDetection,
  findMunicipalityPlanningRegistry,
  findZone,
  guidelinesForPlanningArea,
  matchPlanningArea,
  nonEnforceablePlanningSources,
  planningSourcesFor,
} from "../municipalityPlanningRegistry";
import { KOUGA_PLANNING_REGISTRY } from "../kougaPlanningRegistry";

describe("municipality planning registry", () => {
  it("matches Kouga from free-text municipality values", () => {
    expect(findMunicipalityPlanningRegistry("Kouga")?.municipality).toBe(
      "Kouga Local Municipality",
    );
    expect(findMunicipalityPlanningRegistry("KOUGA LOCAL MUNICIPALITY")?.municipality).toBe(
      "Kouga Local Municipality",
    );
    expect(findMunicipalityPlanningRegistry("Nelson Mandela Bay")).toBeNull();
    expect(findMunicipalityPlanningRegistry(null)).toBeNull();
  });

  it("matches the most specific planning area from location hints", () => {
    expect(
      matchPlanningArea(KOUGA_PLANNING_REGISTRY, ["12 Harbour Road, St Francis Bay Canals"]),
    ).toBe("St Francis Bay Canals");
    expect(matchPlanningArea(KOUGA_PLANNING_REGISTRY, ["Oyster Bay"])).toBe("Oyster Bay");
    expect(matchPlanningArea(KOUGA_PLANNING_REGISTRY, [null, ""])).toBeNull();
  });

  it("separates active sources from draft, pending and review-required material", () => {
    const active = activePlanningSources(KOUGA_PLANNING_REGISTRY).map((s) => s.id);
    expect(active).toContain("kouga-land-use-scheme-2021");
    expect(active).not.toContain("kouga-building-aesthetics-2025");
    expect(active).not.toContain("kouga-draft-aesthetics-2020");

    const nonEnforceable = nonEnforceablePlanningSources(KOUGA_PLANNING_REGISTRY).map((s) => s.id);
    expect(nonEnforceable).toEqual(
      expect.arrayContaining(["kouga-building-aesthetics-2025", "kouga-draft-aesthetics-2020"]),
    );
  });

  it("never returns superseded sources and filters by planning area", () => {
    const sources = planningSourcesFor(KOUGA_PLANNING_REGISTRY, "Oyster Bay");
    expect(sources.every((source) => source.status !== "superseded")).toBe(true);
    // The 2020 draft applies to Sea Vista / St Francis, not Oyster Bay.
    expect(sources.map((s) => s.id)).not.toContain("kouga-draft-aesthetics-2020");
    expect(
      planningSourcesFor(KOUGA_PLANNING_REGISTRY, "Sea Vista").map((s) => s.id),
    ).toContain("kouga-draft-aesthetics-2020");
  });

  it("returns Residential Zone 1 rules with citations and review-required status", () => {
    const zone = findZone(KOUGA_PLANNING_REGISTRY, "res1");
    expect(zone?.name).toContain("Residential Zone 1");
    const height = zone?.rules.find((rule) => rule.ruleType === "height");
    expect(height?.value).toBe(8.5);
    expect(height?.unit).toBe("m");
    expect(height?.sourceId).toBe("kouga-land-use-scheme-2021");
    // Values from the brief were NOT confirmable against the official document.
    expect(zone?.rules.every((rule) => rule.status === "manual_candidate")).toBe(true);
    expect(height?.interpretation).toMatch(/have not yet been confirmed/i);
  });

  it("does not claim automatic zoning polygon detection is available", () => {
    expect(KOUGA_PLANNING_REGISTRY.zoningPolygonAdapter).toBeNull();
    expect(canAttemptOfficialZoningDetection(KOUGA_PLANNING_REGISTRY)).toBe(false);
  });

  it("matches draft guidelines only where they apply and marks them draft", () => {
    const guidelines = guidelinesForPlanningArea(KOUGA_PLANNING_REGISTRY, "St Francis Bay Canals");
    const draft = guidelines.find((g) => g.id === "kouga-guideline-draft-aesthetics-2020");
    expect(draft?.status).toBe("draft");
    expect(draft?.confidence).toBe("low");
    expect(
      guidelinesForPlanningArea(KOUGA_PLANNING_REGISTRY, "Humansdorp").map((g) => g.id),
    ).not.toContain("kouga-guideline-draft-aesthetics-2020");
  });

  it("never presents any source text as a confirmed parcel-specific right", () => {
    const text = JSON.stringify(KOUGA_PLANNING_REGISTRY).toLowerCase();
    expect(text).not.toMatch(/you can build/);
    expect(text).not.toMatch(/illegal structure/);
    expect(text).not.toMatch(/approved for this erf/);
  });
});
