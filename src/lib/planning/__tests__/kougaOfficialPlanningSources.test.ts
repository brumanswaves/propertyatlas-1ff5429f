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
    expect(source?.lastVerifiedAt).toBe("2026-08-20");
    expect(source?.planningAreas).toEqual(["Sea Vista"]);
    expect(source?.notes).toMatch(/must not be used alone to assert a parcel zoning/i);
    expect(canAttemptOfficialZoningDetection(registry)).toBe(false);
  });

  it("records the retrieved official scheme and its page-level RES1 citations", () => {
    expect(registry).not.toBeNull();
    const scheme = findPlanningSource(registry!, "kouga-land-use-scheme-2021");
    const zone = findZone(registry!, "RES1");

    expect(scheme?.url).toBe("https://www.kouga.gov.za/download/4539");
    expect(scheme?.lastVerifiedAt).toBe("2026-08-20");
    expect(scheme?.notes).toMatch(/chapter 7 clause 24/i);
    expect(zone?.status).toBe("active");
    expect(zone?.rules.length).toBeGreaterThan(0);
    expect(zone?.rules.every((rule) => rule.status === "active")).toBe(true);
    expect(zone?.rules.every((rule) => rule.citation === "Chapter 7, clause 24, p. 20")).toBe(
      true,
    );
  });

  it("keeps parcel zoning proof separate from verified general RES1 rules", () => {
    expect(registry).not.toBeNull();
    const zone = findZone(registry!, "RES1");
    const text = JSON.stringify(zone).toLowerCase();

    expect(canAttemptOfficialZoningDetection(registry)).toBe(false);
    expect(text).toMatch(/general scheme/);
    expect(text).not.toMatch(/this erf is zoned res1|confirmed parcel zoning|approved for this erf/);
  });
});
