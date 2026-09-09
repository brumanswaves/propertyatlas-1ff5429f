import { describe, expect, it, vi } from "vitest";
import { handleInvestigationAssetRequest } from "../investigationAssetServer";
import { handleInvestigationReviewRequest } from "../investigationReviewServer";
import { ApiRequestError } from "@/lib/sitePotential/serverAuth";
import { buildSavedInvestigationUserDataPatch } from "@/lib/workbench/savedInvestigationProjection";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import { assembleInvestigation, buildInvestigationModelPackage } from "../sharedInvestigation";
import { INVESTIGATION_BRIEF_MODEL } from "../../../../supabase/functions/_shared/investigationBrief";

const orderId = "88888888-8888-4888-8888-888888888888";
const customerId = "22222222-2222-4222-8222-222222222222";
const workerId = "55555555-5555-4555-8555-555555555555";
const assetId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const parcelId = "manual:fixture";
function scope() {
  return { schemaVersion: 1 as const, orderId, customerId, parcelId, revision: 1, canWork: true, canApprove: false,
    userData: { normalizedParcel: { id: parcelId, source: "manual", sourceLabel: "Synthetic property",
      erfNumber: "42", knownFields: [], missingFields: [] },
      ...buildSavedInvestigationUserDataPatch(parcelId, createEmptyErfWorkspaceState()) },
    assets: [], siteProject: null, processingSources: [] };
}
function asset() {
  return { id: assetId, user_id: customerId, parcel_id: parcelId, asset_category: "sg_diagram", asset_type: "sg_diagram",
    source_label: "Synthetic source", storage_bucket: "erf-files", storage_path: `${customerId}/${parcelId}/sg_diagram/${assetId}/diagram.png`,
    original_file_name: "diagram.png", mime_type: "image/png", size_bytes: 4, checksum_sha256: null,
    status: "ready", metadata: {}, local_migration_fingerprint: null, created_at: "2026-09-09", updated_at: "2026-09-09" };
}
function request(body: unknown) {
  return new Request("http://localhost/api/investigations/asset", { method: "POST",
    headers: { Authorization: "Bearer synthetic-fixture-only", "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function fixture(actor = workerId) {
  const record = asset();
  const rpc = vi.fn(async (name: string) => ({ data: name === "read_order_investigation" ? scope() : record, error: null }));
  const download = vi.fn(async () => ({ data: new Blob(["test"]), error: null }));
  const from = vi.fn(() => ({ download }));
  const deps = { authenticate: vi.fn(async () => ({ user: { id: actor }, supabase: { rpc }, token: "synthetic" })) as never,
    serviceClient: vi.fn(() => ({ storage: { from } })) as never };
  return { record, rpc, download, deps };
}
describe("investigation document route (isolated adapter fixtures)", () => {
  it("downloads only an authorized exact asset and rechecks permission afterward", async () => {
    const f = fixture();
    const response = await handleInvestigationAssetRequest(request({ orderId, assetId }), f.deps);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("test");
    expect(f.download).toHaveBeenCalledWith(f.record.storage_path);
    expect(f.rpc.mock.calls.map(([name]) => name)).toEqual(["read_order_investigation", "read_order_investigation_asset", "read_order_investigation_asset"]);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("does not fetch a cross-customer or noncanonical path", async () => {
    for (const change of [{ user_id: workerId }, { storage_path: "../private" }, { storage_bucket: "other" }]) {
      const f = fixture(); Object.assign(f.record, change);
      expect((await handleInvestigationAssetRequest(request({ orderId, assetId }), f.deps)).status).toBe(403);
      expect(f.download).not.toHaveBeenCalled();
    }
  });
  it("does not release a licensed provider original to its customer without permission", async () => {
    const f = fixture(customerId); f.record.asset_category = "paid_report";
    const response = await handleInvestigationAssetRequest(request({ orderId, assetId }), f.deps);
    expect(response.status).toBe(403); expect(f.download).not.toHaveBeenCalled();
  });
  it("never retrieves active HTML/SVG or unknown content for a same-origin blob viewer", async () => {
    for (const mime of ["text/html", "image/svg+xml", "application/octet-stream"]) {
      const f = fixture(); f.record.mime_type = mime;
      expect((await handleInvestigationAssetRequest(request({ orderId, assetId }), f.deps)).status).toBe(415);
      expect(f.download).not.toHaveBeenCalled();
    }
  });
  it("discards the downloaded bytes if permission was revoked during the request", async () => {
    const f = fixture();
    f.rpc.mockResolvedValueOnce({ data: scope(), error: null }).mockResolvedValueOnce({ data: f.record, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "42501" } } as never);
    expect((await handleInvestigationAssetRequest(request({ orderId, assetId }), f.deps)).status).toBe(403);
  });
  it("rejects changed bytes instead of serving them as the reviewed original", async () => {
    const f = fixture(); Object.assign(f.record, { checksum_sha256: "0".repeat(64) });
    expect((await handleInvestigationAssetRequest(request({ orderId, assetId }), f.deps)).status).toBe(409);
  });
  it("sanitizes storage errors and rejects arbitrary owner IDs before storage access", async () => {
    const f = fixture();
    expect((await handleInvestigationAssetRequest(request({ orderId, assetId, customerId }), f.deps)).status).toBe(400);
    f.download.mockRejectedValue(new Error("PRIVATE infrastructure credential sentinel"));
    const response = await handleInvestigationAssetRequest(request({ orderId, assetId }), f.deps);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE");
  });
});

describe("investigation review route (provider fixtures, no live AI)", () => {
  function reviewFixture() {
    const record = scope();
    const rpc = vi.fn(async () => ({ data: record, error: null }));
    const persist = vi.fn(async () => ({ data: assetId, error: null }));
    const statement = { text: "Synthetic property identity requires verification.", sourceRefs: ["manual-parcel-record"] };
    const brief = { bottomLine: statement, known: [statement], potential: [statement], risks: [statement], unknowns: [statement], nextSteps: [statement] };
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ success: true, model: INVESTIGATION_BRIEF_MODEL, brief }));
    const deps = { authenticate: vi.fn(async () => ({ user: { id: workerId }, token: "synthetic", supabase: { rpc } })) as never,
      serviceClient: vi.fn(() => ({ rpc: persist })) as never, env: (key: string) => key === "SUPABASE_URL" ? "http://127.0.0.1:54321" : "synthetic-not-a-secret",
      fetchImpl };
    return { record, rpc, persist, brief, fetchImpl, deps };
  }
  it("persists generated output with the actual actor, order and evidence revision, never approval", async () => {
    const f = reviewFixture();
    const response = await handleInvestigationReviewRequest(request({ action: "generate", orderId }), f.deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ versionId: assetId, approved: false });
    expect(f.persist).toHaveBeenCalledOnce();
    expect(f.persist).toHaveBeenCalledWith("record_investigation_brief", expect.objectContaining({
      p_actor_id: workerId, p_order_id: orderId, p_expected_revision: 1, p_brief: f.brief,
      p_assembly: expect.objectContaining({ modelEvidencePack: expect.objectContaining({ parcelId }) }),
    }));
  });
  it("does not call the provider for an unassigned customer or unauthenticated request", async () => {
    const f = reviewFixture(); f.record.canWork = false;
    expect((await handleInvestigationReviewRequest(request({ action: "generate", orderId }), f.deps)).status).toBe(403);
    expect(f.fetchImpl).not.toHaveBeenCalled();
    const authenticate = vi.fn(async () => { throw new ApiRequestError("Sign in required", 401); });
    expect((await handleInvestigationReviewRequest(request({ action: "generate", orderId }), { ...f.deps, authenticate })).status).toBe(401);
  });
  it("rejects incomplete generation and invented sources without saving a draft", async () => {
    const f = reviewFixture();
    f.fetchImpl.mockImplementation(async () => Response.json({ success: true, model: INVESTIGATION_BRIEF_MODEL,
      brief: { ...f.brief, bottomLine: { text: "False source", sourceRefs: ["invented"] } } }));
    expect((await handleInvestigationReviewRequest(request({ action: "generate", orderId }), f.deps)).status).toBe(502);
    expect(f.persist).not.toHaveBeenCalled();
  });
  it("reports a concurrent evidence change instead of attaching stale generation", async () => {
    const f = reviewFixture();
    f.persist.mockResolvedValue({ data: null, error: { code: "40001" } } as never);
    expect((await handleInvestigationReviewRequest(request({ action: "generate", orderId }), f.deps)).status).toBe(409);
  });
  it("asks only the frozen permitted evidence, never later working changes", async () => {
    const f = reviewFixture();
    const assembly = assembleInvestigation(f.record);
    const version = {
      id: assetId, order_id: orderId, customer_id: customerId, parcel_id: parcelId,
      evidence_revision: 1, brief_revision: 1, version_sequence: 1,
      evidence_snapshot: structuredClone(f.record),
      report_assembly: { ...assembly, modelEvidencePack: buildInvestigationModelPackage(f.record, assembly).evidence },
      generated_brief: f.brief, edited_brief: f.brief, provider_model: "fixture",
      generated_at: "2026-09-09T00:00:00Z", approved_by: workerId, approved_reviewer_label: "Synthetic reviewer",
      approved_at: "2026-09-09T00:00:00Z", delivered_at: "2026-09-09T00:00:00Z", currentEvidenceRevision: 2,
    };
    f.record.revision = 2;
    f.record.userData.normalizedParcel.erfNumber = "LATER_WORKING_SENTINEL";
    f.rpc.mockImplementation(async (name?: string) => ({ data: name === "read_investigation_review" ? version : f.record, error: null }) as never);
    f.fetchImpl.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(JSON.stringify(body)).not.toContain("LATER_WORKING_SENTINEL");
      expect(body.parcelId).toBe(parcelId);
      expect(body.evidence.sources.length).toBeGreaterThan(0);
      return Response.json({ success: true, answer: {
        answer: "The recorded identity still needs confirmation.", confidence: "high",
        evidenceReferences: [{ ref: body.evidence.sources[0].ref, label: "Untrusted label", sourceType: "document" }],
        unknowns: [], nextAction: null,
      } });
    });
    const response = await handleInvestigationReviewRequest(request({ action: "ask", orderId, versionId: assetId, question: "What is the property identity?" }), f.deps);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.answer.confidence).not.toBe("high");
    expect(f.persist).not.toHaveBeenCalled();
    delete (version.report_assembly as { modelEvidencePack?: unknown }).modelEvidencePack;
    f.fetchImpl.mockClear();
    expect((await handleInvestigationReviewRequest(request({ action: "ask", orderId, versionId: assetId, question: "What is the identity?" }), f.deps)).status).toBe(409);
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });
});
