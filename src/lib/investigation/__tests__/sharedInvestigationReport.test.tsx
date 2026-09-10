import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SharedInvestigationReport } from "@/components/humanReview/SharedInvestigationReport";
import { assembleInvestigation, investigationSnapshotSchema } from "../sharedInvestigation";
import { investigationReviewVersionSchema } from "../investigationReviewVersion";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import { buildSavedInvestigationUserDataPatch } from "@/lib/workbench/savedInvestigationProjection";
import { acquireIndependentEvidence } from "../independentEvidence.server";
import { buildRestrictedModelPackage, withModelEvidence } from "../restrictedModelPackage.server";

function fixture() {
  const snapshot = investigationSnapshotSchema.parse({ schemaVersion: 1, parcelId: "manual:fixture", revision: 4,
    assets: [], siteProject: null, userData: { normalizedParcel: { id: "manual:fixture", source: "manual", sourceLabel: "Customer supplied",
      erfNumber: "42", portion: "0", municipality: "Synthetic municipality", knownFields: [], missingFields: [] },
      ...buildSavedInvestigationUserDataPatch("manual:fixture", createEmptyErfWorkspaceState()) } });
  const assembly = assembleInvestigation(snapshot, new Date("2026-09-09T09:00:00.000Z"));
  const item = { text: "The recorded identity requires official confirmation.", sourceRefs: ["manual-parcel-record"] };
  const brief = { bottomLine: item, known: [item], potential: [item], risks: [item], unknowns: [item], nextSteps: [item] };
  const rawVersion = { id: "00000000-0000-4000-8000-000000000041", order_id: "00000000-0000-4000-8000-000000000042",
    customer_id: "00000000-0000-4000-8000-000000000043", parcel_id: snapshot.parcelId, evidence_revision: 4, brief_revision: 2,
    version_sequence: 3, evidence_snapshot: snapshot, report_assembly: assembly, generated_brief: brief, edited_brief: brief,
    provider_model: "synthetic-provider-fixture", generated_at: "2026-09-09T09:00:00.000Z",
    approved_by: "00000000-0000-4000-8000-000000000044", approved_reviewer_label: "Synthetic Reviewer",
    approved_at: "2026-09-09T09:10:00.000Z", delivered_at: "2026-09-09T09:15:00.000Z", currentEvidenceRevision: 4 };
  return { snapshot, assembly, rawVersion };
}

describe("shared complete investigation report", () => {
  it("renders independent source citations separately from human-only evidence", async () => {
    const { snapshot, rawVersion } = fixture();
    snapshot.parcelId = "csg:lpi:c00000000000004200000";
    snapshot.userData.normalizedParcel = { ...rawVersion.report_assembly.parcel, id: snapshot.parcelId };
    snapshot.processingSources = [{ assetId: "10000000-0000-4000-8000-000000000003", aiProcessingAllowed: false }];
    const handle = await acquireIndependentEvidence(snapshot.parcelId, async () => Response.json({ features: [{
      attributes: { ID: "C00000000000004200000", PARCEL_NO: "42", PORTION: 0, GEOM_AREA: 600 },
    }] }));
    const assembly = assembleInvestigation(snapshot);
    const payload = buildRestrictedModelPackage(snapshot, assembly, handle);
    const model = withModelEvidence(assembly, payload);
    const statement = { text: "Independent cadastral context, not full document review.", sourceRefs: ["independent-official-parcel-record"] };
    const version = investigationReviewVersionSchema.parse({ ...rawVersion, parcel_id: snapshot.parcelId,
      evidence_snapshot: snapshot, report_assembly: model,
      generated_brief: { ...rawVersion.generated_brief, bottomLine: statement },
      edited_brief: { ...rawVersion.edited_brief, bottomLine: statement } });
    const html = renderToStaticMarkup(<SharedInvestigationReport assembly={model} version={version} />);
    expect(html).toContain("restricted documents remain human-only");
    expect(html).toContain('href="#investigation-source-independent-official-parcel-record"');
    expect(html).toContain('id="investigation-source-independent-official-parcel-record"');
    expect(html).toContain("Erf number: 42");
    expect(html).not.toContain("AI reviewed all documents");
  });
  it("self-service identifies its status and retains Ask, evidence, Strategy and deterministic Site Potential", () => {
    const { assembly } = fixture();
    const html = renderToStaticMarkup(<SharedInvestigationReport assembly={assembly} />);
    expect(html).toContain("Self-service investigation · Not human reviewed.");
    expect(html).toContain("Ask Easy Erf");
    expect(html).toContain("Property identity and address");
    expect(html).toContain("Combined SG Evidence Pack");
    expect(html).toContain("Zoning, planning and building controls");
    expect(html).toContain("Physical and environmental evidence");
    expect(html).toContain("investigation-market");
    expect(html).toContain("investigation-strategy");
    expect(html).toContain("investigation-site");
    expect(html).not.toContain("Human-reviewed investigation.");
  });
  it("paid rendering places Ask then source-linked approved brief above the same investigation", () => {
    const { rawVersion } = fixture();
    const version = investigationReviewVersionSchema.parse(rawVersion);
    const html = renderToStaticMarkup(<SharedInvestigationReport assembly={version.report_assembly} version={version} />);
    expect(html).toContain("Human-reviewed investigation.");
    expect(html).toContain("Synthetic Reviewer");
    expect(html).toContain(version.id);
    expect(html.indexOf('id="report-ask"')).toBeLessThan(html.indexOf('aria-label="Investigation brief"'));
    expect(html.indexOf('aria-label="Investigation brief"')).toBeLessThan(html.indexOf('aria-label="Recorded identity"'));
    expect(html).toContain("investigation-source-manual-parcel-record");
    expect(html).not.toContain("This self-service summary");
    expect(html).toContain("No Surveyor-General diagram has been read");
  });
  it("an unapproved AI draft is never labelled human reviewed", () => {
    const { rawVersion } = fixture();
    const version = investigationReviewVersionSchema.parse({ ...rawVersion, approved_at: null, approved_by: null, approved_reviewer_label: null, delivered_at: null });
    const html = renderToStaticMarkup(<SharedInvestigationReport assembly={version.report_assembly} version={version} />);
    expect(html).toContain("AI investigation draft · Not human reviewed.");
    expect(html).not.toContain("Human-reviewed investigation.");
  });
  it("shows the frozen AI document coverage without exposing duplicated original material", () => {
    const { rawVersion } = fixture();
    const version = investigationReviewVersionSchema.parse({ ...rawVersion, evidence_manifest: [
      { assetId: "10000000-0000-4000-8000-000000000001", name: "included.pdf", category: "sg_diagram", state: "included", reason: "Identity-gated extracted evidence; original binary is not transmitted.", originalMaterial: "PRIVATE DUPLICATE TEXT" },
      { assetId: "10000000-0000-4000-8000-000000000002", name: "unreadable.pdf", category: "title_deed", state: "unreadable", reason: "No accepted readable evidence." },
      { assetId: "10000000-0000-4000-8000-000000000003", name: "restricted.pdf", category: "paid_report", state: "omitted", reason: "No processing permission." },
    ] });
    const html = renderToStaticMarkup(<SharedInvestigationReport assembly={version.report_assembly} version={version} />);
    expect(html).toContain("Included extracted evidence");
    expect(html).toContain("Not readable as accepted evidence");
    expect(html).toContain("Omitted from AI review");
    expect(html).toContain("No processing permission.");
    expect(html).toContain("restricted.pdf");
    expect(html).not.toContain("PRIVATE DUPLICATE TEXT");
  });
  it("renders the frozen source-check result and limitation, not just a completion badge", () => {
    const { snapshot, rawVersion } = fixture();
    snapshot.userData.investigationWork = { cadastral_evidence: {
      source: "Synthetic archive", checkedAt: "2026-09-09T00:00:00.000Z", disposition: "unavailable",
      result: "No legible scan available.", reason: "The archive returned a damaged sheet.",
      limitation: "The individual diagram remains required.",
    } };
    rawVersion.report_assembly = assembleInvestigation(snapshot);
    const version = investigationReviewVersionSchema.parse(rawVersion);
    const html = renderToStaticMarkup(<SharedInvestigationReport assembly={version.report_assembly} version={version} />);
    expect(html).toContain("No legible scan available.");
    expect(html).toContain("The individual diagram remains required.");
    expect(html).toContain("Reviewer accepted");
    expect(html).toContain("Evidence unavailable");
    expect(html).toContain("investigation-source-investigation-work-cadastral_evidence");
  });
  it("later working changes do not rebuild a frozen report against current rules", () => {
    const { rawVersion } = fixture();
    rawVersion.report_assembly.report.planning[0].value = "Original reviewed planning value";
    const version = investigationReviewVersionSchema.parse({ ...rawVersion, currentEvidenceRevision: 9 });
    const html = renderToStaticMarkup(<SharedInvestigationReport assembly={version.report_assembly} version={version} />);
    expect(html).toContain("Original reviewed planning value");
    expect(html).toContain("working investigation has changed");
    expect(html).toContain("Evidence revision 4");
  });
  it("rejects a stored report from another parcel or invented brief citations", () => {
    const { rawVersion } = fixture();
    expect(investigationReviewVersionSchema.safeParse({ ...rawVersion, parcel_id: "manual:other" }).success).toBe(false);
    expect(investigationReviewVersionSchema.safeParse({ ...rawVersion, edited_brief: { ...rawVersion.edited_brief,
      bottomLine: { text: "Invented fact", sourceRefs: ["not-in-this-report"] } } }).success).toBe(false);
  });
});
