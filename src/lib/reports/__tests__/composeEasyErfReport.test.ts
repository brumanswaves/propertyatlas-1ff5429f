import { describe, expect, it } from "vitest";
import { composeEasyErfReport } from "../composeEasyErfReport";
import { buildReportViewModel } from "../buildReportViewModel";
import { buildEvidencePackFixture } from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";
import { evidenceParcel } from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";

function buildDoc() {
  const report = buildReportViewModel({
    parcel: evidenceParcel(),
    workspaceState: createEmptyErfWorkspaceState(),
    savedEvidence: [],
    marketAddress: null,
    assets: [],
    chosenScenario: null,
    strategyScenarios: [],
    selectedSiteDesign: null,
    propertyNotes: null,
  });
  return composeEasyErfReport({
    report,
    pack: buildEvidencePackFixture(),
    generatedAt: "2026-07-23T10:00:00Z",
  });
}

describe("composeEasyErfReport", () => {
  const doc = buildDoc();

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
    expect(JSON.stringify(buildDoc())).toBe(JSON.stringify(doc));
  });
});
