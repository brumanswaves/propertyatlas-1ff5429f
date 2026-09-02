import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ParcelPlanningAssessment } from "@/lib/planning/municipalityPlanningTypes";
import { buildZoningSummary } from "@/lib/planning/zoningSummary";

const read = (path: string) => readFileSync(path, "utf8");

function assessment(overrides: Partial<ParcelPlanningAssessment> = {}): ParcelPlanningAssessment {
  return {
    parcelId: "erf-1",
    municipality: "Kouga",
    planningArea: "St Francis Bay",
    registryMatched: true,
    detection: {
      method: "manual_selection",
      zoneCode: "R1",
      zoneName: "Residential 1",
      confidence: "low",
      suppliedBy: "Selected by user",
      supportingAssetId: null,
      statement: "Zone selected by the user.",
    },
    zone: null,
    publishedRules: [
      {
        id: "cov",
        ruleType: "coverage",
        label: "Coverage",
        value: 50,
        unit: "percent",
        statement: "50% coverage.",
        conditions: [],
        sourceId: "s1",
        citation: null,
        status: "active",
        interpretation: "Published general rule.",
      },
      {
        id: "h",
        ruleType: "height",
        label: "Height",
        value: 8,
        unit: "m",
        statement: "8 m.",
        conditions: [],
        sourceId: "s1",
        citation: null,
        status: "active",
        interpretation: "Published general rule.",
      },
    ],
    verifiedRights: [],
    possibleRestrictions: [],
    guidelines: [],
    overlays: [],
    envelope: {
      erfAreaM2: 600,
      coveragePercent: 50,
      theoreticalGroundFloorM2: 300,
      heightLimitM: 8,
      setbackConstrainedM2: null,
      setbackCalculationSkippedReason: null,
      confidence: "low",
      missingConstraints: [],
      caveat: "Theoretical only.",
    },
    riskFlags: [
      { id: "r1", title: "Low risk", severity: "low", why: "why", nextAction: "do" },
      { id: "r2", title: "High risk", severity: "high", why: "why", nextAction: "do" },
      { id: "r3", title: "Medium risk", severity: "medium", why: "why", nextAction: "do" },
    ],
    checklist: [],
    actions: [
      {
        id: "a1",
        order: 1,
        title: "Attach a zoning certificate",
        detail: "detail",
        actionLabel: "Open Reports",
        actionTab: "reports",
        completed: false,
      },
    ],
    missingEvidence: ["Zoning certificate"],
    sources: [],
    permittedUseSummary: "",
    headlineWarning: "Published rules are not confirmed rights for this erf.",
    assessedAt: "2026-01-01",
    ...overrides,
  };
}

describe("buildZoningSummary", () => {
  it("marks a manual selection as estimated and a document as verified", () => {
    expect(buildZoningSummary(assessment()).trustStatus).toBe("estimated");
    const supported = assessment({
      detection: {
        ...assessment().detection,
        method: "document_supported",
        suppliedBy: "Zoning certificate",
      },
    });
    expect(buildZoningSummary(supported).trustLabel).toBe("Verified");
  });

  it("never shows a zone label when nothing is detected", () => {
    const none = assessment({
      detection: {
        method: "not_detected",
        zoneCode: null,
        zoneName: null,
        confidence: "unverified",
        suppliedBy: "Not detected",
        supportingAssetId: null,
        statement: "No zone.",
      },
    });
    const summary = buildZoningSummary(none);
    expect(summary.zoneLabel).toBeNull();
    expect(summary.trustStatus).toBe("more_information_required");
    expect(summary.whatThisMeans).toContain("No zone is confirmed");
  });

  it("only promotes metrics that have a published numeric value", () => {
    const summary = buildZoningSummary(assessment());
    expect(summary.metrics.map((metric) => metric.label)).toEqual(["Coverage", "Height"]);
    expect(summary.metrics[0]).toMatchObject({ value: "50%" });
    expect(summary.metrics[0].note).toContain("ground floor");
  });

  it("keeps only the two most severe risks and the canonical first action", () => {
    const summary = buildZoningSummary(assessment());
    expect(summary.topRisks.map((risk) => risk.severity)).toEqual(["high", "medium"]);
    expect(summary.riskCount).toBe(3);
    expect(summary.nextAction?.id).toBe("a1");
  });
});

describe("Zoning & Build screen hierarchy", () => {
  const panel = read("src/components/property/dossier/ZoningBuildPanel.tsx");

  it("leads with the trust status and hides detail behind one disclosure", () => {
    expect(panel).toContain("buildZoningSummary");
    expect(panel).toContain("Planning detail and evidence");
    expect(panel).not.toContain('open="true"');
    // detail content is preserved inside the disclosure
    for (const label of [
      "Published general rules",
      "Theoretical buildable envelope",
      "Evidence checklist",
      "Planning sources",
      "All planning risk flags",
      "Select the zone you believe applies",
      "Ask Easy Erf about planning",
    ]) {
      expect(panel).toContain(label);
    }
  });
});

describe("Investigation screen hierarchy", () => {
  const home = read("src/components/property/investigation/InvestigationHome.tsx");

  it("collapses investigation detail and keeps tools available", () => {
    expect(home).toContain("Investigation detail and master plan");
    expect(read("src/components/property/investigation/ExpertWorkspaceLauncher.tsx")).toContain(
      "Open full research workspace",
    );
    expect(home).not.toContain("<details open");
    expect(home).toContain("The guided journey above");
    expect(home).toContain("buildMasterInvestigationPlan");
    expect(home).toContain("onOpenExpertWorkspace");
  });

  it("keeps the guided journey and composes the large Ask panel into the report", () => {
    const reportOpening = read("src/components/property/dossier/ReportOpening.tsx");
    const reportComposer = read("src/components/property/ErfResearchDossier.tsx");
    expect(home).toContain("InvestigationJourney");
    expect(home).toContain("buildGuidedInvestigationJourney");
    expect(home).toContain("selectGuidedInvestigationStep");
    expect(home).not.toContain("AskEasyErfPanel");
    expect(reportOpening).toContain("askSlot?: ReactNode");
    expect(reportOpening).toMatch(/id="report-ask"[\s\S]*askSlot/);
    expect(reportComposer).toMatch(/askSlot=\{\s*<AskEasyErfPanel/);
  });
});

describe("Property & Sources screen hierarchy", () => {
  const panel = read("src/components/property/OfficialParcelPanel.tsx");

  it("shows four status items and one evidence-strength line", () => {
    expect(panel).toContain('label: "Identity"');
    expect(panel).toContain('label: "Ownership / deed"');
    expect(panel).toContain('label: "SG / extent"');
    expect(panel).toContain('label: "Plans / restrictions"');
    expect(panel).toContain("Evidence strength:");
  });

  it("preserves every source action behind the sources disclosure", () => {
    expect(panel).toContain("Sources and documents");
    expect(panel).toContain("sourcesExtra");
    expect(panel).toContain("<ErfResearchDossier");
    expect(panel).toContain('view="research"');
    expect(panel).toContain("planningAssessment={planningAssessment}");
    expect(panel).toContain("Copy parcel identifiers");
    expect(panel).toContain("SgDiagramEvidenceSection");
    expect(panel).toContain("GOVZA_DEEDS_GUIDANCE_URL");
    expect(panel).toContain("Mark reviewed");
  });

  it("keeps the mobile return-to-map action", () => {
    expect(panel).toContain("Back to full map");
    expect(panel).toContain("handleBackToMap");
  });
});
