/**
 * Ask Easy Erf reference canonicalisation across every valid deployed shape.
 *
 * Reproduces the live Erf 1570 failure ref 8fa9f204-5eb7-4ebd-9a76-0c27e7e965d2
 * where "What are the biggest risks?" returned multiple already-resolved
 * references and was rejected client-side.
 */
import { describe, expect, it } from "vitest";
import { canonicalizeAskEasyErfAnswer } from "../askEasyErfClient";
import {
  buildAskEasyErfEvidencePayload,
  buildAskEasyErfSelectedEvidencePayload,
  suggestedAskEasyErfQuestions,
} from "../askEasyErf";
import {
  buildEvidencePackFixture,
  evidenceParcel,
} from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";
import { buildReportViewModel } from "@/lib/reports/buildReportViewModel";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import { buildDecisionIntelligence } from "@/lib/reports/buildDecisionIntelligence";

function evidence(question: string) {
  return buildAskEasyErfSelectedEvidencePayload({
    pack: buildEvidencePackFixture({}),
    question,
    now: new Date("2026-07-29T00:00:00Z"),
  });
}

function answer(references: Array<Record<string, unknown>>) {
  return {
    answer: "The biggest evidence risks are unconfirmed ownership and missing approved plans.",
    confidence: "low" as const,
    evidenceReferences: references,
    unknowns: ["Registered owner"],
    nextAction: "Order a Deeds Office search.",
  };
}

describe("Ask Easy Erf canonicalisation — Erf 1570 evidence slice", () => {
  const RISKS = "What are the biggest risks?";
  const PLANNER = "What should I ask a town planner?";

  it("accepts the broad risks answer with multiple resolved references", () => {
    const payload = evidence(RISKS);
    expect(payload.sources.length).toBeGreaterThanOrEqual(2);
    const result = canonicalizeAskEasyErfAnswer(
      answer(
        payload.sources.slice(0, 2).map((source) => ({
          ref: source.ref,
          sourceId: source.sourceId,
          label: source.label,
          sourceType: source.sourceType,
          authorityType: source.authorityType,
          status: source.status,
          locator: null,
        })),
      ),
      payload,
    );
    expect(result).not.toBeNull();
    expect(result?.evidenceReferences).toHaveLength(2);
  });

  it("accepts the narrower town-planner answer", () => {
    const payload = evidence(PLANNER);
    const source = payload.sources[0];
    expect(
      canonicalizeAskEasyErfAnswer(
        answer([{ ref: source.ref, sourceId: source.sourceId }]),
        payload,
      ),
    ).not.toBeNull();
  });

  it("accepts a sourceId-only resolved reference", () => {
    const payload = evidence(RISKS);
    const result = canonicalizeAskEasyErfAnswer(
      answer([{ sourceId: payload.sources[0].sourceId }]),
      payload,
    );
    expect(result?.evidenceReferences[0].ref).toBe(payload.sources[0].ref);
  });

  it("accepts a raw ref-only model reference", () => {
    const payload = evidence(RISKS);
    const result = canonicalizeAskEasyErfAnswer(answer([{ ref: payload.sources[0].ref }]), payload);
    expect(result?.evidenceReferences[0].sourceId).toBe(payload.sources[0].sourceId);
  });

  it("accepts a mix of raw and resolved references", () => {
    const payload = evidence(RISKS);
    const result = canonicalizeAskEasyErfAnswer(
      answer([
        { ref: payload.sources[0].ref },
        { sourceId: payload.sources[1].sourceId, label: "", status: "unknown" },
      ]),
      payload,
    );
    expect(result?.evidenceReferences.map((r) => r.ref)).toEqual([
      payload.sources[0].ref,
      payload.sources[1].ref,
    ]);
  });

  it("deduplicates repeated references by canonical source", () => {
    const payload = evidence(RISKS);
    const source = payload.sources[0];
    const result = canonicalizeAskEasyErfAnswer(
      answer([
        { ref: source.ref },
        { sourceId: source.sourceId },
        { ref: source.ref, sourceId: source.sourceId },
      ]),
      payload,
    );
    expect(result?.evidenceReferences).toHaveLength(1);
  });

  it("ignores response labels and source types in favour of the submitted source", () => {
    const payload = evidence(RISKS);
    const source = payload.sources[0];
    const result = canonicalizeAskEasyErfAnswer(
      answer([{ ref: source.ref, label: "Fabricated title deed", sourceType: "note" }]),
      payload,
    );
    expect(result?.evidenceReferences[0].label).toBe(source.label);
    expect(result?.evidenceReferences[0].sourceType).toBe(source.sourceType);
  });

  it("rejects a fabricated ref", () => {
    const payload = evidence(RISKS);
    expect(canonicalizeAskEasyErfAnswer(answer([{ ref: "S99" }]), payload)).toBeNull();
  });

  it("rejects a fabricated sourceId", () => {
    const payload = evidence(RISKS);
    expect(
      canonicalizeAskEasyErfAnswer(answer([{ sourceId: "not-a-real-source" }]), payload),
    ).toBeNull();
  });

  it("rejects a ref and sourceId that resolve to different sources", () => {
    const payload = evidence(RISKS);
    expect(
      canonicalizeAskEasyErfAnswer(
        answer([{ ref: payload.sources[0].ref, sourceId: payload.sources[1].sourceId }]),
        payload,
      ),
    ).toBeNull();
  });

  it("rejects an empty reference list and a malformed answer shape", () => {
    const payload = evidence(RISKS);
    expect(canonicalizeAskEasyErfAnswer(answer([]), payload)).toBeNull();
    expect(canonicalizeAskEasyErfAnswer({ answer: "", confidence: "low" }, payload)).toBeNull();
    expect(canonicalizeAskEasyErfAnswer(answer([{}]), payload)).toBeNull();
  });

  it("offers different suggested questions per report view", () => {
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
    const payload = buildAskEasyErfEvidencePayload({
      report,
      decision: buildDecisionIntelligence(report),
      assets: [],
      savedEvidence: [],
      strategyScenarios: [],
    });
    const standard = suggestedAskEasyErfQuestions(payload, "standard");
    const investor = suggestedAskEasyErfQuestions(payload, "investor");
    expect(standard).not.toEqual(investor);
  });
});
