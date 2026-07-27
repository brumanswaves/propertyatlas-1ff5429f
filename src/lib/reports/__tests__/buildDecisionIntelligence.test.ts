import { describe, expect, it } from "vitest";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { buildDecisionIntelligence } from "@/lib/reports/buildDecisionIntelligence";
import {
  buildReportViewModel,
  type BuildReportInput,
} from "@/lib/reports/buildReportViewModel";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";

function parcel(
  overrides: Partial<NormalizedOfficialParcel> = {},
): NormalizedOfficialParcel {
  return {
    id: "parcel:224",
    sourceLabel: "Kouga SG",
    erfNumber: 224,
    portion: 0,
    lpi: "C01900010000022400000",
    parcelKey: "C01900010000022400000",
    municipality: "Kouga",
    province: "Eastern Cape",
    knownFields: [{ label: "Erf", value: "224", source: "csg" }],
    missingFields: [],
    rawProperties: { SHAPE_Area: 987, ZONING: "Residential 1" },
    coordinates: { lng: 24.9, lat: -34.1 },
    ...overrides,
  } as NormalizedOfficialParcel;
}

function reportInput(
  overrides: Partial<BuildReportInput> = {},
): BuildReportInput {
  return {
    parcel: parcel(),
    workspaceState: createEmptyErfWorkspaceState(),
    savedEvidence: [],
    marketAddress: null,
    assets: [],
    chosenScenario: null,
    strategyScenarios: [],
    selectedSiteDesign: null,
    now: new Date("2026-07-16T00:00:00Z"),
    ...overrides,
  };
}

function evidence(count: number): SavedMarketEvidence[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `comp-${index}`,
    parcelId: "parcel:224",
    sourceUrl: `https://example.com/${index}`,
    sourcePortal: "example",
    title: `Comparable ${index + 1}`,
    askingPrice: 1_000_000 + index * 100_000,
    relationship: "same_node_comp",
    confidence: "high",
    includeInSummary: true,
    listingRole: "comparable_evidence",
    savedAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-02T00:00:00Z",
  }));
}

describe("buildDecisionIntelligence", () => {
  it("does not produce an optimistic verdict when evidence is thin", () => {
    const report = buildReportViewModel(reportInput());
    const result = buildDecisionIntelligence(report);

    expect(result.verdict).not.toBe("proceed");
    expect(result.confidencePercent).toBeLessThan(50);
    expect(result.stillNeeded.length).toBeGreaterThan(0);
    expect(result.matrix.find((row) => row.id === "ownership-verified")?.answer).toBe(
      "no",
    );
  });

  it("raises confidence from confirmed evidence without claiming ownership verification", () => {
    const workspace = {
      ...createEmptyErfWorkspaceState(),
      identityStatus: "checked" as const,
      reviewedSourceIds: ["csg", "zoning"],
      marketAddressSaved: true,
      strategyScenarioCount: 1,
      chosenScenarioId: "scenario-1",
    };
    const report = buildReportViewModel(
      reportInput({
        workspaceState: workspace,
        savedEvidence: evidence(4),
        chosenScenario: {
          id: "scenario-1",
          parcelId: "parcel:224",
          label: "Buy and hold",
          strategy: "buy_hold",
          inputs: { purchasePrice: "1000000" },
          summary: [{ label: "Net yield", value: "7%" }],
          selected: true,
          savedAt: "2026-06-03T00:00:00Z",
        },
        strategyScenarios: [
          {
            id: "scenario-1",
            parcelId: "parcel:224",
            label: "Buy and hold",
            strategy: "buy_hold",
            inputs: { purchasePrice: "1000000" },
            summary: [{ label: "Net yield", value: "7%" }],
            selected: true,
            savedAt: "2026-06-03T00:00:00Z",
          },
        ],
      }),
    );
    const result = buildDecisionIntelligence(report);

    expect(result.confidencePercent).toBeGreaterThan(10);
    expect(result.known.some((item) => item.includes("Erf number"))).toBe(true);
    expect(result.stillNeeded.some((item) => /title deed|WinDeed|Lightstone/i.test(item))).toBe(
      true,
    );
  });

  it("detects a Market address and official municipality conflict", () => {
    const report = buildReportViewModel(
      reportInput({
        marketAddress: {
          selectedAddressId: "addr-1",
          candidates: [],
          userConfirmedAddress: {
            id: "addr-1",
            formattedAddress: "12 Elm Street, Cape Town",
            municipality: "City of Cape Town",
            source: "user_entered",
            confidence: "high",
            reason: "user typed",
            createdAt: "2026-01-01T00:00:00Z",
          },
        },
      }),
    );
    const result = buildDecisionIntelligence(report);

    expect(result.contradictions).toHaveLength(1);
    expect(result.contradictions[0]?.severity).toBe("high");
    expect(result.verdict).toBe("high_risk");
  });

  it("builds a traceable evidence timeline ending with report generation", () => {
    const report = buildReportViewModel(
      reportInput({ savedEvidence: evidence(3) }),
    );
    const result = buildDecisionIntelligence(report);

    expect(result.timeline.at(-1)?.id).toBe("evidence-pack-built");
    expect(result.timeline.some((item) => item.id === "timeline-market-evidence-comp-0")).toBe(true);
  });

  it("returns all seven confidence categories and allowed verdict labels", () => {
    const report = buildReportViewModel(reportInput());
    const result = buildDecisionIntelligence(report);

    expect(result.confidenceCategories.map((category) => category.label)).toEqual([
      "Identity",
      "Planning",
      "Ownership",
      "Market",
      "Risk review",
      "Strategy",
      "Documents",
    ]);
    expect(["proceed", "proceed_with_conditions", "investigate_further", "high_risk"]).toContain(
      result.verdict,
    );
  });

  it("does not cap the risk penalty when many risks exist", () => {
    const report = buildReportViewModel(reportInput());
    report.brief.categories = report.brief.categories.map((category) => ({
      ...category,
      state: "confirmed",
    }));
    report.risks = Array.from({ length: 10 }, (_, index) => ({
      id: `risk-${index}`,
      title: `High risk ${index}`,
      severity: "high" as const,
      why: "Material unresolved evidence issue.",
      evidence: "Test evidence",
      nextAction: "Resolve the issue.",
    }));

    const result = buildDecisionIntelligence(report);

    expect(result.confidencePercent).toBe(40);
  });
});
