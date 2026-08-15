import { describe, expect, it } from "vitest";
import { buildParcelPlanningAssessment } from "../parcelPlanningAssessment";

function assessment(areaM2: number | null) {
  return buildParcelPlanningAssessment({
    parcelId: `kouga-res1-${areaM2 ?? "unknown"}`,
    municipality: "Kouga Local Municipality",
    locationHints: ["Sea Vista", "St Francis Bay"],
    erfAreaM2: areaM2,
    manualZoneCode: "RES1",
  });
}

function ruleValue(
  result: ReturnType<typeof buildParcelPlanningAssessment>,
  ruleType:
    | "street_building_line"
    | "side_building_line"
    | "rear_building_line"
    | "height"
    | "coverage",
) {
  return result.publishedRules.find((rule) => rule.ruleType === ruleType)?.value ?? null;
}

describe("official Kouga RES1 parcel-area applicability", () => {
  it("selects the official >400 m² controls for canonical Erf 1570's 618.7 m² area", () => {
    const result = assessment(618.7);

    expect(ruleValue(result, "street_building_line")).toBe(3);
    expect(ruleValue(result, "side_building_line")).toBe(1.5);
    expect(ruleValue(result, "rear_building_line")).toBe(1.5);
    expect(ruleValue(result, "height")).toBe(8.5);
    expect(ruleValue(result, "coverage")).toBe(50);
    expect(result.envelope.coveragePercent).toBe(50);
    expect(result.envelope.theoreticalGroundFloorM2).toBeCloseTo(309.35);
    expect(result.publishedRules.every((rule) => rule.status === "active")).toBe(true);
    expect(result.publishedRules.every((rule) => rule.citation != null)).toBe(true);
    expect(result.detection.method).toBe("manual_selection");
    expect(result.detection.confidence).toBe("low");
  });

  it("selects the official <400 m² controls for a smaller RES1 erf", () => {
    const result = assessment(350);

    expect(ruleValue(result, "street_building_line")).toBe(1);
    expect(ruleValue(result, "side_building_line")).toBe(1);
    expect(ruleValue(result, "rear_building_line")).toBe(1);
    expect(ruleValue(result, "height")).toBe(8.5);
    expect(ruleValue(result, "coverage")).toBe(70);
    expect(result.envelope.coveragePercent).toBe(70);
  });

  it("withholds area-conditioned controls when parcel area is unknown", () => {
    const result = assessment(null);

    expect(ruleValue(result, "street_building_line")).toBeNull();
    expect(ruleValue(result, "side_building_line")).toBeNull();
    expect(ruleValue(result, "rear_building_line")).toBeNull();
    expect(ruleValue(result, "coverage")).toBeNull();
    expect(ruleValue(result, "height")).toBe(8.5);
    expect(result.envelope.coveragePercent).toBeNull();
  });

  it("does not invent a side of the scheme's open <400 / >400 split for exactly 400 m²", () => {
    const result = assessment(400);

    expect(ruleValue(result, "street_building_line")).toBeNull();
    expect(ruleValue(result, "side_building_line")).toBeNull();
    expect(ruleValue(result, "rear_building_line")).toBeNull();
    expect(ruleValue(result, "coverage")).toBeNull();
    expect(ruleValue(result, "height")).toBe(8.5);
  });
});
