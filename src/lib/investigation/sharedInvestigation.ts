import { z } from "zod";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { strategyWorkspaceFromUserData } from "@/lib/workbench/erfWorkspaceState";
import { workspaceFromSavedInvestigation } from "@/lib/workbench/savedInvestigationProjection";
import { parseEvidence } from "@/features/marketEvidence/hooks/useSavedMarketEvidence";
import { parseMarketAddressIntelligence } from "@/features/marketEvidence/addressIntelligence";
import { buildPropertyEvidencePack } from "@/lib/evidence/buildPropertyEvidencePack";
import { canonicalAreaM2 } from "@/lib/evidence/parcelArea";
import { erfAssetExtractedText, erfAssetHasSearchableExtraction, erfAssetIdentityMatchStatus } from "@/lib/evidence/extractionMetadata";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";
import { derivePlanningEvidenceSignals } from "@/lib/planning/planningEvidenceSignals";
import { findMunicipalityPlanningRegistry, findZone } from "@/lib/planning/municipalityPlanningRegistry";
import { isUsableSubjectZoningDocument } from "@/lib/planning/zoningEvidence";
import { readStoredBuildEnvelopeInputs } from "@/lib/sitePotential/buildEnvelopeStore";
import { deriveAcceptedBuildEnvelope } from "@/lib/sitePotential/acceptedBuildEnvelope";
import { buildReportViewModel } from "@/lib/reports/buildReportViewModel";
import { composeEasyErfReport } from "@/lib/reports/composeEasyErfReport";
import { buildEvidenceAppendixRows } from "@/lib/reports/evidenceAppendix";
import { buildSgSectionModel } from "@/lib/reports/sgSection";
import { buildMarketSectionModel } from "@/lib/reports/marketSection";
import { buildStrategySectionModel } from "@/lib/reports/strategySection";
import { buildSitePotentialReportPanel } from "@/lib/reports/sitePotentialSection";
import { DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS } from "@/lib/humanReview/scope";
import { deriveInvestigationFacts } from "./propertyInvestigation";
import { buildAskEasyErfEvidencePayload } from "@/lib/reports/askEasyErf";
import { buildDecisionIntelligence } from "@/lib/reports/buildDecisionIntelligence";
import { analyzeStrategy } from "@/lib/reports/buildInvestorDecisionMode";
import { fingerprintPropertyEvidencePack } from "@/lib/evidence/evidenceFingerprint";
import { canonicalReportAction } from "./canonicalNextAction";
import { buildSiteRiskSectionModel, buildMunicipalServicesSectionModel, buildLocationLifestyleSectionModel } from "@/lib/reports/contextSections";

const nullableText = z.string().nullable().optional();
const identityNumber = z.union([z.string(), z.number()]).nullable().optional();
export const parcelSchema = z.object({
  id: z.string().min(1), source: z.enum(["csg", "kouga", "manual"]), sourceLabel: z.string(),
  layer: z.string().optional(), erfNumber: identityNumber, portion: identityNumber,
  lpi: nullableText, parcelKey: nullableText, objectId: identityNumber,
  municipality: nullableText, province: nullableText, suburbOrArea: nullableText, town: nullableText,
  coordinates: z.object({ lng: z.number().finite(), lat: z.number().finite() }).nullable().optional(),
  knownFields: z.array(z.object({ label: z.string(), value: z.string(), source: z.string() })),
  missingFields: z.array(z.string()), rawProperties: z.record(z.unknown()).optional(),
});
export const investigationAssetSchema = z.object({
  id: z.string().uuid(), user_id: z.string().uuid(), parcel_id: z.string(),
  asset_category: z.enum(["official_document", "sg_diagram", "paid_report", "title_deed", "zoning_document", "topography", "site_photo", "existing_house_photo", "architectural_plan", "inspiration_image", "generated_design", "report_export", "other"]),
  asset_type: z.string(), source_label: z.string().nullable(), storage_bucket: z.string(), storage_path: z.string(),
  original_file_name: z.string(), mime_type: z.string(), size_bytes: z.number().nonnegative(), checksum_sha256: z.string().nullable(),
  status: z.enum(["pending_upload", "uploaded_reference_only", "processing", "ready", "failed", "archived", "deleted"]),
  metadata: z.record(z.unknown()), local_migration_fingerprint: z.string().nullable(), created_at: z.string(), updated_at: z.string(),
});
export const investigationSnapshotSchema = z.object({
  schemaVersion: z.literal(1), parcelId: z.string().min(1), revision: z.number().int().nonnegative(),
  userData: z.record(z.unknown()), assets: z.array(investigationAssetSchema), siteProject: z.record(z.unknown()).nullable(),
  // Only the authenticated RPC populates this private, server-maintained ledger.
  // Old snapshots remain readable, but missing provenance cannot authorize AI.
  processingSources: z.array(z.object({ assetId: z.string().uuid(), aiProcessingAllowed: z.boolean() })).nullable().optional(),
});
export const orderInvestigationSchema = investigationSnapshotSchema.extend({
  orderId: z.string().uuid(), customerId: z.string().uuid(), canWork: z.boolean(), canApprove: z.boolean(),
});
export type InvestigationSnapshot = z.infer<typeof investigationSnapshotSchema>;
export type OrderInvestigation = z.infer<typeof orderInvestigationSchema>;

export const investigationAttemptSchema = z.object({
  source: z.string().trim().min(3).max(500), checkedAt: z.string().datetime(), result: z.string().trim().min(3).max(2000),
  reason: z.string().trim().min(3).max(1000), limitation: z.string().trim().min(3).max(1000),
  disposition: z.enum(["reviewed", "unavailable", "not_applicable"]),
  sourceAssetIds: z.array(z.string().uuid()).max(100).optional(),
});
export type InvestigationAttempt = z.infer<typeof investigationAttemptSchema>;
export function recordedInvestigationWork(value: unknown) {
  const record = z.record(z.unknown()).safeParse(value);
  if (!record.success) return [];
  return DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS.flatMap((item) => {
    const parsed = investigationAttemptSchema.safeParse(record.data[item.id]);
    return parsed.success ? [{ id: item.id, label: item.label, ...parsed.data }] : [];
  });
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function investigationParcel(snapshot: InvestigationSnapshot): NormalizedOfficialParcel {
  const parsed = parcelSchema.safeParse(snapshot.userData.normalizedParcel);
  if (parsed.success) {
    if (parsed.data.id !== snapshot.parcelId) throw new Error("Saved parcel does not match the investigation.");
    return parsed.data;
  }
  // Older saves kept only display fields. Do not upgrade those to a fetched official record.
  const raw = snapshot.userData;
  return {
    id: snapshot.parcelId, source: "manual", sourceLabel: "Previously saved property information",
    erfNumber: text(raw.erfNumber) ?? (typeof raw.erfNumber === "number" ? raw.erfNumber : null),
    portion: text(raw.portion) ?? (typeof raw.portion === "number" ? raw.portion : null),
    lpi: text(raw.lpi), parcelKey: text(raw.parcelKey), municipality: text(raw.municipality),
    province: text(raw.province), town: text(raw.town), suburbOrArea: text(raw.minorRegion),
    knownFields: [], missingFields: ["Reopen the canonical parcel to retain its source and boundary."],
  };
}

/** One assembly for customer, assigned worker, immutable paid report and model context. */
export function assembleInvestigation(snapshot: InvestigationSnapshot, now = new Date()) {
  const parcel = investigationParcel(snapshot);
  if (snapshot.assets.some((asset) => asset.parcel_id !== snapshot.parcelId)) {
    throw new Error("Evidence belongs to another parcel.");
  }
  const assets = snapshot.assets.filter((asset) => !["deleted", "archived"].includes(asset.status) && asset.asset_category !== "generated_design");
  const workspaceState = workspaceFromSavedInvestigation(snapshot.parcelId, snapshot.userData);
  const strategyWorkspace = strategyWorkspaceFromUserData(parcel.id, snapshot.userData);
  const scenarios = strategyWorkspace?.scenarios ?? [];
  const chosen = scenarios.find((scenario) => scenario.id === strategyWorkspace?.chosenScenarioId)
    ?? scenarios.find((scenario) => scenario.selected) ?? scenarios[0] ?? null;
  const savedEvidence = parseEvidence(snapshot.userData.savedMarketEvidence, parcel.id);
  if (savedEvidence.some((item) => item.parcelId !== parcel.id)) throw new Error("Market evidence belongs to another investigation.");
  const marketAddress = parseMarketAddressIntelligence(snapshot.userData.marketAddressIntelligence);
  const registry = findMunicipalityPlanningRegistry(parcel.municipality);
  const zone = registry ? findZone(registry, workspaceState.planning.zoneCode) : null;
  const documentZone = zone ? assets.find((asset) => isUsableSubjectZoningDocument(asset, zone)) : null;
  const ringResult = z.array(z.tuple([z.number().finite(), z.number().finite()])).min(3).safeParse(snapshot.userData.parcelRing);
  const ring = ringResult.success ? ringResult.data : null;
  const planning = buildParcelPlanningAssessment({
    parcelId: parcel.id, municipality: parcel.municipality ?? null,
    locationHints: [parcel.suburbOrArea, parcel.town, parcel.municipality], erfAreaM2: canonicalAreaM2(parcel.rawProperties),
    manualZoneCode: workspaceState.planning.zoneCode, userConfirmedZoneCode: workspaceState.planning.userConfirmedZoneCode,
    documentZoneCode: documentZone ? workspaceState.planning.zoneCode : null, documentZoneAssetId: documentZone?.id,
    hasParcelPolygon: Boolean(ring), evidence: derivePlanningEvidenceSignals(assets, { zoningCertificateUploaded: Boolean(documentZone) }), now,
  });
  const storedInputs = readStoredBuildEnvelopeInputs(parcel.id, null, {
    getItem: () => JSON.stringify(snapshot.userData.buildEnvelopeInputs ?? null), setItem: () => {}, removeItem: () => {},
  });
  const envelope = deriveAcceptedBuildEnvelope({ parcel, parcelRing: ring, planning,
    recordedAreaM2: canonicalAreaM2(parcel.rawProperties), userId: null, storedInputs });
  const input = { parcel, workspaceState, assets, savedEvidence, marketAddress, strategyScenarios: scenarios,
    chosenScenario: chosen, strategyWorkspace, sitePotentialAccepted: Boolean(envelope), planningAssessment: planning, now };
  const pack = buildPropertyEvidencePack({ ...input, savedMarketEvidence: savedEvidence, marketAddressIntelligence: marketAddress });
  const work = recordedInvestigationWork(snapshot.userData.investigationWork);
  for (const item of work) {
    pack.sources.push({ id: `investigation-work-${item.id}`, parcelId: parcel.id, kind: "user_note",
      authorityType: "user_supplied", sourceQuality: "reference", status: item.disposition === "reviewed" ? "reviewed" : "unavailable",
      label: `${item.label}: ${item.source}`, capturedAt: item.checkedAt, updatedAt: item.checkedAt,
      locators: [{ fieldPath: `investigationWork.${item.id}` }],
      fragments: [item.result, item.reason, item.limitation] });
  }
  pack.statistics.sourceCount = pack.sources.length;
  pack.fingerprint = fingerprintPropertyEvidencePack(pack);
  const report = buildReportViewModel({ ...input, evidencePack: pack });
  const document = composeEasyErfReport({ report, pack, canonicalNextAction: canonicalReportAction({
    parcel, workspaceState, assets, savedEvidence, scenarioCount: scenarios.length,
    chosenScenarioId: chosen?.id ?? null, skippedTaskIds: workspaceState.investigation.skippedTaskIds,
  }) });
  const appendix = buildEvidenceAppendixRows({ assets, pack });
  const facts = deriveInvestigationFacts({ ...input, planning, scenarioCount: scenarios.length,
    chosenScenarioId: chosen?.id, marketAddressLine: marketAddress?.userConfirmedAddress?.formattedAddress ?? text(snapshot.userData.approximateAddress) });
  return { parcel, ring, workspaceState, strategyWorkspace, strategyAnalysis: analyzeStrategy(chosen), planning, pack, report, document, facts, envelope, work,
    askSuggestions: buildAskEasyErfEvidencePayload({ report, decision: buildDecisionIntelligence(report), assets,
      savedEvidence, strategyScenarios: scenarios }),
    siteRisk: buildSiteRiskSectionModel({ pack }), municipal: buildMunicipalServicesSectionModel({ pack }),
    location: buildLocationLifestyleSectionModel({ pack, identity: report.identity, subjectListing: report.market.subjectListing }),
    appendix, sg: buildSgSectionModel({ appendixRows: appendix, pack, assets }),
    market: buildMarketSectionModel({ market: report.market, pack, officialAreaM2: canonicalAreaM2(parcel.rawProperties) }),
    strategy: buildStrategySectionModel({ chosen, scenarioCount: scenarios.length }),
    site: buildSitePotentialReportPanel({ envelope, skipped: workspaceState.sitePotential.skipped,
      disclaimer: "A deterministic working envelope is not municipal approval or an approved building plan." }),
  };
}
export type InvestigationAssembly = ReturnType<typeof assembleInvestigation> & {
  /** Frozen processing-permitted projection, stored with the reviewed version. */
  modelEvidencePack?: ReturnType<typeof assembleInvestigation>["pack"];
  modelProvenance?: {
    policy: string;
    userMaterialPermitted: boolean;
    omittedDocumentCount: number;
    limitation: string | null;
    independentSources: Array<{ kind: string; parcelId: string; endpoint: string; retrievedAt: string;
      responseSha256: string; fields: string[]; documentDependencies: string[] }>;
  };
};

export function assessInvestigationSignoff(snapshot: InvestigationSnapshot, assembly: InvestigationAssembly) {
  const f = assembly.facts;
  const checks = assembly.work.find((item) => item.id === "property_checks");
  const satisfied: Record<string, boolean> = {
    parcel_identity: f.identityConfirmed && f.marketAddressSaved,
    cadastral_evidence: f.sgDiagramSearchable || f.sgDiagramParentLineageOnly,
    ownership_title: f.paidReportSearchable,
    zoning_planning: f.zoningUserConfirmed || f.zoningConfirmedByDocument,
    property_checks: checks?.disposition === "reviewed",
    market_evidence: assembly.report.market.includedCount > 0,
    strategy_calculations: f.hasChosenScenario && assembly.strategyAnalysis.requiredInputsComplete,
    site_potential: Boolean(assembly.envelope),
  };
  const recorded = z.record(z.unknown()).safeParse(snapshot.userData.investigationWork);
  const items = DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS.filter((item) => item.id !== "reviewed_report").map((item) => {
    const attempt = investigationAttemptSchema.safeParse(recorded.success ? recorded.data[item.id] : null);
    const canDispose = item.id !== "parcel_identity" && item.id !== "property_checks";
    const hasDisposition = canDispose && attempt.success && attempt.data.disposition !== "reviewed";
    return { ...item, supported: satisfied[item.id] === true,
      disposition: hasDisposition ? attempt.data : null,
      resolved: satisfied[item.id] === true || hasDisposition,
    };
  });
  const blockers: string[] = items.filter((item) => !item.resolved).map((item) => item.label);
  if (snapshot.assets.some((asset) => !["archived", "deleted"].includes(asset.status) && erfAssetIdentityMatchStatus(asset) === "mismatch")) {
    blockers.push("Remove or quarantine wrong-property evidence before approval.");
  }
  const identityIds = new Set(assembly.pack.claims.filter((claim) => claim.domain === "identity").map((claim) => claim.id));
  if (assembly.pack.contradictions.some((item) => item.claimIds.some((id) => identityIds.has(id)))) {
    blockers.push("Resolve the recorded property identity contradiction.");
  }
  return { eligible: blockers.length === 0, blockers, items };
}

export function investigationInputManifest(snapshot: InvestigationSnapshot) {
  return snapshot.assets.map((asset) => {
    const searchable = erfAssetHasSearchableExtraction(asset);
    const excluded = ["archived", "deleted"].includes(asset.status) || erfAssetIdentityMatchStatus(asset) === "mismatch"
      || asset.asset_category === "generated_design" || asset.metadata.aiProcessingAllowed !== true;
    const permittedOriginal = !excluded && asset.metadata.aiProcessingAllowed === true && searchable;
    return { assetId: asset.id, name: asset.original_file_name, category: asset.asset_category,
      state: excluded ? "omitted" : searchable ? "included" : "unreadable",
      reason: excluded ? "Omitted: inactive, wrong-property, generated concept or no processing permission."
        : searchable ? "Identity-gated extracted evidence; original binary is not transmitted."
        : "Not accepted readable evidence. Do not infer its contents.",
      originalMaterial: permittedOriginal ? erfAssetExtractedText(asset) : null,
      originalMaterialStatus: permittedOriginal ? "permitted_extracted_text" : "omitted_without_processing_permission",
    };
  });
}

export function buildInvestigationModelPackage(snapshot: InvestigationSnapshot, assembly: InvestigationAssembly) {
  // The authenticated server supplies this complete customer/parcel snapshot.
  // A client source list cannot narrow the dependency set: legacy/manual fields
  // in any namespace may have copied a document, including its name or label.
  // Until field-level provenance is independently established, all user-authored
  // material depends conservatively on ALL attached documents, not just claimed IDs.
  const dependencyMap = new Map((snapshot.processingSources ?? []).map((source) => [source.assetId, source.aiProcessingAllowed]));
  const permittedAssets = snapshot.assets.filter((asset) => asset.metadata.aiProcessingAllowed === true && dependencyMap.get(asset.id) === true);
  const userMaterialPermitted = snapshot.processingSources != null
    && snapshot.processingSources.every((source) => source.aiProcessingAllowed)
    && permittedAssets.length === snapshot.assets.length;
  const knownAssets = new Set(snapshot.assets.map((asset) => asset.id));
  const work = recordedInvestigationWork(snapshot.userData.investigationWork).filter((item) =>
    (item.sourceAssetIds ?? []).every((id) => knownAssets.has(id)));
  const projection: InvestigationSnapshot = { ...snapshot, assets: permittedAssets, siteProject: null,
    userData: userMaterialPermitted
      ? { ...snapshot.userData, investigationWork: Object.fromEntries(work.map((item) => [item.id, item])) }
      : { normalizedParcel: { id: snapshot.parcelId, source: "manual", sourceLabel: "Canonical dossier identifier",
        knownFields: [], missingFields: ["User-recorded context withheld from AI: document processing permission is incomplete."] } },
  };
  const permitted = assembleInvestigation(projection, new Date(assembly.pack.builtAt));
  // Human-only manifests keep the original names. No metadata of a denied asset
  // (even filename, category or UUID) belongs in the provider's manifest.
  const manifest = investigationInputManifest({ ...snapshot, assets: permittedAssets });
  const payload = { parcelId: snapshot.parcelId, evidenceRevision: snapshot.revision,
    evidence: permitted.pack, savedStrategy: permitted.strategy, strategyAnalysis: permitted.strategyAnalysis, deterministicSite: permitted.site,
    investigation: assessInvestigationSignoff(projection, permitted), inputs: manifest,
    provenance: { policy: "server-snapshot-document-closure-v1", userMaterialPermitted,
      permittedAssetIds: permittedAssets.map((asset) => asset.id),
      omittedDocumentCount: new Set([...snapshot.assets.filter((asset) => !permittedAssets.includes(asset)).map((asset) => asset.id),
        ...(snapshot.processingSources ?? []).filter((source) => !source.aiProcessingAllowed).map((source) => source.assetId)]).size,
      workSources: userMaterialPermitted ? work.map((item) => ({ id: item.id,
        declaredAssetIds: item.sourceAssetIds ?? null,
        requiredAssetIds: [...dependencyMap.keys()] })) : [],
      limitation: userMaterialPermitted ? null
        : "Document-derived and unclassified user-recorded material is withheld. The human report retains it; this AI draft is a partial review.",
    } };
  // Reject oversize instead of quietly dropping documents from a purported complete review.
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 400_000) {
    throw new Error("Evidence exceeds the bounded review size. No complete AI review was generated.");
  }
  return payload;
}
