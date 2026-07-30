import { describe, expect, it } from "vitest";
import type { BuildEnvelopeResult } from "@/lib/sitePotential/buildEnvelope";
import { buildSitePotentialReportPanel } from "../sitePotentialSection";

function envelope(overrides: Partial<BuildEnvelopeResult> = {}): BuildEnvelopeResult {
  return {
    state: "estimated",
    stateLabel: "Estimated",
    stateExplanation: "",
    parcelPolygon: [],
    projection: null,
    edges: [],
    streetEdge: null,
    envelopePolygon: null,
    coverageFootprint: null,
    secondDwelling: null,
    summary: {
      erfAreaM2: 619,
      erfAreaSourceLabel: "Official record",
      geometryAreaM2: 620,
      maxCoveragePercent: 50,
      theoreticalGroundFloorM2: 309.5,
      setbackEnvelopeAreaM2: 420,
      maxHeightM: 8,
      dwellingAllowance: "1 dwelling + 1 second dwelling",
      additionalDwellingRule: "",
      indicativeUpperFloorM2: null,
      knownConstraints: [],
    },
    missingInformation: [],
    assumptions: [],
    sources: [],
    showsDimensions: false,
    ...overrides,
  } as BuildEnvelopeResult;
}

const base = { skipped: false, disclaimer: "Confirm with the municipality." };

describe("buildSitePotentialReportPanel", () => {
  it("shows both visuals when envelope and concept exist", () => {
    const panel = buildSitePotentialReportPanel({
      ...base,
      envelope: envelope(),
      hasConceptImage: true,
      conceptStyle: "Coastal modern",
    });
    expect(panel.mode).toBe("both");
    expect(panel.hasCapacity).toBe(true);
    expect(panel.hasConcept).toBe(true);
    expect(panel.title).toBe("What could potentially be built here?");
    expect(panel.conceptName).toBe("Selected concept — Coastal modern");
    expect(panel.emptyMessage).toBeNull();
  });

  it("emits large scannable metrics from the envelope summary", () => {
    const panel = buildSitePotentialReportPanel({
      ...base,
      envelope: envelope(),
      hasConceptImage: false,
    });
    expect(panel.metrics.map((metric) => metric.label)).toEqual([
      "Maximum coverage",
      "Erf extent",
      "Maximum height",
      "Dwellings",
    ]);
    expect(panel.metrics[0]).toMatchObject({ value: "310 m²", note: "50% of erf" });
  });

  it("falls back to capacity only when no concept was selected", () => {
    const panel = buildSitePotentialReportPanel({
      ...base,
      envelope: envelope(),
      hasConceptImage: false,
    });
    expect(panel.mode).toBe("capacity_only");
    expect(panel.conceptName).toBeNull();
  });

  it("falls back to concept only when the envelope cannot be calculated", () => {
    const panel = buildSitePotentialReportPanel({
      ...base,
      envelope: envelope({ state: "more_information_required" }),
      hasConceptImage: true,
    });
    expect(panel.mode).toBe("concept_only");
    expect(panel.metrics).toEqual([]);
  });

  it("never invents a visual and explains an empty section honestly", () => {
    const panel = buildSitePotentialReportPanel({
      ...base,
      envelope: null,
      hasConceptImage: false,
      skipped: true,
    });
    expect(panel.mode).toBe("none");
    expect(panel.emptyMessage).toBe("Site Potential was skipped for this report.");
  });

  it("keeps one short trust line rather than repeated caveats", () => {
    const panel = buildSitePotentialReportPanel({
      ...base,
      envelope: envelope(),
      hasConceptImage: true,
    });
    expect(panel.disclaimer).toContain("Theoretical and estimated. Not approved plans.");
    expect(panel.disclaimer).toContain("Confirm with the municipality.");
  });
});
