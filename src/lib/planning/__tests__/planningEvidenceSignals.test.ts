import { describe, expect, it } from "vitest";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import { derivePlanningEvidenceSignals } from "../planningEvidenceSignals";

function asset(partial: Partial<ErfAsset>): ErfAsset {
  return {
    id: partial.id ?? "asset-1",
    user_id: "user-1",
    parcel_id: "parcel-1",
    asset_category: partial.asset_category ?? "other",
    asset_type: partial.asset_type ?? "document",
    source_label: partial.source_label ?? null,
    storage_bucket: "erf-files",
    storage_path: "path",
    original_file_name: partial.original_file_name ?? "file.pdf",
    mime_type: "application/pdf",
    size_bytes: 1000,
    checksum_sha256: null,
    status: partial.status ?? "ready",
    metadata: partial.metadata ?? {},
    local_migration_fingerprint: null,
    created_at: "2026-07-29T00:00:00Z",
    updated_at: "2026-07-29T00:00:00Z",
  };
}

describe("planning evidence signals", () => {
  it("defaults every signal to false with no files", () => {
    expect(derivePlanningEvidenceSignals([])).toEqual({
      zoningCertificateUploaded: false,
      approvedBuildingPlansUploaded: false,
      titleDeedSearchable: false,
      sgDiagramSearchable: false,
      servitudesConfirmed: false,
      departureOrRezoningHistoryConfirmed: false,
      hoaOrDesignApprovalOnFile: false,
      occupancyCertificateUploaded: false,
      environmentalOverlayChecked: false,
    });
  });

  it("only treats extracted documents as searchable", () => {
    const referenceOnly = derivePlanningEvidenceSignals([
      asset({ asset_category: "title_deed", status: "uploaded_reference_only" }),
      asset({ id: "a2", asset_category: "sg_diagram", status: "processing" }),
    ]);
    expect(referenceOnly.titleDeedSearchable).toBe(false);
    expect(referenceOnly.sgDiagramSearchable).toBe(false);

    const extracted = derivePlanningEvidenceSignals([
      asset({ asset_category: "title_deed", status: "ready" }),
      asset({ id: "a2", asset_category: "sg_diagram", status: "ready" }),
    ]);
    expect(extracted.titleDeedSearchable).toBe(true);
    expect(extracted.sgDiagramSearchable).toBe(true);
  });

  it("detects zoning certificates and approved plans from explicit metadata only", () => {
    const signals = derivePlanningEvidenceSignals([
      asset({ asset_category: "zoning_document" }),
      asset({
        id: "a2",
        asset_category: "architectural_plan",
        source_label: "Approved municipal plan set",
        metadata: { planApprovalStatus: "verified_municipal_approval" },
      }),
      asset({ id: "a3", original_file_name: "occupancy certificate 1570.pdf" }),
    ]);
    expect(signals.zoningCertificateUploaded).toBe(true);
    expect(signals.approvedBuildingPlansUploaded).toBe(true);
    expect(signals.occupancyCertificateUploaded).toBe(true);
  });

  it("does not infer plan approval from filename, source label or category", () => {
    const signals = derivePlanningEvidenceSignals([
      asset({
        id: "TEST FIXTURE - NOT A REAL PROPERTY DOCUMENT",
        asset_category: "architectural_plan",
        source_label: "Approved municipal plan set",
        original_file_name: "approved-plans-test-fixture.pdf",
        metadata: { planApprovalStatus: "user_identified" },
      }),
    ]);
    expect(signals.approvedBuildingPlansUploaded).toBe(false);
  });

  it("never infers servitude, overlay or departure confirmation from a file", () => {
    const signals = derivePlanningEvidenceSignals([
      asset({ asset_category: "sg_diagram", status: "ready" }),
      asset({ id: "a2", asset_category: "zoning_document" }),
    ]);
    expect(signals.servitudesConfirmed).toBe(false);
    expect(signals.environmentalOverlayChecked).toBe(false);
    expect(signals.departureOrRezoningHistoryConfirmed).toBe(false);
  });

  it("ignores deleted, archived and failed assets", () => {
    const signals = derivePlanningEvidenceSignals([
      asset({ asset_category: "zoning_document", status: "deleted" }),
      asset({ id: "a2", asset_category: "title_deed", status: "archived" }),
      asset({ id: "a3", asset_category: "sg_diagram", status: "failed" }),
    ]);
    expect(signals.zoningCertificateUploaded).toBe(false);
    expect(signals.titleDeedSearchable).toBe(false);
    expect(signals.sgDiagramSearchable).toBe(false);
  });

  it("lets recorded human confirmations override derived signals", () => {
    const signals = derivePlanningEvidenceSignals([], { servitudesConfirmed: true });
    expect(signals.servitudesConfirmed).toBe(true);
  });
});
