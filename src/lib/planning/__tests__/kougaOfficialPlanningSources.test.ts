import { describe, expect, it } from "vitest";
import {
  canAttemptOfficialZoningDetection,
  findMunicipalityPlanningRegistry,
  findPlanningSource,
  findZone,
  planningSourcesFor,
} from "../municipalityPlanningRegistry";

describe("Kouga official planning source metadata", () => {
  const registry = findMunicipalityPlanningRegistry("Kouga Local Municipality");

  it("makes the municipality-wide 2021 scheme available to Sea Vista investigations", () => {
    expect(registry).not.toBeNull();
    const sourceIds = planningSourcesFor(registry!, "Sea Vista").map((source) => source.id);

    expect(sourceIds).toContain("kouga-land-use-scheme-2021");
    expect(sourceIds).toContain("kouga-st-francis-bay-town-zoning-plan-2020-12");
  });

  it("records the official St Francis Bay zoning-plan artifact without claiming parcel zoning", () => {
    expect(registry).not.toBeNull();
    const source = findPlanningSource(
      registry!,
      "kouga-st-francis-bay-town-zoning-plan-2020-12",
    );

    expect(source?.status).toBe("active");
    expect(source?.jurisdiction).toBe("municipal");
    expect(source?.sourceType).toBe("zoning_map");
    expect(source?.lastVerifiedAt).toBe("2026-08-15");
    expect(source?.planningAreas).toEqual(["Sea Vista"]);
    expect(source?.notes).toMatch(/must not be used alone to assert a parcel zoning/i);
    expect(canAttemptOfficialZoningDetection(registry)).toBe(false);
  });

  it("keeps the unparsed RES1 numbers review-required", () => {
    expect(registry).not.toBeNull();
    const zone = findZone(registry!, "RES1");

    expect(zone?.status).toBe("manual_candidate");
    expect(zone?.rules.length).toBeGreaterThan(0);
    expect(zone?.rules.every((rule) => rule.status === "manual_candidate")).toBe(true);
    expect(zone?.rules.every((rule) => rule.citation == null)).toBe(true);
  });
});
