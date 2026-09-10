import { describe, expect, it, vi } from "vitest";
import { acquireIndependentEvidence, readIndependentEvidence } from "../independentEvidence.server";
import { assessModelPackageQuality, buildRestrictedModelPackage, withModelEvidence } from "../restrictedModelPackage.server";
import { assembleInvestigation, investigationSnapshotSchema } from "../sharedInvestigation";
import { handleInvestigationReviewRequest } from "../investigationReviewServer";
import { generateInvestigationBrief, INVESTIGATION_BRIEF_MODEL, INVESTIGATION_BRIEF_REASONING } from "../../../../supabase/functions/_shared/investigationBrief";

const parcelId = "csg:lpi:c03400140000004200000";
const orderId = "88888888-8888-4888-8888-888888888888";
const ids = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
const now = new Date("2026-09-10T10:00:00Z");
const attributes = { ID: "C03400140000004200000", PARCEL_NO: "42", PORTION: 0,
  MUNICIPALITY: "Independent municipality", PROVINCE: "Independent province", GEOM_AREA: 610,
  PRIVATE_UNREQUESTED_FIELD: "MUST_NOT_FORWARD" };
function publicFetch(value: unknown = { features: [{ attributes }] }) {
  return vi.fn<typeof fetch>(async () => Response.json(value));
}
function snapshot() {
  return investigationSnapshotSchema.parse({
    schemaVersion: 1, parcelId, revision: 2,
    processingSources: ids.map((assetId) => ({ assetId, aiProcessingAllowed: false })),
    userData: { normalizedParcel: { id: parcelId, source: "csg", sourceLabel: "DENIED_COPIED_OFFICIAL",
      erfNumber: "DENIED_ERF", municipality: "DENIED_MUNICIPALITY", knownFields: [], missingFields: [] },
      planning: { zoneCode: "DENIED_PLANNING" }, savedMarketEvidence: ["DENIED_MARKET"],
      strategyWorkspace: { draftInputs: { landCost: "DENIED_STRATEGY" } },
      sitePotential: { notes: "DENIED_SITE" }, notes: "DENIED_NOTES",
      independentEvidence: { documentDependencies: [], value: "DENIED_FORGED_INDEPENDENCE" },
      investigationWork: { property_checks: { source: "DENIED_SOURCE", checkedAt: now.toISOString(),
        disposition: "reviewed", result: "DENIED_FINDING", reason: "DENIED_REASON", limitation: "DENIED_LIMITATION",
        sourceAssetIds: [] } } },
    assets: ids.map((id, index) => ({ id, user_id: "22222222-2222-4222-8222-222222222222", parcel_id: parcelId,
      asset_category: index ? "sg_diagram" : "paid_report", asset_type: index ? "sg_diagram" : "paid_report",
      source_label: "DENIED_ASSET_LABEL", original_file_name: "DENIED_FILE.pdf", storage_bucket: "erf-files",
      storage_path: "DENIED_BYTES_PATH", mime_type: "application/pdf", size_bytes: 10, checksum_sha256: null,
      status: "ready", local_migration_fingerprint: null, created_at: now.toISOString(), updated_at: now.toISOString(),
      metadata: { extractionStatus: "ready", identityMatchStatus: "matched", aiProcessingAllowed: null,
        extractedText: "DENIED_TEXT", summary: "DENIED_SUMMARY", arbitrary: "DENIED_METADATA" } })),
    siteProject: null,
  });
}

describe("server-acquired independent evidence and restricted outbound payload", () => {
  it("acquires by canonical identifier only, strips unapproved response fields and records provenance", async () => {
    const fetchImpl = publicFetch();
    const handle = await acquireIndependentEvidence(parcelId, fetchImpl);
    const value = readIndependentEvidence(handle, parcelId);
    expect(value?.parcel.erfNumber).toBe("42");
    expect(value?.parcel.portion).toBe("0");
    expect(value?.receipt.responseSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(value?.receipt.documentDependencies).toEqual([]);
    expect(value?.receipt.fields).not.toContain("PRIVATE_UNREQUESTED_FIELD");
    const [url, init] = fetchImpl.mock.calls[0];
    const query = new URL(String(url));
    expect(query.protocol).toBe("https:");
    expect(query.searchParams.get("where")).toBe("ID='C03400140000004200000'");
    expect(query.searchParams.get("returnGeometry")).toBe("false");
    expect(init?.redirect).toBe("error");
    expect(init?.headers).toEqual({ Accept: "application/json" });
    expect(JSON.stringify(value)).not.toContain("MUST_NOT_FORWARD");
  });
  it("does not trust a forged, serialized, mutated or cross-parcel provenance handle", async () => {
    const handle = await acquireIndependentEvidence(parcelId, publicFetch());
    expect(readIndependentEvidence({ kind: "server-acquired-evidence" }, parcelId)).toBeNull();
    expect(readIndependentEvidence(JSON.parse(JSON.stringify(handle)), parcelId)).toBeNull();
    expect(readIndependentEvidence(handle, "manual:another")).toBeNull();
    const copy = readIndependentEvidence(handle, parcelId)!;
    copy.parcel.erfNumber = "DENIED_MUTATION";
    expect(readIndependentEvidence(handle, parcelId)?.parcel.erfNumber).toBe("42");
  });
  it("fails closed for wrong/ambiguous/truncated identities and unavailable or oversized sources", async () => {
    for (const value of [
      { features: [{ attributes: { ...attributes, ID: "OTHER" } }] },
      { features: [{ attributes: { ...attributes, LPI: "OTHER" } }] },
      { features: [{ attributes }, { attributes }] },
      { features: [{ attributes }], exceededTransferLimit: true },
      { features: [] }, { error: { message: "Unavailable" } },
      { features: [{ attributes: { ...attributes, PRIVATE_UNREQUESTED_FIELD: "x".repeat(65_000) } }] },
    ]) expect(await acquireIndependentEvidence(parcelId, publicFetch(value))).toBeUndefined();
    expect(await acquireIndependentEvidence(parcelId, vi.fn(async () => { throw new Error("offline"); }))).toBeUndefined();
    expect(await acquireIndependentEvidence(parcelId, vi.fn(async () => new Response("", { status: 503 })))).toBeUndefined();
    const invalidFetch = publicFetch();
    expect(await acquireIndependentEvidence("manual:untrusted' OR 1=1", invalidFetch)).toBeUndefined();
    expect(invalidFetch).not.toHaveBeenCalled();
  });
  it("excludes both denied documents and every saved namespace, retaining only freshly retrieved fields", async () => {
    const data = snapshot();
    const before = JSON.stringify(data);
    const assembly = assembleInvestigation(data, now);
    const handle = await acquireIndependentEvidence(parcelId, publicFetch());
    const payload = buildRestrictedModelPackage(data, assembly, handle);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("DENIED_");
    expect(serialized).not.toContain("MUST_NOT_FORWARD");
    for (const id of ids) expect(serialized).not.toContain(id);
    expect(serialized).toContain("Independent municipality");
    expect(payload.provenance.omittedDocumentCount).toBe(2);
    expect(payload.provenance.userMaterialPermitted).toBe(false);
    expect(payload.inputs).toEqual([]);
    expect(payload.evidence.claims.find((c) => c.key === "erfNumber")?.sourceIds).toEqual(["independent-official-parcel-record"]);
    expect(JSON.stringify(data)).toBe(before);
    const full = withModelEvidence(assembly, payload);
    expect(JSON.stringify(full.pack)).toContain("DENIED_FILE.pdf");
    expect(full.pack.sources.find((s) => s.id === "independent-official-parcel-record")?.fragments).toContain("Erf number: 42");
    expect(full.modelEvidencePack).toEqual(payload.evidence);
    expect(full.modelProvenance?.independentSources).toHaveLength(1);
    // A different copied value cannot change the restricted output.
    data.userData = { ...data.userData, notes: "DIFFERENT_PRIVATE_NOTE" };
    expect(buildRestrictedModelPackage(data, assembleInvestigation(data, now), handle)).toEqual(payload);
  });
  it("keeps a sparse identity-only payload below the paid-call quality gate", async () => {
    const data = snapshot();
    const handle = await acquireIndependentEvidence(parcelId, publicFetch());
    const payload = buildRestrictedModelPackage(data, assembleInvestigation(data, now), handle);
    expect(assessModelPackageQuality(payload)).toMatchObject({ useful: false, supportedDomains: ["identity"] });
    const fetchImpl = vi.fn<typeof fetch>();
    const rpc = vi.fn(async () => ({ data: { ...data, orderId, customerId: "22222222-2222-4222-8222-222222222222", canWork: true, canApprove: false }, error: null }));
    const response = await handleInvestigationReviewRequest(new Request("http://localhost/api/investigations/review", {
      method: "POST", body: JSON.stringify({ action: "generate", orderId }),
    }), { authenticate: vi.fn(async () => ({ user: { id: "worker" }, token: "fixture", supabase: { rpc } })) as never,
      publicEvidenceFetch: publicFetch(), fetchImpl, env: () => "fixture" });
    expect(response.status).toBe(422);
    expect(await response.text()).toContain("No AI request was made");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("checks the actual serialized provider request, not merely the displayed report", async () => {
    const data = snapshot();
    const handle = await acquireIndependentEvidence(parcelId, publicFetch());
    const evidencePackage = buildRestrictedModelPackage(data, assembleInvestigation(data, now), handle);
    const statement = { text: "Synthetic independent cadastral identity, not a full investigation.", sourceRefs: ["independent-official-parcel-record"] };
    const brief = { bottomLine: statement, known: [statement], potential: [statement], risks: [statement], unknowns: [statement], nextSteps: [statement] };
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      const sent = String(init?.body);
      for (const sentinel of ["DENIED_", "MUST_NOT_FORWARD", ...ids]) expect(sent).not.toContain(sentinel);
      expect(sent).toContain("Independent municipality");
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(brief) } }] });
    });
    // Mock transport only: intentionally exercise serialization below the
    // application quality gate. No live service/credential is used.
    await generateInvestigationBrief({ model: INVESTIGATION_BRIEF_MODEL, reasoning: INVESTIGATION_BRIEF_REASONING,
      evidencePackage, allowedSourceIds: evidencePackage.evidence.sources.map((s) => s.id),
      enabled: true, apiKey: "synthetic-fixture", fetchImpl });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
