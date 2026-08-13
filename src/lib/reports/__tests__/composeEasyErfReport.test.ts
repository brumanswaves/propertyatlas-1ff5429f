import { describe, expect, it } from "vitest";
import { composeEasyErfReport } from "../composeEasyErfReport";
import { buildReportViewModel } from "../buildReportViewModel";
import { buildEvidencePackFixture } from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";
import { evidenceParcel } from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";

function buildDoc(parcel = evidenceParcel()) {
  const report = buildReportViewModel({
    parcel,
    workspaceState: createEmptyErfWorkspaceState(),
    savedEvidence: [],
    marketAddress: null,
    assets: [],
    chosenScenario: null,
    strategyScenarios: [],
    selectedSiteDesign: null,
    propertyNotes: null,
  });
  const doc = composeEasyErfReport({
    report,
    pack: buildEvidencePackFixture({ parcel }),
    generatedAt: "2026-07-23T10:00:00Z",
  });
  return { report, doc };
}

describe("composeEasyErfReport", () => {
  const { report, doc } = buildDoc();

  it("builds a header, ask context and decision snapshot for the subject erf", () => {
    expect(doc.header.title).toBe("Easy Erf Report");
    expect(doc.ask.parcelId).toBe(doc.parcelId);
    expect(doc.decisionSnapshot.verdict.length).toBeGreaterThan(0);
    expect(doc.decisionSnapshot.confidenceReason.length).toBeGreaterThan(0);
  });

  it("never shows more than four primary metrics and always states provenance", () => {
    expect(doc.primaryMetrics.length).toBeLessThanOrEqual(4);
    for (const metric of doc.primaryMetrics) {
      expect(metric.provenance.length).toBeGreaterThan(0);
    }
  });

  it("shows every at-a-glance value with its provenance", () => {
    for (const item of doc.atAGlance) {
      expect(item.provenance.length).toBeGreaterThan(0);
    }
  });

  it("puts canonical parcel identity and evidence readiness in the primary report model", () => {
    expect(doc.atAGlance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "official-erf", label: "Erf" }),
        expect.objectContaining({ id: "official-portion", label: "Portion" }),
        expect.objectContaining({ id: "official-lpi", label: "LPI" }),
        expect.objectContaining({ id: "suburb-or-area", label: "Suburb / area" }),
        expect.objectContaining({ id: "town", label: "Town" }),
        expect.objectContaining({ id: "official-municipality", label: "Municipality" }),
      ]),
    );
    expect(doc.decisionSnapshot.readinessPercent).toBe(report.brief.readinessPercent);
  });

  it("keeps manual parcel identity recorded rather than presenting it as official", () => {
    const { doc: manualDoc } = buildDoc(
      evidenceParcel({
        source: "manual",
        sourceLabel: "Manual parcel record",
        knownFields: [],
      }),
    );
    const parcelItems = manualDoc.atAGlance.filter((item) =>
      ["official-erf", "official-portion", "official-lpi", "suburb-or-area", "town", "official-municipality"].includes(item.id),
    );

    expect(parcelItems).not.toHaveLength(0);
    expect(
      parcelItems.every(
        (item) => item.provenance === "Recorded parcel identity" || item.provenance === "Recorded parcel context",
      ),
    ).toBe(true);
  });

  it("retains official provenance for an official parcel record", () => {
    const provenance = doc.atAGlance.find((item) => item.id === "official-erf")?.provenance;

    expect(provenance).toBe("Official parcel identity");
  });

  it("marks unchecked risk strip rows as unknown or check needed, never positive", () => {
    for (const item of doc.riskStrip) {
      if (item.status === "verified" || item.status === "supported") {
        expect(item.findingIds.length).toBeGreaterThan(0);
      }
      expect(item.explanation.length).toBeGreaterThan(0);
    }
  });

  it("selects the highest ranked action as the next best action", () => {
    if (doc.nextBestAction) {
      expect(doc.actions[0]?.id).toBe(doc.nextBestAction.id);
      expect(doc.nextBestAction.targetTab.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic for identical inputs", () => {
    expect(JSON.stringify(buildDoc().doc)).toBe(JSON.stringify(doc));
  });

  it("never claims an opportunity or an all-clear without supported evidence", () => {
    if (!doc.decisionSnapshot.positives.length) {
      expect(doc.decisionSnapshot.bestOpportunity).toBeNull();
      expect(doc.decisionSnapshot.verdict.toLowerCase()).not.toContain("good");
    }
    expect(doc.decisionSnapshot.biggestConcern).toBeTruthy();
  });

  it("reports whether canonical evidence backed the composition", () => {
    expect(typeof doc.hasCanonicalEvidence).toBe("boolean");
    expect(doc.hasCanonicalEvidence).toBe(true);
  });
});
