import { assembleInvestigation, buildInvestigationModelPackage, type InvestigationAssembly, type InvestigationSnapshot } from "./sharedInvestigation";
import { readIndependentEvidence, type IndependentEvidenceHandle } from "./independentEvidence.server";
import { fingerprintPropertyEvidencePack } from "@/lib/evidence/evidenceFingerprint";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import { buildSavedInvestigationUserDataPatch } from "@/lib/workbench/savedInvestigationProjection";

/** Kept on the server: caller-supplied snapshot fields never establish independence. */
export function buildRestrictedModelPackage(snapshot: InvestigationSnapshot, assembly: InvestigationAssembly,
  handle?: IndependentEvidenceHandle) {
  const base = buildInvestigationModelPackage(snapshot, assembly);
  const independent = readIndependentEvidence(handle, snapshot.parcelId);
  if (base.provenance.userMaterialPermitted || !independent) return { ...base, independentSources: [] };
  const permissions = new Map(snapshot.processingSources?.map((s) => [s.assetId, s.aiProcessingAllowed]));
  const assets = snapshot.assets.filter((a) => a.metadata.aiProcessingAllowed === true && permissions.get(a.id) === true);
  const emptyWorkspace = createEmptyErfWorkspaceState();
  emptyWorkspace.updatedAt = independent.receipt.retrievedAt;
  // Every field is freshly acquired. Do not spread even a single saved namespace.
  const projection: InvestigationSnapshot = { schemaVersion: 1, parcelId: snapshot.parcelId, revision: snapshot.revision,
    userData: { normalizedParcel: independent.parcel,
      ...buildSavedInvestigationUserDataPatch(snapshot.parcelId, emptyWorkspace, independent.receipt.retrievedAt) },
    assets, siteProject: null,
    processingSources: assets.map((a) => ({ assetId: a.id, aiProcessingAllowed: true })) };
  const permitted = buildInvestigationModelPackage(projection, assembleInvestigation(projection, new Date(assembly.pack.builtAt)));
  const pack = permitted.evidence;
  // Separate identities prevent new provider facts from relabelling a saved manual
  // source, including a saved object that falsely claimed official authority.
  const ids = new Map(pack.sources.filter((s) => !s.assetId).map((s) => [s.id, `independent-${s.id}`]));
  const refs = (values: string[]) => values.map((id) => ids.get(id) ?? id);
  for (const source of pack.sources) {
    source.id = ids.get(source.id) ?? source.id;
    if (source.id === "independent-official-parcel-record") {
      source.url = independent.receipt.endpoint;
      source.capturedAt = independent.receipt.retrievedAt;
      source.updatedAt = independent.receipt.retrievedAt;
      source.fragments = pack.claims.filter((c) => c.sourceIds.includes("official-parcel-record"))
        .map((c) => `${c.label}: ${c.value}`);
    }
  }
  for (const claim of pack.claims) claim.sourceIds = refs(claim.sourceIds);
  for (const domain of pack.domains) domain.sourceIds = refs(domain.sourceIds);
  for (const conflict of pack.contradictions) conflict.sourceIds = refs(conflict.sourceIds);
  for (const event of pack.timeline) event.sourceIds = refs(event.sourceIds);
  pack.fingerprint = fingerprintPropertyEvidencePack(pack);
  return { ...permitted, independentSources: [independent.receipt], provenance: { ...base.provenance,
    policy: "server-acquired-independent-evidence-v1",
    limitation: "The AI received independently retrieved public facts and explicitly permitted document evidence only. Saved unclassified material and restricted documents remain human-only.",
  } };
}

/** A large list of gaps or source URLs is not substantive investigation evidence. */
export function assessModelPackageQuality(payload: ReturnType<typeof buildRestrictedModelPackage>) {
  const supported = payload.evidence.claims.filter((c) => !c.excluded && c.status === "supported"
    && c.nature !== "unknown" && c.value != null);
  const domains = new Set(supported.map((c) => c.domain));
  const useful = domains.has("identity") && supported.length >= 3
    && supported.some((c) => !["identity", "address", "documents", "notes"].includes(c.domain));
  return { useful, supportedClaimCount: supported.length, supportedDomains: [...domains],
    reason: useful ? null : "Permitted evidence is too limited for a useful investigation brief. No AI request was made. Add independently sourced evidence or establish applicable processing rights." };
}

/** Preserve the full human report and expose the actual AI citations alongside it. */
export function withModelEvidence(assembly: InvestigationAssembly, payload: ReturnType<typeof buildRestrictedModelPackage>): InvestigationAssembly {
  const pack = structuredClone(assembly.pack);
  const existing = new Set(pack.sources.map((s) => s.id));
  pack.sources.push(...payload.evidence.sources.filter((s) => !existing.has(s.id)));
  pack.statistics.sourceCount = pack.sources.length;
  pack.fingerprint = fingerprintPropertyEvidencePack(pack);
  return { ...assembly, pack, modelEvidencePack: payload.evidence, modelProvenance: {
    independentSources: payload.independentSources, ...payload.provenance,
  } };
}
