import { describe, expect, it } from "vitest";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import { EASY_ERF_AGENT_JOB_CONTRACT_VERSION } from "../agentJobContract";
import {
  buildPlanningInvestigationJob,
  PLANNING_INVESTIGATION_JOB_TYPE,
} from "../planningInvestigationJob";

const canonicalErf1570 = {
  parcelId: "E108C034001400001570000000",
  erfNumber: "1570",
  portion: "0",
  lpi: "C03400140000157000000",
  parcelKey: "E108C034001400001570000000",
  municipality: "Kouga Local Municipality",
  province: "Eastern Cape",
  suburbOrArea: "SEA VISTA",
  town: "St Francis Bay",
};

type PlanningAssessmentInput = Parameters<typeof buildParcelPlanningAssessment>[0];

const erf1570BaseInput: PlanningAssessmentInput = {
  parcelId: canonicalErf1570.parcelId,
  municipality: canonicalErf1570.municipality,
  locationHints: ["Sea Vista", "St Francis Bay", "Eastern Cape"],
  erfAreaM2: 618.7,
  manualZoneCode: "RES1",
};

function erf1570Assessment(overrides: Partial<PlanningAssessmentInput> = {}) {
  return buildParcelPlanningAssessment({
    ...erf1570BaseInput,
    ...overrides,
  });
}

describe("Planning Investigation Job V1", () => {
  it("turns the existing Erf 1570 planning assessment into a real structured job", () => {
    const job = buildPlanningInvestigationJob({
      property: canonicalErf1570,
      planningAssessment: erf1570Assessment(),
    });

    expect(job.contractVersion).toBe(EASY_ERF_AGENT_JOB_CONTRACT_VERSION);
    expect(job.jobType).toBe(PLANNING_INVESTIGATION_JOB_TYPE);
    expect(job.goal).toBe("Investigate this property's planning position.");
    expect(job.inputs.parcelKey).toBe("E108C034001400001570000000");
    expect(job.context.registryMatched).toBe(true);
    expect(job.context.planningArea).toBe("Sea Vista");
    expect(job.output.sourceSummary.checked).toBeGreaterThan(0);
    expect(job.output.findings.some((finding) => finding.kind === "published_rule")).toBe(true);
    expect(job.output.unresolvedEvidence.length).toBeGreaterThan(0);
    expect(job.approvalRules.find((rule) => rule.id === "manual-zone-confirmation")?.required).toBe(
      true,
    );
    expect(job.status).toBe("needs_review");
    expect(job.process.map((step) => step.id)).toContain("propagate-shared-result");
  });

  it("keeps published rules distinct from property-specific rights", () => {
    const job = buildPlanningInvestigationJob({
      property: canonicalErf1570,
      planningAssessment: erf1570Assessment(),
    });

    const publishedRules = job.output.findings.filter(
      (finding) => finding.kind === "published_rule",
    );
    expect(publishedRules.length).toBeGreaterThan(0);
    expect(publishedRules.every((finding) => finding.status === "published_general_rule")).toBe(
      true,
    );
    expect(job.output.headlineWarning).toMatch(/not yet been confirmed|not confirmed/i);
  });

  it("does not require a second approval after the user confirms the working zone", () => {
    const job = buildPlanningInvestigationJob({
      property: canonicalErf1570,
      planningAssessment: erf1570Assessment({ userConfirmedZoneCode: "RES1" }),
    });

    expect(job.approvalRules.find((rule) => rule.id === "manual-zone-confirmation")?.required).toBe(
      false,
    );
    expect(job.actions.find((action) => action.id === "confirm-working-zoning")?.status).toBe(
      "applied",
    );
  });

  it("detects planning contradictions and lowers confidence", () => {
    const job = buildPlanningInvestigationJob({
      property: canonicalErf1570,
      planningAssessment: erf1570Assessment({ observedZoneLabel: "Business Zone 2" }),
    });

    expect(job.output.contradictions.length).toBeGreaterThan(0);
    expect(job.confidence).toBe("low");
    expect(job.status).toBe("needs_review");
  });

  it("blocks cleanly when Easy Erf has no reviewed planning registry or evidence", () => {
    const job = buildPlanningInvestigationJob({
      property: {
        parcelId: "unsupported-parcel",
        erfNumber: "1",
        municipality: "Unsupported Municipality",
      },
      planningAssessment: buildParcelPlanningAssessment({
        parcelId: "unsupported-parcel",
        municipality: "Unsupported Municipality",
        locationHints: [],
        erfAreaM2: null,
        manualZoneCode: null,
      }),
    });

    expect(job.status).toBe("blocked");
    expect(job.confidence).toBe("unverified");
    expect(job.output.findings).toHaveLength(0);
    expect(job.process.find((step) => step.id === "inspect-configured-sources")?.status).toBe(
      "skipped",
    );
  });
});
