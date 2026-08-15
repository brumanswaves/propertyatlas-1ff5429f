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

  it("uses stable direct municipal PDF URLs for the verified scheme and town plan", () => {
    expect(registry).not.toBeNull();
    expect(findPlanningSource(registry!, "kouga-land-use-scheme-2021")?.url).toBe(
      "https://www.kouga.gov.za/download/4539",
    );
    expect(
      findPlanningSource(registry!, "kouga-st-francis-bay-town-zoning-plan-2020-12")?.url,
    ).toBe("https://www.kouga.gov.za/download/4531");
  });

  it("records the official St Francis Bay zoning-plan artifact without claiming parcel zoning", () => {
    expect(registry).not.toBeNull();
    const source = findPlanningSource(registry!, "kouga-st-francis-bay-town-zoning-plan-2020-12");

    expect(source?.status).toBe("active");
    expect(source?.jurisdiction).toBe("municipal");
    expect(source?.sourceType).toBe("zoning_map");
    expect(source?.lastVerifiedAt).toBe("2026-08-15");
    expect(source?.planningAreas).toEqual(["Sea Vista"]);
    expect(source?.notes).toMatch(/must not be used alone to assert a parcel zoning/i);
    expect(canAttemptOfficialZoningDetection(registry)).toBe(false);
  });

  it("promotes the verified RES1 definition and rules to cited published evidence", () => {
    expect(registry).not.toBeNull();
    const zone = findZone(registry!, "RES1");

    expect(zone?.status).toBe("active");
    expect(zone?.rules.length).toBeGreaterThan(0);
    expect(zone?.rules.every((rule) => rule.status === "active")).toBe(true);
    expect(zone?.rules.every((rule) => rule.citation?.includes("section 25"))).toBe(true);
    expect(zone?.summary).toMatch(/not evidence that a particular erf is zoned RES1/i);
  });
});
