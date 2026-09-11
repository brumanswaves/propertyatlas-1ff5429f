import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SharedInvestigationReport } from "@/components/humanReview/SharedInvestigationReport";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import { buildSavedInvestigationUserDataPatch } from "@/lib/workbench/savedInvestigationProjection";
import { assembleInvestigation, assessInvestigationSignoff, investigationSnapshotSchema, type OrderInvestigation } from "../sharedInvestigation";
import { handleInvestigationReviewRequest } from "../investigationReviewServer";
import { HUMAN_ONLY_REVIEW_MODEL, investigationReviewVersionSchema } from "../investigationReviewVersion";

const orderId = "88888888-8888-4888-8888-888888888888";
const customerId = "22222222-2222-4222-8222-222222222222";
const reviewerId = "55555555-5555-4555-8555-555555555555";
const versionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const parcelId = "manual:human-only-fixture";
const checkedAt = "2026-09-10T00:00:00.000Z";

function attempt(disposition: "reviewed" | "unavailable" = "unavailable") {
  return {
    source: "Reviewed Easy Erf source",
    checkedAt,
    result: disposition === "reviewed" ? "The available property checks were reviewed." : "No additional reliable evidence was available after checking.",
    reason: "The reviewer checked the standard investigation area for this property.",
    limitation: "The report keeps the unresolved point explicit for the customer.",
    disposition,
  };
}

function eligibleScope(): OrderInvestigation {
  const workspace = createEmptyErfWorkspaceState();
  workspace.identityStatus = "looks_correct";
  workspace.marketAddressSaved = true;
  return {
    schemaVersion: 1,
    orderId,
    customerId,
    parcelId,
    revision: 7,
    canWork: true,
    canApprove: true,
    userData: {
      normalizedParcel: {
        id: parcelId,
        source: "manual",
        sourceLabel: "Synthetic property",
        erfNumber: "42",
        portion: "0",
        municipality: "Synthetic municipality",
        knownFields: [],
        missingFields: [],
      },
      ...buildSavedInvestigationUserDataPatch(parcelId, workspace),
      investigationWork: {
        cadastral_evidence: attempt(),
        ownership_title: attempt(),
        zoning_planning: attempt(),
        property_checks: attempt("reviewed"),
        market_evidence: attempt(),
        strategy_calculations: attempt(),
        site_potential: attempt(),
      },
    },
    assets: [],
    siteProject: null,
    processingSources: [],
  };
}

function humanContent() {
  return {
    bottomLine: "The current Easy Erf evidence supports a useful human-reviewed property brief while keeping remaining gaps explicit.",
    known: ["The customer-confirmed property identity is recorded in the canonical property file."],
    potential: ["The property may warrant further investigation as the customer's plans become more specific."],
    risks: ["Several evidence areas remain unavailable and could change a future decision."],
    unknowns: ["The unavailable evidence listed in the report remains unverified."],
    nextSteps: ["Verify the highest-impact remaining gap before relying on it for a consequential property decision."],
  };
}

function request(body: unknown) {
  return new Request("http://localhost/api/investigations/review", {
    method: "POST",
    headers: { Authorization: "Bearer synthetic-fixture-only", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function humanRouteDeps(scope: OrderInvestigation) {
  const authRpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ data: structuredClone(scope), error: null }));
  const serviceRpc = vi.fn(async (name: string, _args: Record<string, unknown>) => ({
    data: name === "record_investigation_brief" ? versionId : null,
    error: null,
  }));
  const fetchImpl = vi.fn<typeof fetch>();
  const deps = {
    authenticate: vi.fn(async () => ({ user: { id: reviewerId }, token: "synthetic", supabase: { rpc: authRpc } })) as never,
    serviceClient: vi.fn(() => ({ rpc: serviceRpc })) as never,
    fetchImpl,
  };
  return { authRpc, serviceRpc, fetchImpl, deps };
}

describe("human-only R999 review fallback", () => {
  it("uses the same investigation signoff gate instead of treating missing evidence as complete", () => {
    const scope = eligibleScope();
    const assessment = assessInvestigationSignoff(scope, assembleInvestigation(scope));
    expect(assessment.eligible).toBe(true);
    expect(assessment.items.find((item) => item.id === "property_checks")?.supported).toBe(true);
    expect(assessment.items.find((item) => item.id === "cadastral_evidence")?.disposition?.disposition).toBe("unavailable");

    delete (scope.userData.investigationWork as Record<string, unknown>).cadastral_evidence;
    expect(assessInvestigationSignoff(scope, assembleInvestigation(scope)).eligible).toBe(false);
  });

  it("keeps ordinary Ask closed while a paid investigation is still work in progress", () => {
    const assembly = assembleInvestigation(eligibleScope());
    const html = renderToStaticMarkup(<SharedInvestigationReport assembly={assembly} orderId={orderId} />);
    expect(html).toContain("Ask Easy Erf becomes available only after an evidence-bound reviewed version is delivered");
    expect(html).toContain("Work-in-progress investigation evidence is not sent through the ordinary Ask path");
    expect(html).not.toContain("Ask questions about this property");
  });

  it("records and approves a human-only version through the canonical transaction without any AI transport", async () => {
    const scope = eligibleScope();
    const f = humanRouteDeps(scope);
    const response = await handleInvestigationReviewRequest(
      request({ action: "human_approve", orderId, content: humanContent() }),
      f.deps,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ approved: true, versionId, delivered: false, reviewMode: HUMAN_ONLY_REVIEW_MODEL });
    expect(f.fetchImpl).not.toHaveBeenCalled();
    expect(f.authRpc).toHaveBeenCalledTimes(2);
    expect(f.serviceRpc).toHaveBeenCalledTimes(2);
    expect(f.serviceRpc).toHaveBeenNthCalledWith(1, "record_investigation_brief", expect.objectContaining({
      p_order_id: orderId,
      p_actor_id: reviewerId,
      p_expected_revision: 7,
      p_manifest: [],
      p_brief: humanContent(),
      p_model: HUMAN_ONLY_REVIEW_MODEL,
      p_assembly: expect.not.objectContaining({ modelEvidencePack: expect.anything() }),
    }));
    expect(f.serviceRpc).toHaveBeenNthCalledWith(2, "approve_investigation_review", expect.objectContaining({
      p_order_id: orderId,
      p_version_id: versionId,
      p_actor_id: reviewerId,
      p_expected_brief_revision: 1,
      p_validated_content: expect.objectContaining({
        bottomLine: humanContent().bottomLine,
        investigationChecklist: expect.objectContaining({ reviewed_report: "complete" }),
      }),
    }));
  });

  it("stops before approval if the canonical version recorder detects a revision race", async () => {
    const scope = eligibleScope();
    const f = humanRouteDeps(scope);
    f.serviceRpc.mockImplementation(async (name: string) => name === "record_investigation_brief"
      ? { data: null, error: { code: "40001" } }
      : { data: null, error: null });

    const response = await handleInvestigationReviewRequest(
      request({ action: "human_approve", orderId, content: humanContent() }),
      f.deps,
    );

    expect(response.status).toBe(409);
    expect(await response.text()).toContain("changed");
    expect(f.serviceRpc).toHaveBeenCalledTimes(1);
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses human-only approval without approval permission", async () => {
    const scope = eligibleScope();
    scope.canApprove = false;
    const f = humanRouteDeps(scope);
    const response = await handleInvestigationReviewRequest(
      request({ action: "human_approve", orderId, content: humanContent() }),
      f.deps,
    );
    expect(response.status).toBe(403);
    expect(f.serviceRpc).not.toHaveBeenCalled();
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses human-only approval while investigation work is unresolved", async () => {
    const scope = eligibleScope();
    delete (scope.userData.investigationWork as Record<string, unknown>).market_evidence;
    const f = humanRouteDeps(scope);
    const response = await handleInvestigationReviewRequest(
      request({ action: "human_approve", orderId, content: humanContent() }),
      f.deps,
    );
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("unfinished");
    expect(f.serviceRpc).not.toHaveBeenCalled();
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });

  it("parses and renders a human-only frozen report without relabelling it as AI output", () => {
    const scope = eligibleScope();
    const assembly = assembleInvestigation(scope);
    const version = investigationReviewVersionSchema.parse({
      id: versionId,
      order_id: orderId,
      customer_id: customerId,
      parcel_id: parcelId,
      evidence_revision: 7,
      brief_revision: 1,
      version_sequence: 1,
      evidence_snapshot: investigationSnapshotSchema.parse(scope),
      report_assembly: assembly,
      evidence_manifest: [],
      generated_brief: humanContent(),
      edited_brief: humanContent(),
      provider_model: HUMAN_ONLY_REVIEW_MODEL,
      generated_at: checkedAt,
      approved_by: reviewerId,
      approved_reviewer_label: "Synthetic Reviewer",
      approved_at: checkedAt,
      delivered_at: checkedAt,
      currentEvidenceRevision: 7,
    });

    const html = renderToStaticMarkup(<SharedInvestigationReport assembly={assembly} version={version} />);
    expect(html).toContain("Human-reviewed investigation.");
    expect(html).toContain("Human-reviewed investigation summary");
    expect(html).toContain("No AI synthesis was used for this summary");
    expect(html).toContain("Ask Easy Erf is unavailable for this human-only reviewed version");
    expect(html).not.toContain("AI synthesis from recorded evidence");
    expect(html).not.toContain("Documents considered by the AI");
  });

  it("rejects AI evidence packages masquerading as human-only versions", () => {
    const scope = eligibleScope();
    const assembly = assembleInvestigation(scope);
    const base = {
      id: versionId,
      order_id: orderId,
      customer_id: customerId,
      parcel_id: parcelId,
      evidence_revision: 7,
      brief_revision: 1,
      version_sequence: 1,
      evidence_snapshot: investigationSnapshotSchema.parse(scope),
      report_assembly: assembly,
      evidence_manifest: [],
      generated_brief: humanContent(),
      edited_brief: humanContent(),
      provider_model: HUMAN_ONLY_REVIEW_MODEL,
      generated_at: checkedAt,
      approved_by: reviewerId,
      approved_reviewer_label: "Synthetic Reviewer",
      approved_at: checkedAt,
      delivered_at: null,
      currentEvidenceRevision: 7,
    };
    expect(investigationReviewVersionSchema.safeParse({ ...base, evidence_manifest: [{
      assetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "restricted.pdf", category: "paid_report", state: "included", reason: "Should be rejected",
    }] }).success).toBe(false);
    expect(investigationReviewVersionSchema.safeParse({ ...base,
      report_assembly: { ...assembly, modelEvidencePack: assembly.pack },
    }).success).toBe(false);
  });
});
