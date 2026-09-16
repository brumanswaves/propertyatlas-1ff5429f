import { assembleInvestigation, investigationSnapshotSchema } from "../../src/lib/investigation/sharedInvestigation";
import { createEmptyErfWorkspaceState, createEmptyStrategyWorkspace } from "../../src/lib/workbench/erfWorkspaceState";
import { buildSavedInvestigationUserDataPatch } from "../../src/lib/workbench/savedInvestigationProjection";

export function reportPreviewAssembly(supported: boolean) {
  const id = "csg:lpi:c00000000000004200000";
  const now = "2026-09-16T10:00:00.000Z";
  const workspace = createEmptyErfWorkspaceState();
  workspace.identityStatus = "looks_correct";
  if (supported) {
    workspace.planning.zoneCode = "RES1";
    workspace.planning.userConfirmedZoneCode = "RES1";
    workspace.planning.userConfirmedAt = now;
  }
  const strategy = createEmptyStrategyWorkspace(id);
  strategy.chosenScenarioId = "synthetic-scenario";
  strategy.scenarios = [{ id: "synthetic-scenario", parcelId: id, label: "Buy & Hold", strategy: "buy_hold",
    inputs: { purchasePrice: "1200000", monthlyRent: "11000", vacancyRate: "5", operatingExpenses: "1800" },
    summary: [{ label: "Annual net operating income", value: "R 103 800" }, { label: "Net yield", value: "8.65%" }],
    selected: true, savedAt: now, updatedAt: now }];
  return assembleInvestigation(investigationSnapshotSchema.parse({ schemaVersion: 1, parcelId: id, revision: 1,
    siteProject: null,
    userData: { normalizedParcel: { id, source: "csg", sourceLabel: "Synthetic official parcel fixture", erfNumber: 42, portion: 0,
      municipality: "Kouga Local Municipality", province: "Eastern Cape", town: "St Francis Bay", suburbOrArea: "Sea Vista",
      lpi: "C00000000000004200000", rawProperties: { GEOM_AREA: 600 }, knownFields: [], missingFields: [] },
      ...buildSavedInvestigationUserDataPatch(id, workspace, now), ...(supported ? { strategyWorkspace: strategy } : {}) },
    assets: supported ? [{ id: "00000000-0000-4000-8000-000000000101", user_id: "00000000-0000-4000-8000-000000000102",
      parcel_id: id, asset_category: "paid_report", asset_type: "pdf", source_label: "Synthetic property data report",
      storage_bucket: "erf-files", storage_path: "synthetic/no-file.pdf", original_file_name: "synthetic-property-report.pdf",
      mime_type: "application/pdf", size_bytes: 100, checksum_sha256: null, status: "ready", local_migration_fingerprint: null,
      created_at: now, updated_at: now, metadata: { extractionStatus: "ready", identityMatchStatus: "matched",
        extractedText: "SYNTHETIC: Erf 42. Registered extent 580 square metres. Owner: Example Holdings.",
        extractedClaims: [
          { domain: "ownership", key: "registeredOwner", label: "Registered owner", value: "Example Holdings (synthetic)", page: 1 },
          { domain: "identity", key: "registeredExtent", label: "Registered extent", value: "580 m2", numericValue: 580, unit: "m2", page: 1 },
        ] } }] : [],
  }), new Date(now));
}
