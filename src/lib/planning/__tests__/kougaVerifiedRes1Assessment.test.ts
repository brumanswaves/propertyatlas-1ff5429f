import { describe, expect, it } from "vitest";
import {
  buildParcelPlanningAssessment,
  zoningRuleAppliesToErfArea,
} from "../parcelPlanningAssessment";
import { findMunicipalityPlanningRegistry, findZone } from "../municipalityPlanningRegistry";

const parcelBase = {
  municipality: "Kouga Local Municipality",
  locationHints: ["Sea Vista, St Francis Bay"],
  manualZoneCode: "RES1",
};

describe("verified Kouga Residential Zone 1 assessment", () => {
  it("uses the official >400 m² rule row for the Erf 1570 acceptance area", () => {
    const assessment = buildParcelPlanningAssessment({
      ...parcelBase,
      parcelId: "erf-1570",
      erfAreaM2: 618.7,
    });

    const byType = Object.fromEntries(
      assessment.publishedRules.map((rule) => [rule.ruleType, rule]),
    );

    expect(assessment.detection.method).toBe("manual_selection");
    expect(assessment.detection.confidence).toBe("low");
    expect(byType.coverage.value).toBe(50);
    expect(byType.street_building_line.value).toBe(3);
    expect(byType.side_building_line.value).toBe(1.5);
    expect(byType.rear_building_line.value).toBe(1.5);
    expect(byType.height.value).toBe(8.5);
    expect(byType.coverage.status).toBe("active");
    expect(byType.coverage.citation).toBe("Chapter 7, clause 24, p. 20");
    expect(assessment.envelope.theoreticalGroundFloorM2).toBe(309.35);
    expect(assessment.envelope.confidence).toBe("medium");
    expect(assessment.headlineWarning).toMatch(/published general rules/i);
    expect(assessment.headlineWarning).toMatch(/have not yet been confirmed for this erf/i);
  });

  it("uses the official <400 m² rule row for smaller RES1 erven", () => {
    const assessment = buildParcelPlanningAssessment({
      ...parcelBase,
      parcelId: "small-res1-erf",
      erfAreaM2: 350,
    });
    const byType = Object.fromEntries(
      assessment.publishedRules.map((rule) => [rule.ruleType, rule]),
    );

    expect(byType.coverage.value).toBe(70);
    expect(byType.street_building_line.value).toBe(1);
    expect(byType.side_building_line.statement).toMatch(/one boundary/i);
    expect(byType.rear_building_line.value).toBe(1);
    expect(assessment.envelope.theoreticalGroundFloorM2).toBe(245);
  });

  it("does not guess a size-band rule when the erf area is exactly 400 m²", () => {
    const assessment = buildParcelPlanningAssessment({
      ...parcelBase,
      parcelId: "boundary-res1-erf",
      erfAreaM2: 400,
    });

    expect(assessment.publishedRules.some((rule) => rule.ruleType === "coverage")).toBe(false);
    expect(
      assessment.publishedRules.some((rule) => rule.ruleType === "street_building_line"),
    ).toBe(false);
    expect(assessment.publishedRules.some((rule) => rule.ruleType === "height")).toBe(true);
    expect(assessment.envelope.coveragePercent).toBeNull();
    expect(assessment.envelope.missingConstraints).toContain("Published coverage rule");
  });

  it("does not guess a size-band rule when the erf area is unavailable", () => {
    const assessment = buildParcelPlanningAssessment({
      ...parcelBase,
      parcelId: "unknown-area-res1-erf",
      erfAreaM2: null,
    });

    expect(assessment.publishedRules.some((rule) => rule.erfAreaCondition)).toBe(false);
    expect(assessment.publishedRules.some((rule) => rule.ruleType === "height")).toBe(true);
    expect(assessment.publishedRules.some((rule) => rule.ruleType === "dwelling_units")).toBe(true);
  });

  it("keeps official general scheme rules separate from parcel-specific zoning proof", () => {
    const registry = findMunicipalityPlanningRegistry("Kouga Local Municipality");
    const zone = registry ? findZone(registry, "RES1") : null;
    const coverage = zone?.rules.find(
      (rule) => rule.ruleType === "coverage" && rule.value === 50,
    );

    expect(registry?.zoningPolygonAdapter).toBeNull();
    expect(zone?.status).toBe("active");
    expect(coverage).toBeTruthy();
    expect(zoningRuleAppliesToErfArea(coverage!, 618.7)).toBe(true);
    expect(zoningRuleAppliesToErfArea(coverage!, 350)).toBe(false);

    const assessment = buildParcelPlanningAssessment({
      ...parcelBase,
      parcelId: "erf-1570",
      erfAreaM2: 618.7,
      manualZoneCode: null,
    });
    expect(assessment.detection.method).toBe("not_detected");
    expect(assessment.zone).toBeNull();
    expect(assessment.publishedRules).toHaveLength(0);
  });
});
