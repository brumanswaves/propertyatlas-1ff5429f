import { describe, expect, it } from "vitest";
import {
  buildReportActions,
  buildReportFindings,
  isPositiveFindingStatus,
  linkFindingActions,
  nextBestAction,
  redactPersonalIdentifiers,
} from "../reportFindings";
import { buildEvidencePackFixture } from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";

describe("reportFindings", () => {
  const pack = buildEvidencePackFixture();
  const findings = buildReportFindings(pack);
  const actions = buildReportActions(pack, findings);

  it("never emits a positive status for evidence that was not checked", () => {
    for (const finding of findings) {
      if (isPositiveFindingStatus(finding.status)) {
        expect(finding.claimIds.length + finding.sourceIds.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps ownership unestablished when no ownership document supports it", () => {
    const ownership = findings.find((finding) => finding.id.includes("ownership"));
    expect(ownership).toBeDefined();
    expect(isPositiveFindingStatus(ownership!.status)).toBe(false);
  });

  it("scopes every finding to the subject parcel", () => {
    expect(findings.every((finding) => finding.parcelId === pack.parcelId)).toBe(true);
    expect(actions.every((action) => action.parcelId === pack.parcelId)).toBe(true);
  });

  it("redacts personal identifiers", () => {
    const redacted = redactPersonalIdentifiers("ID 8001015009087 and 021 555 1234");
    expect(redacted).not.toContain("8001015009087");
    expect(redacted).not.toContain("021 555 1234");
  });

  it("ranks actions deterministically and links them back to findings", () => {
    const linked = linkFindingActions(findings, actions);
    const priorities = actions.map((action) => action.priority);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
    const first = nextBestAction(actions);
    if (first) {
      expect(first.completionCriteria.length).toBeGreaterThan(0);
      expect(actions[0]?.id).toBe(first.id);
    }
    const referenced = new Set(linked.flatMap((finding) => finding.actionIds));
    for (const id of referenced) {
      expect(actions.some((action) => action.id === id)).toBe(true);
    }
  });

  it("produces the same findings for the same evidence pack", () => {
    expect(buildReportFindings(buildEvidencePackFixture()).map((f) => `${f.id}:${f.status}`)).toEqual(
      findings.map((f) => `${f.id}:${f.status}`),
    );
  });
});
