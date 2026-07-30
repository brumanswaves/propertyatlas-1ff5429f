import { describe, expect, it } from "vitest";
import { buildSitePotentialRulePrefill } from "@/lib/sitePotential/planningRuleAdapter";
import type {
  ParcelPlanningAssessment,
  ZoningRule,
  ZoningRuleType,
  ZoneDefinition,
  MunicipalityPlanningSource,
} from "@/lib/planning/municipalityPlanningTypes";

function rule(overrides: Partial<ZoningRule> & { ruleType: ZoningRuleType }): ZoningRule {
  return {
    id: `rule-${overrides.ruleType}`,
    label: overrides.ruleType,
    value: 10,
    unit: "m",
    statement: `${overrides.ruleType} statement`,
    conditions: [],
    sourceId: "source-1",
    citation: "Section 4.2",
    status: "active",
    interpretation: "Cautious reading.",
    ...overrides,
  };
}

const zoningSource: MunicipalityPlanningSource = {
  id: "source-1",
  municipality: "Kouga",
  title: "Kouga Land Use Scheme 2021",
  sourceType: "land_use_scheme",
  url: "https://example.com/scheme.pdf",
  jurisdiction: "municipal",
  status: "active",
  version: "2021",
  effectiveDate: "2021-01-01",
  publishedDate: "2021-01-01",
  lastVerifiedAt: "2021-06-01",
  planningAreas: [],
  notes: "",
};

function zone(overrides: Partial<ZoneDefinition> = {}): ZoneDefinition {
  return {
    code: "R1",
    name: "Single Residential",
    municipality: "Kouga",
    permittedUses: ["Dwelling house"],
    consentUses: ["Second dwelling"],
    rules: [],
    sourceId: "source-1",
    status: "active",
    summary: "Single residential zone.",
    ...overrides,
  };
}

function baseAssessment(overrides: Partial<ParcelPlanningAssessment> = {}): ParcelPlanningAssessment {
  return {
    parcelId: "erf-1",
    municipality: "Kouga",
    planningArea: "Jeffreys Bay",
    registryMatched: true,
    detection: {
      method: "manual_selection",
      zoneCode: "R1",
      zoneName: "Single Residential",
      confidence: "low",
      suppliedBy: "Selected manually by the user",
      supportingAssetId: null,
      statement: "Zoning was selected manually, not detected from an official zoning polygon. It has not been confirmed with the municipality.",
    },
    zone: zone(),
    publishedRules: [],
    verifiedRights: [],
    possibleRestrictions: [],
    guidelines: [],
    overlays: [],
    envelope: {
      erfAreaM2: 800,
      coveragePercent: null,
      theoreticalGroundFloorM2: null,
      heightLimitM: null,
      setbackConstrainedM2: null,
      setbackCalculationSkippedReason: null,
      confidence: "unverified",
      missingConstraints: [],
      caveat: "",
    },
    riskFlags: [],
    checklist: [],
    actions: [],
    missingEvidence: [],
    sources: [zoningSource],
    permittedUseSummary: "",
    headlineWarning: "",
    assessedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildSitePotentialRulePrefill", () => {
  it("prefills all supportable rules from a full ParcelPlanningAssessment", () => {
    const rules: ZoningRule[] = [
      rule({ ruleType: "street_building_line", value: 6, unit: "m" }),
      rule({ ruleType: "side_building_line", value: 2, unit: "m" }),
      rule({ ruleType: "rear_building_line", value: 3, unit: "m" }),
      rule({ ruleType: "coverage", value: 40, unit: "percent" }),
      rule({ ruleType: "height", value: 8.5, unit: "m" }),
      rule({
        ruleType: "dwelling_units",
        value: 2,
        unit: "units",
        statement: "A second dwelling may be permitted as a consent use.",
        conditions: ["Requires municipal consent"],
      }),
    ];
    const assessment = baseAssessment({
      zone: zone({ rules }),
      publishedRules: rules,
    });

    const prefill = buildSitePotentialRulePrefill(assessment);

    expect(prefill.zone.value).toBe("Single Residential");
    expect(prefill.streetSetbackM.value).toBe(6);
    expect(prefill.sideSetbackM.value).toBe(2);
    expect(prefill.rearSetbackM.value).toBe(3);
    expect(prefill.maxCoveragePercent.value).toBe(40);
    expect(prefill.maxHeightM.value).toBe(8.5);
    expect(prefill.dwellingUnits.value).toBe(2);
    expect(prefill.additionalDwellingRule.value).toBe(
      "A second dwelling may be permitted as a consent use.",
    );
    expect(prefill.additionalDwellingRequiresConsent).toBe(true);

    // Every populated field must carry provenance.
    for (const field of [
      prefill.zone,
      prefill.streetSetbackM,
      prefill.sideSetbackM,
      prefill.rearSetbackM,
      prefill.maxCoveragePercent,
      prefill.maxHeightM,
      prefill.dwellingUnits,
      prefill.additionalDwellingRule,
    ]) {
      expect(field.provenance).not.toBeNull();
    }
  });

  it("does not crash and still fills supported fields when FAR/density/parking rules are present but unmodelled", () => {
    const rules: ZoningRule[] = [
      rule({ ruleType: "coverage", value: 45, unit: "percent" }),
      rule({ ruleType: "floor_area_ratio", value: 0.6, unit: "ratio" }),
      rule({ ruleType: "density", value: 25, unit: "units_per_ha" }),
      rule({ ruleType: "parking", value: 2, unit: "bays" }),
    ];
    const assessment = baseAssessment({
      zone: zone({ rules }),
      publishedRules: rules,
    });

    const prefill = buildSitePotentialRulePrefill(assessment);

    // Coverage, a supported rule type, still comes through.
    expect(prefill.maxCoveragePercent.value).toBe(45);
    // FAR/density/parking have no dedicated fields on the prefill shape;
    // presence of those rules must not break anything else.
    expect(prefill.streetSetbackM.value).toBeNull();
    expect(prefill.maxHeightM.value).toBeNull();
    expect(prefill).not.toBeNull();
  });

  it("never selects 'Zoning document' as the rule source without a property-matched zoning document", () => {
    const rules: ZoningRule[] = [rule({ ruleType: "coverage", value: 30 })];

    const manualAssessment = baseAssessment({
      zone: zone({ rules }),
      publishedRules: rules,
      detection: {
        method: "manual_selection",
        zoneCode: "R1",
        zoneName: "Single Residential",
        confidence: "low",
        suppliedBy: "Selected manually by the user",
        supportingAssetId: null,
        statement: "Zoning was selected manually.",
      },
    });
    const manualPrefill = buildSitePotentialRulePrefill(manualAssessment);
    expect(manualPrefill.ruleSource).not.toBe("document");
    expect(manualPrefill.ruleSourceLabel).not.toContain("Zoning document attached");

    const notDetectedAssessment = baseAssessment({
      zone: null,
      publishedRules: [],
      detection: {
        method: "not_detected",
        zoneCode: null,
        zoneName: null,
        confidence: "unverified",
        suppliedBy: "No official zoning polygon service confirmed",
        supportingAssetId: null,
        statement: "Zoning not automatically confirmed.",
      },
    });
    const notDetectedPrefill = buildSitePotentialRulePrefill(notDetectedAssessment);
    expect(notDetectedPrefill.ruleSource).toBeNull();
    expect(notDetectedPrefill.ruleSourceLabel).not.toContain("Zoning document attached");
  });

  it("selects 'Zoning document attached to this erf' only when detection is document_supported and a zone is present", () => {
    const rules: ZoningRule[] = [rule({ ruleType: "coverage", value: 35 })];
    const assessment = baseAssessment({
      zone: zone({ rules }),
      publishedRules: rules,
      detection: {
        method: "document_supported",
        zoneCode: "R1",
        zoneName: "Single Residential",
        confidence: "medium",
        suppliedBy: "Uploaded zoning document supplied by the user",
        supportingAssetId: "asset-1",
        statement: "Zoning is taken from a zoning document attached to this erf.",
      },
    });

    const prefill = buildSitePotentialRulePrefill(assessment);

    expect(prefill.ruleSource).toBe("document");
    expect(prefill.ruleSourceLabel).toBe("Zoning document attached to this erf");
    expect(prefill.ruleSourceStatus).toBe("verified");
  });

  it("yields status 'Estimated' (never 'Verified') for published registry rule packs", () => {
    const rules: ZoningRule[] = [rule({ ruleType: "coverage", value: 40, status: "active" })];
    const assessment = baseAssessment({
      zone: zone({ rules, status: "active" }),
      publishedRules: rules,
      detection: {
        method: "manual_selection",
        zoneCode: "R1",
        zoneName: "Single Residential",
        confidence: "low",
        suppliedBy: "Selected manually by the user",
        supportingAssetId: null,
        statement: "Zoning was selected manually.",
      },
    });

    const prefill = buildSitePotentialRulePrefill(assessment);

    expect(prefill.ruleSourceStatus).toBe("estimated");
    expect(prefill.ruleSourceStatus).not.toBe("verified");
    expect(prefill.maxCoveragePercent.provenance?.verification).toBe("estimated");
    expect(prefill.maxCoveragePercent.provenance?.verification).not.toBe("verified");
  });

  it("yields status 'Estimated' for manual_candidate rule packs, not 'Verified'", () => {
    const rules: ZoningRule[] = [
      rule({ ruleType: "coverage", value: 38, status: "manual_candidate" }),
    ];
    const assessment = baseAssessment({
      zone: zone({ rules, status: "manual_candidate" }),
      publishedRules: rules,
      detection: {
        method: "manual_selection",
        zoneCode: "R1",
        zoneName: "Single Residential",
        confidence: "low",
        suppliedBy: "Selected manually by the user",
        supportingAssetId: null,
        statement: "Zoning was selected manually.",
      },
    });

    const prefill = buildSitePotentialRulePrefill(assessment);

    expect(prefill.ruleSourceStatus).toBe("estimated");
    expect(prefill.ruleSourceStatus).not.toBe("verified");
    expect(prefill.maxCoveragePercent.provenance?.verification).toBe("estimated");
    expect(prefill.zone.provenance?.statusNote).toBe(
      "Captured by hand and not yet confirmed against the official document. Review required.",
    );
  });

  it("labels manual overrides / manual_candidate rules as user assumptions", () => {
    const rules: ZoningRule[] = [
      rule({ ruleType: "coverage", value: 42, status: "manual_candidate" }),
    ];
    const assessment = baseAssessment({
      zone: zone({ rules }),
      publishedRules: rules,
    });

    const prefill = buildSitePotentialRulePrefill(assessment);

    expect(prefill.maxCoveragePercent.provenance?.statusNote).toBe(
      "Captured by hand and not yet confirmed against the official document. Review required.",
    );
  });

  it("matches the exact provenance wording Zoning & Build uses for draft/pending/superseded rules", () => {
    const draftRule = rule({ ruleType: "height", value: 7, status: "draft" });
    const pendingRule = rule({ ruleType: "coverage", value: 33, status: "pending" });
    const supersededRule = rule({ ruleType: "street_building_line", value: 5, status: "superseded" });

    const assessment = baseAssessment({
      zone: zone({ rules: [draftRule, pendingRule, supersededRule] }),
      publishedRules: [draftRule, pendingRule, supersededRule],
    });

    const prefill = buildSitePotentialRulePrefill(assessment);

    expect(prefill.maxHeightM.provenance?.statusNote).toBe(
      "Document status: draft. Not proved to be enforceable.",
    );
    expect(prefill.maxCoveragePercent.provenance?.statusNote).toBe(
      "Document status: pending. Not proved to be enforceable.",
    );
    expect(prefill.streetSetbackM.provenance?.statusNote).toBe(
      "This document may have been superseded.",
    );
  });

  it("uses the exact published-registry-candidate label and property_specific/published_general provenance kinds", () => {
    const rules: ZoningRule[] = [rule({ ruleType: "coverage", value: 40 })];

    const publishedAssessment = baseAssessment({
      zone: zone({ rules }),
      publishedRules: rules,
    });
    const publishedPrefill = buildSitePotentialRulePrefill(publishedAssessment);
    expect(publishedPrefill.ruleSourceLabel).toBe(
      "Published rule candidate — property zoning not confirmed.",
    );
    expect(publishedPrefill.maxCoveragePercent.provenance?.kind).toBe("published_general");

    const documentAssessment = baseAssessment({
      zone: zone({ rules }),
      publishedRules: rules,
      detection: {
        method: "document_supported",
        zoneCode: "R1",
        zoneName: "Single Residential",
        confidence: "medium",
        suppliedBy: "Uploaded zoning document supplied by the user",
        supportingAssetId: "asset-1",
        statement: "Zoning is taken from a zoning document attached to this erf.",
      },
    });
    const documentPrefill = buildSitePotentialRulePrefill(documentAssessment);
    expect(documentPrefill.maxCoveragePercent.provenance?.kind).toBe("property_specific");
  });

  it("falls back to a single guided action and 'more_information_required' when nothing usable exists", () => {
    const assessment = baseAssessment({
      zone: null,
      publishedRules: [],
      detection: {
        method: "not_detected",
        zoneCode: null,
        zoneName: null,
        confidence: "unverified",
        suppliedBy: "No official zoning polygon service confirmed",
        supportingAssetId: null,
        statement: "Zoning not automatically confirmed.",
      },
      actions: [
        {
          id: "action-confirm-zoning",
          order: 1,
          title: "Confirm zoning with the municipality",
          detail: "Ask the municipality to confirm the zoning that applies to this erf.",
          actionLabel: "Open Sources",
          actionTab: "research",
          completed: false,
        },
      ],
    });

    const prefill = buildSitePotentialRulePrefill(assessment);

    expect(prefill.ruleSource).toBeNull();
    expect(prefill.ruleSourceStatus).toBe("more_information_required");
    expect(prefill.nextBestAction).toEqual({
      title: "Confirm zoning with the municipality",
      detail: "Ask the municipality to confirm the zoning that applies to this erf.",
      actionLabel: "Open Sources",
      actionTab: "research",
    });
    expect(prefill.zone.value).toBeNull();
    expect(prefill.maxCoveragePercent.value).toBeNull();
  });

  it("carries guideline notes verbatim from the assessment", () => {
    const assessment = baseAssessment({
      guidelines: [
        {
          id: "guide-1",
          municipality: "Kouga",
          planningAreas: ["Jeffreys Bay"],
          title: "Coastal design guideline",
          summary: "Roof pitch and materials should reflect the coastal character area.",
          authority: "municipal",
          sourceId: "source-1",
          citation: null,
          status: "active",
          confidence: "medium",
        },
      ],
    });

    const prefill = buildSitePotentialRulePrefill(assessment);

    expect(prefill.guidelineNotes).toEqual([
      "Roof pitch and materials should reflect the coastal character area.",
    ]);
  });
});
