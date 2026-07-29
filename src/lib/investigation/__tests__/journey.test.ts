import { describe, expect, it } from "vitest";
import { buildInvestigationJourney } from "../propertyInvestigation";
import type { InvestigationStage } from "../types";

function stage(id: InvestigationStage["id"], status: InvestigationStage["status"]) {
  return {
    id,
    label: id,
    status,
    summary: `${id} summary`,
    targetTab: "investigation",
    detail: "",
  } as unknown as InvestigationStage;
}

describe("investigation journey", () => {
  const stages = [
    stage("identify", "complete"),
    stage("planning", "in_progress"),
    stage("constraints", "waiting"),
    stage("site_potential", "waiting"),
    stage("market", "waiting"),
    stage("strategy", "waiting"),
    stage("report", "waiting"),
  ];

  it("always renders six steps and folds strategy into the decision step", () => {
    const journey = buildInvestigationJourney(stages, "planning");
    expect(journey).toHaveLength(6);
    expect(journey[5].id).toBe("report");
    expect(journey.map((step) => step.index)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("marks exactly one step as current, driven by the canonical next stage", () => {
    const journey = buildInvestigationJourney(stages, "market");
    expect(journey.filter((step) => step.current)).toHaveLength(1);
    expect(journey.find((step) => step.current)?.id).toBe("market");
  });

  it("falls back to the first incomplete step when there is no next stage", () => {
    const journey = buildInvestigationJourney(stages, null);
    expect(journey.find((step) => step.current)?.id).toBe("planning");
  });
});
