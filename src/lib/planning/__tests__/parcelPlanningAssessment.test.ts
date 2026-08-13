import { describe, expect, it } from "vitest";
import { calculateBuildableEnvelope } from "../buildableEnvelope";
import { buildParcelPlanningAssessment } from "../parcelPlanningAssessment";
import { findZone } from "../municipalityPlanningRegistry";
import { KOUGA_PLANNING_REGISTRY } from "../kougaPlanningRegistry";

const RES1 = findZone(KOUGA_PLANNING_REGISTRY, "RES1")!;
const coverageRule = RES1.rules.find((r) => r.ruleType === "coverage")!;
const heightRule = RES1.rules.find((r) => r.ruleType === "height")!;

const baseInput = {
  parcelId: "erf-1570",
  municipality: "Kouga Local Municipality",
  locationHints: ["Sea Vista, St Francis Bay"],
  erfAreaM2: 619,
  manualZoneCode: "RES1",
};

describe("buildable envelope", () => {
  it("computes the theoretical ground-floor footprint for Erf 1570", () => {
    const envelope = calculateBuildableEnvelope({
      erfAreaM2: 619,
      coverageRule,
      heightRule,
      hasParcelPolygon: false,
      hasStreetEdgeReference: false,
    });
    expect(envelope.theoreticalGroundFloorM2).toBe(309.5);
    expect(envelope.coveragePercent).toBe(50);
    expect(envelope.heightLimitM).toBe(8.5);
    expect(envelope.caveat).toMatch(/theoretical only/i);
    // Candidate rules can never be more than low confidence.
    expect(envelope.confidence).toBe("low");
  });

  it("never invents a setback-constrained area without geometry", () => {
    const noGeometry = calculateBuildableEnvelope({
      erfAreaM2: 619,
      coverageRule,
      heightRule,
      hasParcelPolygon: false,
      hasStreetEdgeReference: false,
    });
    expect(noGeometry.setbackConstrainedM2).toBeNull();
    expect(noGeometry.setbackCalculationSkippedReason).toMatch(/no parcel polygon/i);

    const polygonOnly = calculateBuildableEnvelope({
      erfAreaM2: 619,
      coverageRule,
      heightRule,
      hasParcelPolygon: true,
      hasStreetEdgeReference: false,
    });
    expect(polygonOnly.setbackConstrainedM2).toBeNull();
    expect(polygonOnly.setbackCalculationSkippedReason).toMatch(/street edge/i);
  });

  it("reports missing constraints instead of guessing", () => {
    const envelope = calculateBuildableEnvelope({
      erfAreaM2: null,
      coverageRule: null,
      heightRule: null,
      hasParcelPolygon: false,
      hasStreetEdgeReference: false,
    });
    expect(envelope.theoreticalGroundFloorM2).toBeNull();
    expect(envelope.confidence).toBe("unverified");
    expect(envelope.missingConstraints).toEqual(
      expect.arrayContaining(["Confirmed erf area", "Published coverage rule"]),
    );
  });
});

describe("parcel planning assessment", () => {
  it("falls back to manual selection and never claims official polygon detection", () => {
    const assessment = buildParcelPlanningAssessment(baseInput);
    expect(assessment.registryMatched).toBe(true);
    expect(assessment.planningArea).toBe("Sea Vista");
    expect(assessment.detection.method).toBe("manual_selection");
    expect(assessment.detection.suppliedBy).toMatch(/selected manually/i);
    expect(assessment.detection.confidence).toBe("low");
    expect(assessment.headlineWarning).toMatch(/have not yet been confirmed/i);
  });

  it("keeps a user-confirmed working zone distinct from document-backed zoning", () => {
    const assessment = buildParcelPlanningAssessment({
      ...baseInput,
      userConfirmedZoneCode: "RES1",
    });

    expect(assessment.userConfirmedZoneCode).toBe("RES1");
    expect(assessment.detection.method).toBe("manual_selection");
    expect(assessment.detection.supportingAssetId).toBeNull();
    expect(assessment.detection.statement).toMatch(/not been confirmed with the municipality/i);
  });

  it("shows a not-detected state when no zone has been chosen", () => {
    const assessment = buildParcelPlanningAssessment({ ...baseInput, manualZoneCode: null });
    expect(assessment.detection.method).toBe("not_detected");
    expect(assessment.detection.statement).toMatch(/not automatically confirmed/i);
    expect(assessment.zone).toBeNull();
    expect(assessment.permittedUseSummary).toMatch(/no zone is confirmed/i);
  });

  it("treats an attached zoning document as document-supported, never certified", () => {
    const assessment = buildParcelPlanningAssessment({
      ...baseInput,
      manualZoneCode: null,
      documentZoneCode: "RES1",
      documentZoneAssetId: "asset-9",
      evidence: { zoningCertificateUploaded: true },
    });
    expect(assessment.detection.method).toBe("document_supported");
    expect(assessment.detection.supportingAssetId).toBe("asset-9");
    expect(assessment.detection.statement).toMatch(/does not certify/i);
    expect(assessment.verifiedRights.map((r) => r.id)).toContain("right-zoning-certificate");
  });

  it("keeps published rules separate from verified parcel rights", () => {
    const assessment = buildParcelPlanningAssessment(baseInput);
    expect(assessment.publishedRules.length).toBeGreaterThan(0);
    expect(assessment.verifiedRights).toHaveLength(0);
    expect(assessment.checklist.find((c) => c.id === "check-published-rules")?.status).toBe(
      "published_general_rule",
    );
  });

  it("flags a map/scheme conflict when an observed zone disagrees", () => {
    const assessment = buildParcelPlanningAssessment({
      ...baseInput,
      observedZoneLabel: "Business Zone 2",
    });
    expect(assessment.riskFlags.map((r) => r.id)).toContain("risk-map-scheme-conflict");
    expect(assessment.checklist.find((c) => c.id === "check-zoning")?.status).toBe("conflict");
  });

  it("generates cautious risk flags and never asserts illegality", () => {
    const assessment = buildParcelPlanningAssessment(baseInput);
    const ids = assessment.riskFlags.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "risk-zoning-not-confirmed",
        "risk-title-restrictions",
        "risk-sg-servitudes",
        "risk-approved-plans-missing",
        "risk-environmental-overlay",
      ]),
    );
    const text = JSON.stringify(assessment).toLowerCase();
    expect(text).not.toMatch(/illegal structure/);
    expect(text).not.toMatch(/can definitely/);
  });

  it("does not raise a boundary/setback flag without geometry", () => {
    const assessment = buildParcelPlanningAssessment(baseInput);
    expect(assessment.riskFlags.map((r) => r.id)).not.toContain("risk-setback-geometry-review");
  });

  it("demotes actions as evidence appears", () => {
    const before = buildParcelPlanningAssessment(baseInput);
    expect(before.actions.map((a) => a.id)).toContain("action-upload-plans");
    expect(before.actions.map((a) => a.id)).not.toContain("action-compare-structures");

    const after = buildParcelPlanningAssessment({
      ...baseInput,
      evidence: {
        approvedBuildingPlansUploaded: true,
        titleDeedSearchable: true,
        servitudesConfirmed: true,
      },
    });
    expect(after.actions.map((a) => a.id)).not.toContain("action-upload-plans");
    expect(after.actions.map((a) => a.id)).not.toContain("action-check-title");
    expect(after.actions.map((a) => a.id)).toContain("action-compare-structures");
    expect(after.actions.every((action) => action.completed === false)).toBe(true);
    expect(after.actions.map((a) => a.order)).toEqual(after.actions.map((_, i) => i + 1));
  });

  it("produces the full checklist status vocabulary honestly", () => {
    const assessment = buildParcelPlanningAssessment({
      ...baseInput,
      evidence: { titleDeedSearchable: true, sgDiagramSearchable: true },
    });
    const byId = Object.fromEntries(assessment.checklist.map((item) => [item.id, item.status]));
    expect(byId["check-title-deed"]).toBe("verified");
    expect(byId["check-servitudes"]).toBe("needs_professional_confirmation");
    expect(byId["check-approved-plans"]).toBe("missing");
    expect(byId["check-published-rules"]).toBe("published_general_rule");
    expect(assessment.missingEvidence).toEqual(expect.arrayContaining(["Approved building plans"]));
  });

  it("returns no registry rules for an unsupported municipality", () => {
    const assessment = buildParcelPlanningAssessment({
      ...baseInput,
      municipality: "City of Cape Town",
    });
    expect(assessment.registryMatched).toBe(false);
    expect(assessment.publishedRules).toHaveLength(0);
    expect(assessment.detection.method).toBe("not_detected");
  });
});
