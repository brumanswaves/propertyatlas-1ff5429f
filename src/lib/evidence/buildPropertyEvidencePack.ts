import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import {
  createEmptyStrategyWorkspace,
  type ErfStrategyScenario,
} from "@/lib/workbench/erfWorkspaceState";
import { fingerprintPropertyEvidencePack } from "./evidenceFingerprint";
import { resolveParcelArea, SHAPE_AREA_WARNING, statedAreaAliases } from "./parcelArea";
import {
  erfAssetDocumentLineage,
  erfAssetExtractedClaims,
  erfAssetIsParentLineageMatch,
  erfAssetExtractionError,
  erfAssetExtractionStatus,
  erfAssetHasSearchableExtraction,
  erfAssetIdentityMatchReason,
  erfAssetIdentityMatchStatus,
  isExtractableErfAsset,
} from "./extractionMetadata";
import type {
  BuildPropertyEvidencePackInput,
  EvidenceClaim,
  EvidenceContradiction,
  EvidenceDomain,
  EvidenceDomainState,
  EvidenceDomainSummary,
  EvidenceGap,
  EvidenceLocator,
  EvidenceSourceReference,
  EvidenceTimelineEvent,
  PropertyEvidencePack,
} from "./propertyEvidenceTypes";

const ALL_DOMAINS: EvidenceDomain[] = [
  "identity",
  "address",
  "ownership",
  "deeds",
  "planning",
  "valuation",
  "transfers",
  "market",
  "environment",
  "infrastructure",
  "site",
  "strategy",
  "documents",
  "notes",
];

const ZONING_KEYS = ["ZONING", "Zoning", "ZONE", "ZONE_NAME", "ZONING_DESCRIPTION", "LU_DESC"];
const PLANNING_KEYS: Array<[string, string, string[]]> = [
  ["coverage", "Coverage %", ["COVERAGE", "Coverage", "coverage"]],
  ["far", "FAR", ["FAR", "far", "FSR"]],
  ["height", "Height limit", ["HEIGHT", "Height", "HEIGHT_LIMIT"]],
  ["setbacks", "Setbacks", ["SETBACK", "SETBACKS", "BUILDING_LINE", "BUILDING_LINES"]],
  ["permittedUses", "Permitted uses", ["PERMITTED_USES", "LAND_USE", "USE_RIGHTS"]],
];
const FRAGMENT_LIMIT = 1_200;
const AREA_MISMATCH_PERCENT = 10;
const AREA_MISMATCH_M2 = 20;
const OFFICIAL_PARCEL_SOURCES = new Set(["csg", "kouga", "kouga-sg"]);

interface MutablePack {
  parcelId: string;
  sources: EvidenceSourceReference[];
  claims: EvidenceClaim[];
  contradictions: EvidenceContradiction[];
  gaps: EvidenceGap[];
  timeline: EvidenceTimelineEvent[];
}

export function buildPropertyEvidencePack(input: BuildPropertyEvidencePackInput): PropertyEvidencePack {
  const parcelId = input.parcel.id;
  const now = input.now ?? new Date();
  const builtAt = now.toISOString();
  const pack: MutablePack = {
    parcelId,
    sources: [],
    claims: [],
    contradictions: [],
    gaps: [],
    timeline: [],
  };

  const assets = (input.assets ?? []).filter((asset) => asset.parcel_id === parcelId);
  const savedMarketEvidence = (input.savedMarketEvidence ?? []).filter(
    (item) => item.parcelId === parcelId,
  );
  const strategyWorkspace =
    input.strategyWorkspace?.parcelId === parcelId
      ? input.strategyWorkspace
      : createEmptyStrategyWorkspace(parcelId);
  const strategyScenarios = [
    ...strategyWorkspace.scenarios,
    ...(input.strategyScenarios ?? []),
  ].filter(uniqueScenario(parcelId));
  const chosenScenario = selectChosenScenario(parcelId, input.chosenScenario, strategyWorkspace, strategyScenarios);
  const selectedSiteDesign =
    input.selectedSiteDesign?.parcel_id === parcelId ? input.selectedSiteDesign : null;

  const systemSourceId = addSource(pack, {
    id: "system-state",
    parcelId,
    kind: "system_state",
    label: "Easy Erf workspace state",
    authorityType: "system",
    sourceQuality: "reference",
    status: "ready",
    capturedAt: input.workspaceState.updatedAt,
    updatedAt: input.workspaceState.updatedAt,
    locators: [],
    fragments: [],
  });

  addOfficialParcelEvidence(pack, input, systemSourceId);
  addResearchSources(pack, input);
  addAddressEvidence(pack, input);
  addMarketEvidence(pack, savedMarketEvidence);
  addAssetEvidence(pack, assets, selectedSiteDesign);
  addNotesEvidence(pack, input);
  addStrategyEvidence(pack, strategyWorkspace, strategyScenarios, chosenScenario);
  addSitePotentialEvidence(pack, input, assets, selectedSiteDesign, systemSourceId);
  addCrossParcelRejections(pack, input, systemSourceId);
  addContradictions(pack, input, savedMarketEvidence);
  addGaps(pack, input, assets, savedMarketEvidence, strategyWorkspace, chosenScenario, selectedSiteDesign);
  addTimeline(pack, input, assets, savedMarketEvidence, strategyWorkspace, chosenScenario, selectedSiteDesign, builtAt);

  pack.sources.sort((a, b) => a.id.localeCompare(b.id));
  pack.claims.sort((a, b) => a.id.localeCompare(b.id));
  pack.contradictions.sort((a, b) => a.id.localeCompare(b.id));
  pack.gaps.sort((a, b) => a.id.localeCompare(b.id));
  pack.timeline = dedupeTimeline(pack.timeline).sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() || a.id.localeCompare(b.id),
  );

  const domains = buildDomainSummaries(pack);
  const sourceUpdatedAt = newestDate([
    ...pack.sources.map((source) => source.updatedAt ?? source.capturedAt ?? null),
    ...pack.claims.map((claim) => claim.updatedAt ?? claim.observedAt ?? null),
  ]);
  const statistics = {
    sourceCount: pack.sources.length,
    claimCount: pack.claims.length,
    supportedClaimCount: pack.claims.filter((claim) => claim.status === "supported").length,
    assumptionCount: pack.claims.filter((claim) => claim.nature === "assumption").length,
    calculationCount: pack.claims.filter((claim) => claim.nature === "calculation").length,
    interpretationCount: pack.claims.filter((claim) => claim.nature === "interpretation").length,
    missingCount: pack.claims.filter((claim) => claim.status === "missing").length + pack.gaps.length,
    contradictionCount: pack.contradictions.length,
  };
  const withoutFingerprint = {
    schemaVersion: 1 as const,
    parcelId,
    builtAt,
    fingerprint: "",
    sourceUpdatedAt,
    sources: pack.sources,
    claims: pack.claims,
    domains,
    contradictions: pack.contradictions,
    gaps: pack.gaps,
    timeline: pack.timeline,
    statistics,
  };

  return {
    ...withoutFingerprint,
    fingerprint: fingerprintPropertyEvidencePack(withoutFingerprint),
  };
}

function addOfficialParcelEvidence(
  pack: MutablePack,
  input: BuildPropertyEvidencePackInput,
  systemSourceId: string,
) {
  const { parcel } = input;
  const isOfficialParcel = isOfficialParcelSource(
    parcel.source ?? parcel.knownFields[0]?.source ?? parcel.sourceLabel,
  );
  const parcelSourceId = isOfficialParcel ? "official-parcel-record" : "manual-parcel-record";
  const sourceId = addSource(pack, {
    id: parcelSourceId,
    parcelId: parcel.id,
    kind: isOfficialParcel ? "official_parcel" : "user_confirmation",
    label: parcel.sourceLabel || (isOfficialParcel ? "Official parcel record" : "Manual parcel record"),
    authorityType: isOfficialParcel ? "official" : "user_supplied",
    sourceQuality: isOfficialParcel ? "direct" : "reference",
    status: "ready",
    capturedAt: input.workspaceState.updatedAt,
    updatedAt: input.workspaceState.updatedAt,
    locators: [],
    fragments: [],
  });

  const parcelClaim = (key: string, label: string, value: unknown, fieldPath: string, domain: EvidenceDomain = "identity", unit?: string) => {
    if (value == null || String(value).trim() === "") return;
    addClaim(pack, {
      id: claimId(domain, key, fieldPath),
      parcelId: parcel.id,
      domain,
      key,
      label,
      value: typeof value === "number" ? value : String(value),
      normalizedValue: normalizeValue(value),
      unit: unit ?? null,
      nature: isOfficialParcel ? "fact" : "observation",
      status: "supported",
      confidence: isOfficialParcel ? "high" : "unverified",
      confidenceReason: isOfficialParcel
        ? "Supplied by the normalized official parcel record. Confirm legal reliance with the source authority."
        : "User-supplied parcel identity. It is not an official cadastral record until checked against CSG or municipal sources.",
      sourceIds: [sourceId],
      locators: [{ fieldPath }],
      observedAt: input.workspaceState.updatedAt,
      updatedAt: input.workspaceState.updatedAt,
      userConfirmed: false,
      excluded: false,
    });
  };

  parcelClaim("erfNumber", "Erf number", parcel.erfNumber, "parcel.erfNumber");
  parcelClaim("portion", "Portion", parcel.portion, "parcel.portion");
  parcelClaim("lpi", "LPI", parcel.lpi, "parcel.lpi");
  parcelClaim("parcelKey", "Parcel key", parcel.parcelKey, "parcel.parcelKey");
  parcelClaim("municipality", "Municipality", parcel.municipality, "parcel.municipality");
  parcelClaim("province", "Province", parcel.province, "parcel.province");
  parcelClaim("suburbOrArea", "Suburb or area", parcel.suburbOrArea, "parcel.suburbOrArea");
  parcelClaim("town", "Town", parcel.town, "parcel.town");
  if (parcel.coordinates) {
    parcelClaim(
      "coordinates",
      "Coordinates",
      `${parcel.coordinates.lat},${parcel.coordinates.lng}`,
      "parcel.coordinates",
      "identity",
    );
  }

  const raw = parcel.rawProperties ?? {};
  const verifiedExtent = selectVerifiedRegisteredExtent(input.assets ?? [], parcel.id);
  const resolvedArea = isOfficialParcel || verifiedExtent
    ? resolveParcelArea(raw, { verifiedExtent })
    : null;
  if (resolvedArea) {
    addClaim(pack, {
      id: claimId("identity", "areaM2", resolvedArea.sourceKey),
      parcelId: parcel.id,
      domain: "identity",
      key: "areaM2",
      label: "Erf area",
      value: resolvedArea.areaM2,
      normalizedValue: resolvedArea.areaM2,
      unit: "m2",
      nature: "fact",
      status: "supported",
      confidence: resolvedArea.confidence,
      confidenceReason: resolvedArea.sourceKind === "verified_extent"
        ? "Registered extent read from an identity-matched uploaded deed, SG diagram or paid report."
        : resolvedArea.approximate
        ? (resolvedArea.warning ?? SHAPE_AREA_WARNING)
        : resolvedArea.sourceKind === "csg_geom_area"
          ? "Registered ground area published directly by the official CSG parcel record (GEOM_AREA, square metres)."
          : "Explicit square-metre area supplied by the official parcel record.",
      sourceIds: [sourceId],
      locators: [{ fieldPath: `parcel.rawProperties.${resolvedArea.sourceKey}` }],
      observedAt: input.workspaceState.updatedAt,
      updatedAt: input.workspaceState.updatedAt,
      userConfirmed: false,
      excluded: false,
    });
  }
  const zoningCandidates = isOfficialParcel ? candidates(raw, ZONING_KEYS) : [];
  for (const candidate of zoningCandidates) {
    addClaim(pack, {
      id: claimId("planning", "zoning", candidate.path),
      parcelId: parcel.id,
      domain: "planning",
      key: "zoning",
      label: "Zoning",
      value: claimScalar(candidate.value),
      normalizedValue: normalizeValue(candidate.value),
      nature: "fact",
      status: "supported",
      confidence: "high",
      confidenceReason: "Recognized zoning alias supplied by official parcel raw properties.",
      sourceIds: [sourceId],
      locators: [{ fieldPath: candidate.path }],
      observedAt: input.workspaceState.updatedAt,
      updatedAt: input.workspaceState.updatedAt,
      userConfirmed: false,
      excluded: false,
    });
  }
  for (const [key, label, keys] of isOfficialParcel ? PLANNING_KEYS : []) {
    for (const candidate of candidates(raw, keys)) {
      addClaim(pack, {
        id: claimId("planning", key, candidate.path),
        parcelId: parcel.id,
        domain: "planning",
        key,
        label,
        value: claimScalar(candidate.value),
        normalizedValue: normalizeValue(candidate.value),
        nature: "fact",
        status: "supported",
        confidence: "medium",
        confidenceReason: "Recognized planning-control alias supplied by official parcel raw properties.",
        sourceIds: [sourceId],
        locators: [{ fieldPath: candidate.path }],
        observedAt: input.workspaceState.updatedAt,
        updatedAt: input.workspaceState.updatedAt,
        userConfirmed: false,
        excluded: false,
      });
    }
  }

  if (input.workspaceState.identityStatus === "looks_correct" || input.workspaceState.identityStatus === "checked") {
    addClaim(pack, {
      id: "claim-user-confirmed-identity",
      parcelId: parcel.id,
      domain: "identity",
      key: "identityReview",
      label: "User identity review",
      value: input.workspaceState.identityStatus,
      normalizedValue: input.workspaceState.identityStatus,
      nature: "observation",
      status: "supported",
      confidence: "medium",
      confidenceReason: isOfficialParcel
        ? "The user marked the official parcel identity as checked. This is workflow confirmation, not legal certification."
        : "The user reviewed a manually supplied parcel identity. This does not convert it into an official record.",
      sourceIds: [systemSourceId],
      locators: [{ fieldPath: "workspaceState.identityStatus" }],
      observedAt: input.workspaceState.updatedAt,
      updatedAt: input.workspaceState.updatedAt,
      userConfirmed: true,
      excluded: false,
    });
  }
}

function addResearchSources(pack: MutablePack, input: BuildPropertyEvidencePackInput) {
  for (const source of input.researchSources ?? []) {
    const reviewed = input.workspaceState.reviewedSourceIds.includes(source.id);
    const opened = input.workspaceState.openedSourceIds.includes(source.id);
    addSource(pack, {
      id: `research-${source.id}`,
      parcelId: input.parcel.id,
      kind: source.sourceType === "municipal" ? "municipal_portal" : "official_portal",
      label: source.name,
      authorityType:
        source.sourceType === "official"
          ? "official"
          : source.sourceType === "municipal"
            ? "municipal"
            : source.sourceType === "paid-provider"
              ? "paid_provider"
              : "system",
      sourceQuality:
        source.sourceQuality === "generated_search"
          ? "generated_search"
          : source.status === "unavailable"
            ? "unavailable"
            : "reference",
      status: source.status === "unavailable" ? "unavailable" : reviewed ? "reviewed" : opened ? "opened" : "not_opened",
      url: source.url,
      capturedAt: input.workspaceState.updatedAt,
      updatedAt: input.workspaceState.updatedAt,
      locators: source.url ? [{ sourceUrl: source.url }] : [],
      fragments: [source.reveals, source.complianceNote].filter(Boolean).map(limitFragment),
    });
    if (reviewed) {
      addTimelineEvent(pack, {
        id: `timeline-source-reviewed-${source.id}`,
        parcelId: input.parcel.id,
        occurredAt: input.workspaceState.updatedAt,
        label: "Research source reviewed",
        detail: source.name,
        sourceIds: [`research-${source.id}`],
        domain: source.category.includes("deeds") ? "deeds" : source.category.includes("planning") ? "planning" : "documents",
      });
    }
  }
}

function addAddressEvidence(pack: MutablePack, input: BuildPropertyEvidencePackInput) {
  const intelligence = input.marketAddressIntelligence;
  if (!intelligence) return;
  const confirmedId = intelligence.userConfirmedAddress?.id ?? null;
  const seen = new Set<string>();
  for (const candidate of intelligence.candidates) {
    seen.add(candidate.id);
    addAddressCandidateEvidence(
      pack,
      input.parcel.id,
      candidate,
      confirmedId === candidate.id,
      `marketAddressIntelligence.candidates.${candidate.id}`,
    );
  }
  if (intelligence.userConfirmedAddress && !seen.has(intelligence.userConfirmedAddress.id)) {
    addAddressCandidateEvidence(
      pack,
      input.parcel.id,
      intelligence.userConfirmedAddress,
      true,
      "marketAddressIntelligence.userConfirmedAddress",
    );
  }
}

function addAddressCandidateEvidence(
  pack: MutablePack,
  parcelId: string,
  candidate: NonNullable<BuildPropertyEvidencePackInput["marketAddressIntelligence"]>["candidates"][number],
  confirmed: boolean,
  fieldPath: string,
) {
  const sourceId = addSource(pack, {
    id: `address-${candidate.id}`,
    parcelId,
    kind: confirmed ? "user_confirmation" : "system_state",
    label: confirmed ? "Confirmed market address" : "Address candidate",
    authorityType: confirmed ? "user_supplied" : "market",
    sourceQuality: "reference",
    status: confirmed ? "reviewed" : "not_opened",
    capturedAt: candidate.createdAt,
    updatedAt: candidate.updatedAt ?? candidate.createdAt,
    locators: [{ fieldPath }],
    fragments: [candidate.reason].filter(Boolean).map(limitFragment),
  });
  const reason =
    candidate.source === "google_reverse_geocode"
      ? "Google reverse geocoding is address context only and is not official cadastral identity."
      : candidate.reason;
  const status = confirmed ? "supported" : "not_reviewed";
  const confidence = confirmed ? "medium" : candidate.confidence;
  addAddressClaim(pack, parcelId, candidate.id, "marketAddress", confirmed ? "Confirmed market address" : "Address candidate", candidate.formattedAddress, fieldPath, sourceId, status, confidence, reason, candidate.createdAt, candidate.updatedAt, confirmed);
  addAddressClaim(pack, parcelId, candidate.id, "municipality", "Market address municipality", candidate.municipality ?? null, fieldPath, sourceId, status, confidence, reason, candidate.createdAt, candidate.updatedAt, confirmed);
  addAddressClaim(pack, parcelId, candidate.id, "province", "Market address province", candidate.province ?? null, fieldPath, sourceId, status, confidence, reason, candidate.createdAt, candidate.updatedAt, confirmed);
  if (candidate.lat != null && candidate.lng != null) {
    addAddressClaim(pack, parcelId, candidate.id, "coordinates", "Market address coordinates", `${candidate.lat},${candidate.lng}`, fieldPath, sourceId, status, confidence, reason, candidate.createdAt, candidate.updatedAt, confirmed);
  }
}

function addAddressClaim(
  pack: MutablePack,
  parcelId: string,
  addressId: string,
  key: string,
  label: string,
  value: unknown,
  fieldPath: string,
  sourceId: string,
  status: EvidenceClaim["status"],
  confidence: EvidenceClaim["confidence"],
  confidenceReason: string,
  createdAt: string,
  updatedAt: string | null | undefined,
  userConfirmed: boolean,
) {
  if (value == null || String(value).trim() === "") return;
  addClaim(pack, {
    id: `claim-address-${addressId}-${key}`,
    parcelId,
    domain: "address",
    key,
    label,
    value: typeof value === "number" ? value : String(value),
    normalizedValue: normalizeValue(value),
    nature: "observation",
    status,
    confidence,
    confidenceReason,
    sourceIds: [sourceId],
    locators: [{ fieldPath }],
    observedAt: createdAt,
    updatedAt: updatedAt ?? createdAt,
    userConfirmed,
    excluded: false,
  });
}

function addMarketEvidence(pack: MutablePack, evidence: SavedMarketEvidence[]) {
  for (const item of evidence) {
    const sourceId = addSource(pack, {
      id: `market-${item.id}`,
      parcelId: item.parcelId,
      kind: "market_listing",
      label: item.title || item.sourcePortal || "Market evidence",
      authorityType: "market",
      sourceQuality: "untrusted_content",
      status: item.confidence === "excluded" || !item.includeInSummary ? "excluded" : "ready",
      url: item.sourceUrl,
      sourcePortal: item.sourcePortal,
      capturedAt: item.savedAt,
      updatedAt: item.updatedAt,
      locators: item.sourceUrl ? [{ sourceUrl: item.sourceUrl }] : [],
      fragments: [
        item.notes ?? null,
        ...(item.importedListing?.warnings ?? []),
        ...(item.importedListing?.missingFields ?? []).map((field) => `Missing imported field: ${field}`),
      ].filter((value): value is string => Boolean(value)).map(limitFragment),
    });
    const excluded = item.confidence === "excluded" || !item.includeInSummary;
    const base = {
      parcelId: item.parcelId,
      domain: "market" as const,
      nature: "observation" as const,
      status: excluded ? ("excluded" as const) : ("supported" as const),
      confidence: item.confidence === "excluded" ? ("low" as const) : item.confidence,
      confidenceReason: "Saved market evidence. Asking and listing facts are market observations, not valuations.",
      sourceIds: [sourceId],
      observedAt: item.importedListing?.listingDate ?? item.savedAt,
      updatedAt: item.updatedAt,
      userConfirmed: Boolean(item.importedListing?.userConfirmedAttachment),
      excluded,
    };
    marketClaim(pack, item, base, "askingPrice", "Asking price", item.askingPrice, "ZAR");
    marketClaim(pack, item, base, "propertyType", "Property type", item.propertyType);
    marketClaim(pack, item, base, "beds", "Bedrooms", item.beds);
    marketClaim(pack, item, base, "baths", "Bathrooms", item.baths);
    marketClaim(pack, item, base, "garages", "Garages", item.garages);
    marketClaim(pack, item, base, "parkingSpaces", "Parking spaces", item.parkingSpaces);
    marketClaim(pack, item, base, "landSizeM2", "Land size", item.landSizeM2, "m2");
    marketClaim(pack, item, base, "buildingSizeM2", "Building size", item.buildingSizeM2, "m2");
    marketClaim(pack, item, base, "relationship", "Evidence relationship", item.relationship);
    marketClaim(pack, item, base, "listingRole", "Listing role", item.listingRole ?? "comparable_evidence");
    if (item.importedListing?.listingId) {
      marketClaim(pack, item, base, "listingId", "Listing ID", item.importedListing.listingId);
    }
  }
}

function addAssetEvidence(
  pack: MutablePack,
  assets: ErfAsset[],
  selectedSiteDesign: ErfAsset | null,
) {
  for (const asset of assets) {
    const isImage = asset.mime_type.startsWith("image/");
    const fragments = extractedFragments(asset);
    const sourceId = addSource(pack, {
      id: `asset-${asset.id}`,
      parcelId: asset.parcel_id,
      kind: isImage ? "uploaded_image" : "uploaded_document",
      label: asset.source_label || asset.original_file_name,
      authorityType:
        asset.asset_category === "generated_design"
          ? "ai_generated"
          : asset.asset_category === "paid_report"
            ? "paid_provider"
            : "user_supplied",
      sourceQuality: fragments.length ? "untrusted_content" : "reference",
      status: asset.status === "failed" ? "failed" : asset.status === "ready" ? "ready" : "uploaded",
      assetId: asset.id,
      fileName: asset.original_file_name,
      capturedAt: asset.created_at,
      updatedAt: asset.updated_at,
      locators: [{ assetId: asset.id, metadataKey: "metadata" }],
      fragments,
      asset: assetMetadata(asset, selectedSiteDesign?.id === asset.id),
    });
    addClaim(pack, {
      id: `claim-document-${asset.id}`,
      parcelId: asset.parcel_id,
      domain: asset.asset_category === "generated_design" ? "site" : "documents",
      key: asset.asset_category,
      label: asset.source_label || asset.original_file_name,
      value: asset.original_file_name,
      normalizedValue: asset.original_file_name,
      nature: asset.asset_category === "generated_design" ? "interpretation" : "observation",
      status: asset.status === "failed" ? "partial" : "supported",
      confidence: asset.asset_category === "generated_design" ? "unverified" : "medium",
      confidenceReason:
        asset.asset_category === "generated_design"
          ? "Site Potential concepts are AI interpretation, not approval or proof of buildability."
          : "Uploaded file exists in the Erf File Vault. It is reference material unless structured extracted claims exist.",
      sourceIds: [sourceId],
      locators: [{ assetId: asset.id, metadataKey: "original_file_name" }],
      observedAt: asset.created_at,
      updatedAt: asset.updated_at,
      userConfirmed: false,
      excluded: false,
      notes: extractionNote(asset),
    });
    addExtractedDocumentClaims(pack, asset, sourceId);
    addDocumentIdentityWarnings(pack, asset, sourceId);
    if (selectedSiteDesign?.id === asset.id) {
      addClaim(pack, {
        id: `claim-site-selected-${asset.id}`,
        parcelId: asset.parcel_id,
        domain: "site",
        key: "selectedSitePotentialConcept",
        label: "Selected Site Potential concept",
        value: asset.original_file_name,
        normalizedValue: asset.id,
        nature: "interpretation",
        status: "supported",
        confidence: "unverified",
        confidenceReason: "Selected means user-selected; it does not verify planning approval or legal buildability.",
        sourceIds: [sourceId],
        locators: [{ assetId: asset.id }],
        observedAt: asset.updated_at,
        updatedAt: asset.updated_at,
        userConfirmed: true,
        excluded: false,
      });
    }
  }
}

/**
 * Turns server-extracted document values into real, auditable evidence claims.
 *
 * These are document-derived observations, never official truth: each one keeps
 * its verbatim quote and page locator, and because official parcel claims are
 * added first they can never overwrite an official value.
 */
function addExtractedDocumentClaims(pack: MutablePack, asset: ErfAsset, sourceId: string) {
  // Identity gate: only an identity-matched, ready extraction may become evidence.
  if (!erfAssetHasSearchableExtraction(asset)) return;
  const parentLineage = erfAssetIsParentLineageMatch(asset);
  const lineage = parentLineage ? erfAssetDocumentLineage(asset) : null;
  const planLabel = lineage?.generalPlanReference
    ? `General Plan ${lineage.generalPlanReference}`
    : lineage?.parentErfNumber
      ? `the General Plan of parent Erf ${lineage.parentErfNumber}`
      : "a parent General Plan";
  const extracted = erfAssetExtractedClaims(asset);
  for (const [index, item] of extracted.entries()) {
    if (!item || typeof item.key !== "string" || !item.key) continue;
    const value = typeof item.value === "string" ? item.value.trim() : "";
    if (!value) continue;
    const domain = (item.domain ?? "documents") as EvidenceDomain;
    // A parent-plan value is never an established fact about this erf.
    const parentScoped = parentLineage || item.scope === "parent_plan";
    const numeric = typeof item.numericValue === "number" && Number.isFinite(item.numericValue)
      ? item.numericValue
      : null;
    addClaim(pack, {
      id: `claim-extracted-${asset.id}-${index}-${slug(`${domain}-${item.key}`)}`,
      parcelId: asset.parcel_id,
      domain,
      key: item.key,
      label: item.label || item.key,
      value: numeric ?? value,
      normalizedValue: numeric ?? normalizeValue(value),
      unit: item.unit ?? null,
      // A value the model read off a drawing (rather than printed text) is
      // never presented as an established fact.
      nature: parentScoped || item.interpretation === true ? "interpretation" : "fact",
      status: parentScoped || item.interpretation === true ? "not_reviewed" : "supported",
      confidence: parentScoped || item.interpretation === true ? "unverified" : "medium",

      confidenceReason: parentScoped
        ? `Read from ${planLabel}, which covers this erf's parent property and many other erven. It is contextual cadastral evidence for this erf, not a confirmed value for it.`
        : item.interpretation === true
          ? "Read from the drawing rather than printed text. A surveyor or conveyancer must confirm it."
          : EXTRACTED_FACT_CONFIDENCE_REASON,

      sourceIds: [sourceId],
      locators: [
        {
          assetId: asset.id,
          pageNumber: item.page ?? undefined,
          excerpt: typeof item.quote === "string" ? item.quote : undefined,
          metadataKey: "extractedClaims",
        },
      ],
      observedAt: asset.updated_at,
      updatedAt: asset.updated_at,
      userConfirmed: false,
      excluded: false,
      notes: parentScoped
        ? "Confirm applicability to this erf with a land surveyor or conveyancer before relying on it."
        : undefined,
    });
  }
}

/**
 * A document that describes a different property is a high-severity problem,
 * not silent noise: it gets an explicit contradiction and gap so the user is
 * told to replace it.
 */
function addDocumentIdentityWarnings(pack: MutablePack, asset: ErfAsset, sourceId: string) {
  const identity = erfAssetIdentityMatchStatus(asset);
  const reason = erfAssetIdentityMatchReason(asset);
  if (identity === "parent_lineage_match") {
    // Accepted, but never as a diagram of this erf: it stays a labelled
    // context source with an explicit "confirm applicability" next action.
    const lineage = erfAssetDocumentLineage(asset);
    const plan = lineage?.generalPlanReference ? `General Plan ${lineage.generalPlanReference}` : "General Plan";
    const parent = lineage?.parentErfNumber ? ` of parent Erf ${lineage.parentErfNumber}` : "";
    pack.gaps.push({
      id: `document-parent-lineage-${asset.id}`,
      parcelId: asset.parcel_id,
      domain: "documents",
      importance: "low",
      title: `${plan}${parent} — parent-plan context only`,
      explanation: `${asset.original_file_name} is the ${plan}${parent}, from which this erf was created. It covers several erven, so nothing on it is confirmed for this erf on its own, and it never sets this erf's extent.`,
      basis: reason ?? "identityMatchStatus=parent_lineage_match",
      nextAction: "Upload the SG diagram of this erf, or confirm any relevant plan note with a land surveyor or conveyancer.",
      targetTab: "sources",
      blocking: false,
    });
    return;
  }
  if (identity !== "mismatch" && identity !== "unverified") return;
  if (identity === "mismatch") {
    addContradiction(pack, {
      id: `document-property-mismatch-${asset.id}`,
      title: "Uploaded document describes a different property",
      severity: "high",
      explanation: `${asset.original_file_name} does not match this erf, so none of its contents are used as evidence.`,
      claimIds: [`claim-document-${asset.id}`],
      sourceIds: [sourceId],
      displayedValues: [asset.original_file_name, reason ?? "Document identity does not match the selected parcel."],
      nextAction: "Remove this file and upload the correct report for this erf.",
      targetTab: "reports",
    });
    pack.gaps.push({
      id: `document-wrong-property-${asset.id}`,
      parcelId: asset.parcel_id,
      domain: "documents",
      importance: "high",
      title: "Wrong property report uploaded",
      explanation: `${asset.original_file_name} is a report for a different property, so it adds no evidence for this erf.`,
      basis: reason ?? "identityMatchStatus=mismatch",
      nextAction: "Upload the correct report for this erf.",
      targetTab: "reports",
      blocking: false,
    });
    return;
  }
  pack.gaps.push({
    id: `document-identity-unverified-${asset.id}`,
    parcelId: asset.parcel_id,
    domain: "documents",
    importance: "medium",
    title: "Report could not be matched to this erf",
    explanation: `${asset.original_file_name} does not identify this erf clearly enough for its contents to be used as evidence.`,
    basis: reason ?? "identityMatchStatus=unverified",
    nextAction: "Upload a report that clearly states this erf's identity.",
    targetTab: "reports",
    blocking: false,
  });
}

function addNotesEvidence(pack: MutablePack, input: BuildPropertyEvidencePackInput) {
  const notes = input.propertyNotes;
  if (!notes || notes.parcelId !== input.parcel.id) return;
  const sourceId = addSource(pack, {
    id: "property-notes",
    parcelId: input.parcel.id,
    kind: "user_note",
    label: "Property notes",
    authorityType: "user_supplied",
    sourceQuality: "untrusted_content",
    status: "ready",
    capturedAt: notes.createdAt,
    updatedAt: notes.updatedAt,
    locators: [{ fieldPath: "property_notes" }],
    fragments: [
      notes.personal,
      notes.pros,
      notes.cons,
      notes.questions,
      notes.municipality,
      notes.renovation,
    ].filter((value): value is string => Boolean(value?.trim())).map(limitFragment),
  });
  for (const [key, label, value] of [
    ["personal", "Personal notes", notes.personal],
    ["pros", "Pros", notes.pros],
    ["cons", "Cons", notes.cons],
    ["questions", "Questions to verify", notes.questions],
    ["agentContact", "Agent contact", notes.agentContact],
    ["municipality", "Municipality notes", notes.municipality],
    ["renovation", "Renovation notes", notes.renovation],
  ] as const) {
    if (!value?.trim()) continue;
    addClaim(pack, {
      id: `claim-note-${key}`,
      parcelId: input.parcel.id,
      domain: "notes",
      key,
      label,
      value,
      normalizedValue: value,
      nature: "observation",
      status: key === "questions" ? "not_reviewed" : "supported",
      confidence: "unverified",
      confidenceReason: "User-supplied note. It may be useful evidence context but is not official proof.",
      sourceIds: [sourceId],
      locators: [{ fieldPath: `propertyNotes.${key}` }],
      observedAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      userConfirmed: true,
      excluded: false,
    });
  }
}

function addStrategyEvidence(
  pack: MutablePack,
  workspace: ReturnType<typeof createEmptyStrategyWorkspace>,
  scenarios: ErfStrategyScenario[],
  chosenScenario: ErfStrategyScenario | null,
) {
  const sourceId = addSource(pack, {
    id: "strategy-workspace",
    parcelId: workspace.parcelId,
    kind: "strategy_workspace",
    label: "Strategy workspace",
    authorityType: "user_supplied",
    sourceQuality: "reference",
    status: workspace.draftUpdatedAt || scenarios.length ? "ready" : "not_opened",
    capturedAt: workspace.draftUpdatedAt,
    updatedAt: newestDate([workspace.draftUpdatedAt, workspace.chosenScenarioUpdatedAt]),
    locators: [{ fieldPath: "strategyWorkspace" }],
    fragments: [],
    strategy: {
      scenarioIds: scenarios.map((scenario) => scenario.id).sort(),
      chosenScenarioId: chosenScenario?.id ?? null,
    },
  });
  if (workspace.draftUpdatedAt) {
    addClaim(pack, {
      id: "claim-strategy-active-draft",
      parcelId: workspace.parcelId,
      domain: "strategy",
      key: "activeDraftStrategy",
      label: "Active draft strategy",
      value: workspace.activeStrategy,
      normalizedValue: workspace.activeStrategy,
      nature: "assumption",
      status: "not_reviewed",
      confidence: "unverified",
      confidenceReason: "Draft Strategy inputs are user assumptions until saved as the chosen report scenario.",
      sourceIds: [sourceId],
      locators: [{ fieldPath: "strategyWorkspace.activeStrategy" }],
      observedAt: workspace.draftUpdatedAt,
      updatedAt: workspace.draftUpdatedAt,
      userConfirmed: false,
      excluded: false,
    });
    for (const [key, value] of Object.entries(workspace.draftInputs)) {
      if (!String(value ?? "").trim()) continue;
      addClaim(pack, {
        id: `claim-strategy-draft-${key}`,
        parcelId: workspace.parcelId,
        domain: "strategy",
        key,
        label: key,
        value,
        normalizedValue: numeric(value) ?? value,
        nature: "assumption",
        status: "not_reviewed",
        confidence: "unverified",
        confidenceReason: "Strategy draft input is a user assumption, not verified market or planning evidence.",
        sourceIds: [sourceId],
        locators: [{ fieldPath: `strategyWorkspace.draftInputs.${key}` }],
        observedAt: workspace.draftUpdatedAt,
        updatedAt: workspace.draftUpdatedAt,
        userConfirmed: false,
        excluded: false,
      });
    }
  }
  for (const scenario of scenarios) {
    const selected = chosenScenario?.id === scenario.id;
    for (const [key, value] of Object.entries(scenario.inputs)) {
      if (!String(value ?? "").trim()) continue;
      addClaim(pack, {
        id: `claim-strategy-${scenario.id}-input-${key}`,
        parcelId: scenario.parcelId,
        domain: "strategy",
        key,
        label: `${scenario.label}: ${key}`,
        value,
        normalizedValue: numeric(value) ?? value,
        nature: "assumption",
        status: selected ? "supported" : "not_reviewed",
        confidence: "unverified",
        confidenceReason: selected
          ? "Chosen Strategy scenario input. It remains a user assumption."
          : "Saved alternative Strategy scenario input. It is not the chosen report scenario.",
        sourceIds: [sourceId],
        locators: [{ fieldPath: `strategyWorkspace.scenarios.${scenario.id}.inputs.${key}` }],
        observedAt: scenario.savedAt,
        updatedAt: scenario.updatedAt ?? scenario.savedAt,
        userConfirmed: selected,
        excluded: !selected,
      });
    }
    for (const item of scenario.summary) {
      addClaim(pack, {
        id: `claim-strategy-${scenario.id}-summary-${slug(item.label)}`,
        parcelId: scenario.parcelId,
        domain: "strategy",
        key: slug(item.label),
        label: item.label,
        value: item.value,
        normalizedValue: item.value,
        nature: "calculation",
        status: selected ? "supported" : "not_reviewed",
        confidence: "medium",
        confidenceReason: "Deterministic calculator output from saved Strategy assumptions. It is not a valuation opinion.",
        sourceIds: [sourceId],
        locators: [{ fieldPath: `strategyWorkspace.scenarios.${scenario.id}.summary.${slug(item.label)}` }],
        observedAt: scenario.savedAt,
        updatedAt: scenario.updatedAt ?? scenario.savedAt,
        userConfirmed: selected,
        excluded: !selected,
      });
    }
  }
}

function addSitePotentialEvidence(
  pack: MutablePack,
  input: BuildPropertyEvidencePackInput,
  assets: ErfAsset[],
  selectedDesign: ErfAsset | null,
  systemSourceId: string,
) {
  const project = input.sitePotentialProject?.parcel_id === input.parcel.id ? input.sitePotentialProject : null;
  if (project) {
    const sourceId = addSource(pack, {
      id: `site-project-${project.id}`,
      parcelId: project.parcel_id,
      kind: "site_potential",
      label: "Site Potential project",
      authorityType: "ai_generated",
      sourceQuality: "reference",
      status: project.generation_status === "failed" ? "failed" : "ready",
      capturedAt: project.created_at,
      updatedAt: project.updated_at,
      locators: [{ fieldPath: "sitePotentialProject" }],
      fragments: [project.design_brief, project.custom_instructions].filter((value): value is string => Boolean(value)).map(limitFragment),
    });
    addClaim(pack, {
      id: `claim-site-project-${project.id}`,
      parcelId: project.parcel_id,
      domain: "site",
      key: "sitePotentialProject",
      label: "Site Potential project state",
      value: project.generation_status,
      normalizedValue: project.generation_status,
      nature: "interpretation",
      status: "supported",
      confidence: "unverified",
      confidenceReason: "Site Potential state records workflow progress only. Generated concepts are AI interpretation.",
      sourceIds: [sourceId],
      locators: [{ fieldPath: "sitePotentialProject.generation_status" }],
      observedAt: project.created_at,
      updatedAt: project.updated_at,
      userConfirmed: Boolean(project.selected_design_asset_id),
      excluded: false,
    });
  } else if (input.workspaceState.sitePotential.progressState !== "not_started") {
    addClaim(pack, {
      id: "claim-site-workspace-state",
      parcelId: input.parcel.id,
      domain: "site",
      key: "sitePotentialWorkspaceState",
      label: "Site Potential workspace state",
      value: input.workspaceState.sitePotential.progressState,
      normalizedValue: input.workspaceState.sitePotential.progressState,
      nature: "interpretation",
      status: "partial",
      confidence: "unverified",
      confidenceReason: "Workspace state indicates Site Potential progress but does not prove planning approval or buildability.",
      sourceIds: [systemSourceId],
      locators: [{ fieldPath: "workspaceState.sitePotential.progressState" }],
      observedAt: input.workspaceState.updatedAt,
      updatedAt: input.workspaceState.updatedAt,
      userConfirmed: false,
      excluded: false,
    });
  }

  const generated = assets.filter((asset) => asset.asset_category === "generated_design");
  if (generated.length) {
    addClaim(pack, {
      id: "claim-site-concept-count",
      parcelId: input.parcel.id,
      domain: "site",
      key: "sitePotentialConceptCount",
      label: "Generated concept count",
      value: generated.length,
      normalizedValue: generated.length,
      nature: "interpretation",
      status: "supported",
      confidence: "unverified",
      confidenceReason: "Count of AI-generated Site Potential concept assets.",
      sourceIds: generated.map((asset) => `asset-${asset.id}`),
      locators: [],
      observedAt: newestDate(generated.map((asset) => asset.created_at)),
      updatedAt: newestDate(generated.map((asset) => asset.updated_at)),
      userConfirmed: Boolean(selectedDesign),
      excluded: false,
    });
  }
}

function addCrossParcelRejections(
  pack: MutablePack,
  input: BuildPropertyEvidencePackInput,
  systemSourceId: string,
) {
  if (input.chosenScenario && input.chosenScenario.parcelId !== input.parcel.id) {
    pack.contradictions.push({
      id: "chosen-scenario-cross-parcel",
      parcelId: input.parcel.id,
      title: "Chosen Strategy scenario belongs to another parcel",
      severity: "high",
      explanation: "A supplied chosen Strategy scenario was rejected because its parcel ID does not match this erf.",
      claimIds: [],
      sourceIds: [systemSourceId],
      displayedValues: [input.chosenScenario.parcelId, input.parcel.id],
      nextAction: "Choose a Strategy scenario for this erf.",
      targetTab: "calculators",
    });
  }
  if (input.selectedSiteDesign && input.selectedSiteDesign.parcel_id !== input.parcel.id) {
    pack.contradictions.push({
      id: "selected-site-design-cross-parcel",
      parcelId: input.parcel.id,
      title: "Selected Site Potential asset belongs to another parcel",
      severity: "high",
      explanation: "A selected Site Potential asset was rejected because its parcel ID does not match this erf.",
      claimIds: [],
      sourceIds: [systemSourceId],
      displayedValues: [input.selectedSiteDesign.parcel_id, input.parcel.id],
      nextAction: "Select or generate a Site Potential concept for this erf.",
      targetTab: "site-potential",
    });
  }
}

function addContradictions(
  pack: MutablePack,
  input: BuildPropertyEvidencePackInput,
  evidence: SavedMarketEvidence[],
) {
  const confirmedAddress = input.marketAddressIntelligence?.userConfirmedAddress ?? null;
  if (confirmedAddress?.municipality && input.parcel.municipality && normalizeText(confirmedAddress.municipality) !== normalizeText(input.parcel.municipality)) {
    const officialClaim = findClaim(pack, "identity", "municipality");
    const addressClaim = findClaim(pack, "address", "municipality", `claim-address-${confirmedAddress.id}-municipality`);
    addContradiction(pack, {
      id: "market-address-municipality-mismatch",
      title: "Confirmed market-address municipality differs from parcel municipality",
      severity: "high",
      explanation: "The user-confirmed market address and parcel municipality disagree.",
      claimIds: compact([officialClaim?.id, addressClaim?.id]),
      sourceIds: unique(compact([...(officialClaim?.sourceIds ?? []), ...(addressClaim?.sourceIds ?? [])])),
      displayedValues: [`Market address: ${confirmedAddress.municipality}`, `Parcel: ${input.parcel.municipality}`],
      nextAction: "Reconfirm the Market address and parcel identity.",
      targetTab: "listings",
    });
    markClaimsConflicting(pack, compact([officialClaim?.id, addressClaim?.id]));
  }
  if (confirmedAddress?.province && input.parcel.province && normalizeText(confirmedAddress.province) !== normalizeText(input.parcel.province)) {
    const officialClaim = findClaim(pack, "identity", "province");
    const addressClaim = findClaim(pack, "address", "province", `claim-address-${confirmedAddress.id}-province`);
    addContradiction(pack, {
      id: "market-address-province-mismatch",
      title: "Confirmed market-address province differs from parcel province",
      severity: "high",
      explanation: "The user-confirmed market address and parcel province disagree.",
      claimIds: compact([officialClaim?.id, addressClaim?.id]),
      sourceIds: unique(compact([...(officialClaim?.sourceIds ?? []), ...(addressClaim?.sourceIds ?? [])])),
      displayedValues: [`Market address: ${confirmedAddress.province}`, `Parcel: ${input.parcel.province}`],
      nextAction: "Reconfirm the Market address and parcel identity.",
      targetTab: "listings",
    });
    markClaimsConflicting(pack, compact([officialClaim?.id, addressClaim?.id]));
  }
  // Canonical precedence resolves to a single area claim; surface disagreement
  // between *stated* official aliases without letting a lesser alias win.
  const areaAliases = statedAreaAliases(input.parcel.rawProperties as Record<string, unknown> | null | undefined);
  if (areaAliases.length > 1) {
    const min = Math.min(...areaAliases.map((a) => a.value));
    const max = Math.max(...areaAliases.map((a) => a.value));
    if (max - min > 1 && (max - min) / max > 0.01) {
      const canonicalClaim = findClaim(pack, "identity", "areaM2");
      addContradiction(pack, {
        id: "official-area-alias-conflict",
        title: "Official area aliases disagree",
        severity: "medium",
        explanation:
          "More than one official square-metre area attribute is present and they do not agree. Easy Erf uses the highest-precedence value (CSG GEOM_AREA where available).",
        claimIds: compact([canonicalClaim?.id]),
        sourceIds: unique(compact([...(canonicalClaim?.sourceIds ?? [])])),
        displayedValues: areaAliases.map((a) => `${a.key}: ${a.value}`),
        nextAction: "Verify the registered erf area against the SG diagram.",
        targetTab: "sources",
      });
      markClaimsConflicting(pack, compact([canonicalClaim?.id]));
    }
  }
  addAliasConflict(pack, "planning", "zoning", "official-zoning-alias-conflict", "Official zoning aliases disagree", "Verify zoning against municipal planning records.");

  const officialArea = firstClaimNumber(pack.claims, "identity", "areaM2", true);
  const subjectListings = evidence.filter((item) => item.listingRole === "subject_active_listing");
  if (subjectListings.length > 1) {
    const listingClaims = subjectListings
      .map((item) => findClaim(pack, "market", "listingRole", `claim-market-${item.id}-listingRole`))
      .filter((claim): claim is EvidenceClaim => Boolean(claim));
    addContradiction(pack, {
      id: "multiple-subject-active-listings",
      title: "More than one active subject listing is saved",
      severity: "medium",
      explanation: "Multiple listings are marked as the active listing for this erf.",
      claimIds: listingClaims.map((claim) => claim.id),
      sourceIds: unique(listingClaims.flatMap((claim) => claim.sourceIds)),
      displayedValues: subjectListings.map((item) => `${item.title}: ${item.listingRole ?? "unknown role"}`),
      nextAction: "Keep one active subject listing and convert others to comparable evidence.",
      targetTab: "listings",
    });
    markClaimsConflicting(pack, listingClaims.map((claim) => claim.id));
  }
  for (const listing of subjectListings) {
    if (!officialArea || !listing.landSizeM2) continue;
    const diff = Math.abs(officialArea - listing.landSizeM2);
    const pct = (diff / officialArea) * 100;
    if (pct > AREA_MISMATCH_PERCENT && diff > AREA_MISMATCH_M2) {
      const areaClaim = findClaim(pack, "identity", "areaM2");
      const listingClaim = findClaim(pack, "market", "landSizeM2", `claim-market-${listing.id}-landSizeM2`);
      addContradiction(pack, {
        id: `subject-land-size-mismatch-${listing.id}`,
        title: "Subject listing land size differs from official erf area",
        severity: "medium",
        explanation: `Difference is ${pct.toFixed(1)}% and ${Math.round(diff)} m2, above the ${AREA_MISMATCH_PERCENT}% and ${AREA_MISMATCH_M2} m2 threshold.`,
        claimIds: compact([areaClaim?.id, listingClaim?.id]),
        sourceIds: unique(compact([...(areaClaim?.sourceIds ?? []), ...(listingClaim?.sourceIds ?? [])])),
        displayedValues: [`Official area: ${officialArea} m2`, `Listing land size: ${listing.landSizeM2} m2`],
        nextAction: "Check the listing against the SG diagram and parcel record.",
        targetTab: "listings",
      });
      markClaimsConflicting(pack, compact([areaClaim?.id, listingClaim?.id]));
    }
  }
  const sourceIds = new Set(pack.sources.map((source) => source.id));
  for (const claim of pack.claims) {
    const missing = claim.sourceIds.filter((id) => !sourceIds.has(id));
    if (missing.length) {
      pack.contradictions.push({
        id: `missing-source-reference-${claim.id}`,
        parcelId: pack.parcelId,
        title: "Evidence claim points to a missing source",
        severity: "high",
        explanation: "The pack contains a claim whose source reference could not be found.",
        claimIds: [claim.id],
        sourceIds: missing,
        displayedValues: missing,
        nextAction: "Repair the source-to-claim evidence link.",
        targetTab: "stoep-report",
      });
    }
  }
}

function addGaps(
  pack: MutablePack,
  input: BuildPropertyEvidencePackInput,
  assets: ErfAsset[],
  evidence: SavedMarketEvidence[],
  workspace: ReturnType<typeof createEmptyStrategyWorkspace>,
  chosenScenario: ErfStrategyScenario | null,
  selectedSiteDesign: ErfAsset | null,
) {
  const planningClaims = (key: string) => pack.claims.some((claim) => claim.domain === "planning" && claim.key === key && claim.status === "supported");
  const gap = (id: string, domain: EvidenceDomain, importance: "low" | "medium" | "high", title: string, explanation: string, basis: string, nextAction: string, targetTab: string, blocking = false) =>
    pack.gaps.push({ id, parcelId: input.parcel.id, domain, importance, title, explanation, basis, nextAction, targetTab, blocking });

  if (!["checked", "looks_correct"].includes(input.workspaceState.identityStatus)) {
    gap("identity-not-user-reviewed", "identity", "high", "Official identity not user-reviewed", "The official parcel identity has not been marked as checked for this erf.", `identityStatus=${input.workspaceState.identityStatus}`, "Review the official identity in Sources.", "research", true);
  }
  if (!pack.claims.some((claim) => claim.key === "areaM2")) gap("missing-erf-area", "identity", "medium", "Erf area missing", "No official erf area claim is available.", "No recognized area alias on parcel raw properties.", "Upload or open the SG diagram.", "research");
  for (const [key, label] of [["zoning", "Zoning"], ["coverage", "Coverage"], ["far", "FAR"], ["height", "Height"], ["setbacks", "Setbacks or building lines"], ["permittedUses", "Permitted uses"]] as const) {
    if (!planningClaims(key)) gap(`missing-${key}`, "planning", key === "zoning" ? "high" : "medium", `${label} missing`, `${label} has not been captured from a supported source.`, `No supported planning claim for ${key}.`, `Verify ${label.toLowerCase()} with municipal planning records.`, "research", key === "zoning");
  }
  if (!pack.claims.some((claim) => claim.domain === "ownership" && claim.status === "supported")) {
    gap("ownership-not-verified", "ownership", "high", "Ownership not verified", "No structured ownership claim exists for this erf.", "Uploaded reports alone do not verify ownership without extracted ownership text.", "Upload or review title deed, WinDeed or Lightstone ownership evidence.", "reports", true);
  }
  const unreadDocuments = assets.filter(
    (asset) =>
      isExtractableErfAsset(asset) &&
      erfAssetIdentityMatchStatus(asset) == null &&
      !["ready", "partial"].includes(erfAssetExtractionStatus(asset)),
  );
  if (unreadDocuments.length) {
    const failed = unreadDocuments.filter((asset) => erfAssetExtractionStatus(asset) === "failed");
    const extracting = unreadDocuments.filter((asset) => erfAssetExtractionStatus(asset) === "processing");
    gap(
      "documents-not-read",
      "documents",
      "high",
      failed.length
        ? "A document could not be read"
        : extracting.length
          ? "A document is still being extracted"
          : "Uploaded documents have not been read yet",
      failed.length
        ? `Easy Erf could not read ${failed.length} uploaded document${failed.length === 1 ? "" : "s"}, so their contents are not in the evidence pack.`
        : `${unreadDocuments.length} uploaded document${unreadDocuments.length === 1 ? " is" : "s are"} stored but not yet read, so their contents cannot be quoted or searched.`,
      failed.length
        ? (failed.map((asset) => erfAssetExtractionError(asset)).find(Boolean) ?? "Extraction failed.")
        : unreadDocuments.map((asset) => asset.original_file_name).slice(0, 5).join(", "),
      failed.length ? "Retry reading the document in Reports." : "Read these documents so their values become searchable evidence.",
      "reports",
    );
  }
  if (!assets.some((asset) => asset.asset_category === "paid_report" || asset.asset_category === "title_deed")) {
    gap("no-title-deed-or-paid-report", "deeds", "medium", "No title deed or paid ownership report", "No ownership/deeds document is attached.", "No paid_report or title_deed asset found.", "Add Lightstone, WinDeed or title deed documents.", "reports");
  }
  if (!assets.some((asset) => asset.asset_category === "sg_diagram")) {
    gap("sg-diagram-missing", "documents", "medium", "SG diagram missing", "No SG diagram is attached for this erf.", "No sg_diagram asset found.", "Upload or fetch the SG diagram.", "research");
  }
  for (const asset of assets.filter((doc) => criticalDocument(doc) && !erfAssetHasSearchableExtraction(doc))) {
    const identity = erfAssetIdentityMatchStatus(asset);
    // Never say "no report was uploaded" — the file exists; say exactly why it is unusable.
    const state =
      identity === "mismatch"
        ? { title: "Uploaded document is for the wrong property", detail: "describes a different property, so nothing in it can be quoted for this erf", action: "Upload the correct report for this erf." }
        : identity === "unverified"
          ? { title: "Uploaded document could not be matched to this erf", detail: "does not identify this erf clearly enough to be used as evidence", action: "Upload a report that states this erf's identity." }
          : erfAssetExtractionStatus(asset) === "failed"
            ? { title: "Uploaded document could not be read", detail: erfAssetExtractionError(asset) ?? "could not be read", action: "Retry extraction in Reports." }
            : erfAssetExtractionStatus(asset) === "processing"
              ? { title: "Uploaded document is still being extracted", detail: "is being extracted right now", action: "Wait for extraction to finish." }
              : erfAssetExtractionStatus(asset) === "partial"
                ? { title: "Uploaded document is searchable but has no structured values", detail: "was read but no structured values were found", action: "Check the document manually or upload a clearer copy." }
                : { title: "Uploaded document has not been extracted yet", detail: "is uploaded but has not been read yet", action: "Read the document in Reports." };
    gap(
      `document-extraction-missing-${asset.id}`,
      "documents",
      "medium",
      state.title,
      `${asset.original_file_name} ${state.detail}.`,
      `extractionStatus=${erfAssetExtractionStatus(asset)}; identityMatchStatus=${identity ?? "none"}`,
      state.action,
      "reports",
    );
  }
  if (!input.marketAddressIntelligence?.userConfirmedAddress) {
    gap("confirmed-market-address-missing", "address", "medium", "Confirmed market address missing", "No user-confirmed working market address is saved.", "marketAddressIntelligence.userConfirmedAddress is missing.", "Confirm a market address in Market.", "listings");
  }
  const usableComps = evidence.filter((item) => item.listingRole !== "subject_active_listing" && item.includeInSummary && item.confidence !== "excluded" && item.relationship !== "not_related");
  if (usableComps.length < 3) {
    gap("fewer-than-three-comps", "market", "high", "Fewer than three included comparable items", "Market summary needs at least three relevant included comparables.", `${usableComps.length} usable comparable item(s).`, "Save more comparable listings or sales.", "listings", true);
  }
  if (!evidence.some((item) => item.listingRole === "subject_active_listing")) {
    gap("no-subject-active-listing", "market", "low", "No subject active listing", "No active listing is saved as the subject listing for this erf.", "No subject_active_listing market evidence.", "Import or add the active listing for this erf if one exists.", "listings");
  }
  if (!chosenScenario) {
    gap("chosen-strategy-scenario-missing", "strategy", "high", "Chosen Strategy scenario missing", "No Strategy scenario is selected to feed the Easy Erf Report.", `scenarioCount=${workspace.scenarios.length}`, "Choose a scenario in Strategy Lab.", "calculators", true);
  }
  const strategyName = chosenScenario?.strategy ?? workspace.activeStrategy;
  const development = /development|flip|brrrr/i.test(strategyName);
  if (development && ["zoning", "coverage", "far", "height", "setbacks", "permittedUses"].some((key) => !planningClaims(key))) {
    gap("development-planning-controls-unverified", "planning", "high", "Development strategy lacks verified planning controls", "A development-sensitive strategy is selected, but core planning controls are incomplete.", `strategy=${strategyName}`, "Verify planning controls before relying on development outputs.", "research", true);
  }
  if (development && !selectedSiteDesign) {
    gap("selected-site-potential-concept-missing", "site", "medium", "Selected Site Potential concept missing", "Development analysis can be strengthened by a selected Site Potential concept, but it is not a legal requirement.", `strategy=${strategyName}`, "Generate or select a Site Potential concept, or explicitly skip it.", "site-potential");
  }
  const questions = input.propertyNotes?.parcelId === input.parcel.id ? splitLines(input.propertyNotes.questions) : [];
  for (const [index, question] of questions.entries()) {
    gap(`unresolved-user-question-${index + 1}`, "notes", "low", "Unresolved user question", question, "Question saved in property notes.", "Resolve or update the note when answered.", "notes");
  }
}

function addTimeline(
  pack: MutablePack,
  input: BuildPropertyEvidencePackInput,
  assets: ErfAsset[],
  evidence: SavedMarketEvidence[],
  workspace: ReturnType<typeof createEmptyStrategyWorkspace>,
  chosenScenario: ErfStrategyScenario | null,
  selectedSiteDesign: ErfAsset | null,
  builtAt: string,
) {
  const confirmed = input.marketAddressIntelligence?.userConfirmedAddress;
  if (confirmed) addTimelineEvent(pack, { id: "timeline-market-address-confirmed", parcelId: input.parcel.id, occurredAt: confirmed.updatedAt ?? confirmed.createdAt, label: "Market address confirmed", detail: confirmed.formattedAddress, sourceIds: [`address-${confirmed.id}`], domain: "address" });
  for (const asset of assets) {
    addTimelineEvent(pack, { id: `timeline-asset-uploaded-${asset.id}`, parcelId: input.parcel.id, occurredAt: asset.created_at, label: "Asset uploaded", detail: asset.original_file_name, sourceIds: [`asset-${asset.id}`], domain: "documents" });
    if (extractionStatus(asset) === "ready" || extractionStatus(asset) === "failed") {
      addTimelineEvent(pack, { id: `timeline-asset-extraction-${asset.id}`, parcelId: input.parcel.id, occurredAt: asset.updated_at, label: extractionStatus(asset) === "ready" ? "Extraction completed" : "Extraction failed", detail: asset.original_file_name, sourceIds: [`asset-${asset.id}`], domain: "documents" });
    }
  }
  for (const item of evidence) {
    addTimelineEvent(pack, { id: `timeline-market-evidence-${item.id}`, parcelId: input.parcel.id, occurredAt: item.updatedAt ?? item.savedAt, label: "Market Evidence saved or updated", detail: item.title, sourceIds: [`market-${item.id}`], domain: "market" });
  }
  if (workspace.draftUpdatedAt) addTimelineEvent(pack, { id: "timeline-strategy-draft-updated", parcelId: input.parcel.id, occurredAt: workspace.draftUpdatedAt, label: "Strategy draft updated", detail: workspace.activeStrategy, sourceIds: ["strategy-workspace"], domain: "strategy" });
  if (chosenScenario) addTimelineEvent(pack, { id: `timeline-strategy-chosen-${chosenScenario.id}`, parcelId: input.parcel.id, occurredAt: chosenScenario.updatedAt ?? chosenScenario.savedAt, label: "Strategy scenario chosen", detail: chosenScenario.label, sourceIds: ["strategy-workspace"], domain: "strategy" });
  if (selectedSiteDesign) addTimelineEvent(pack, { id: `timeline-site-concept-selected-${selectedSiteDesign.id}`, parcelId: input.parcel.id, occurredAt: selectedSiteDesign.updated_at, label: "Site Potential concept selected", detail: selectedSiteDesign.original_file_name, sourceIds: [`asset-${selectedSiteDesign.id}`], domain: "site" });
  if (input.propertyNotes?.parcelId === input.parcel.id && input.propertyNotes.updatedAt) addTimelineEvent(pack, { id: "timeline-notes-updated", parcelId: input.parcel.id, occurredAt: input.propertyNotes.updatedAt, label: "Notes updated", detail: "Property notes changed.", sourceIds: ["property-notes"], domain: "notes" });
  addTimelineEvent(pack, { id: "evidence-pack-built", parcelId: input.parcel.id, occurredAt: builtAt, label: "Evidence pack built", detail: "Canonical Property Evidence Pack assembled from current saved evidence.", sourceIds: ["system-state"], domain: "documents" });
}

function buildDomainSummaries(pack: MutablePack): EvidenceDomainSummary[] {
  return ALL_DOMAINS.map((domain) => {
    const claims = pack.claims.filter((claim) => claim.domain === domain);
    const gaps = pack.gaps.filter((gap) => gap.domain === domain);
    const contradictions = pack.contradictions.filter((item) =>
      item.claimIds.some((id) => claims.some((claim) => claim.id === id)),
    );
    const supported = claims.filter((claim) => claim.status === "supported" && !claim.excluded);
    const missing = claims.filter((claim) => claim.status === "missing").length + gaps.length;
    const state: EvidenceDomainState = contradictions.length
      ? "conflicting"
      : supported.length && !gaps.some((gap) => gap.blocking)
        ? gaps.length
          ? "partial"
          : "supported"
        : supported.length
          ? "partial"
          : gaps.length
            ? "missing"
            : "not_reviewed";
    return {
      domain,
      state,
      explanation: domainExplanation(domain, state, supported.length, gaps.length),
      supportedClaimCount: supported.length,
      missingClaimCount: missing,
      conflictingClaimCount: contradictions.length,
      sourceIds: Array.from(new Set(claims.flatMap((claim) => claim.sourceIds))).sort(),
      nextAction: gaps[0]?.nextAction ?? null,
    };
  });
}

function addSource(pack: MutablePack, source: EvidenceSourceReference): string {
  const existing = pack.sources.find((item) => item.id === source.id);
  if (existing) return existing.id;
  pack.sources.push({
    ...source,
    locators: sortLocators(source.locators),
    fragments: source.fragments.map(limitFragment),
  });
  return source.id;
}

function addClaim(pack: MutablePack, claim: EvidenceClaim) {
  pack.claims.push({
    ...claim,
    sourceIds: unique(claim.sourceIds).sort(),
    locators: sortLocators(claim.locators),
  });
}

function addTimelineEvent(pack: MutablePack, event: EvidenceTimelineEvent) {
  if (Number.isNaN(new Date(event.occurredAt).getTime())) return;
  pack.timeline.push(event);
}

function addContradiction(
  pack: MutablePack,
  contradiction: Omit<EvidenceContradiction, "parcelId">,
) {
  pack.contradictions.push({
    ...contradiction,
    parcelId: pack.parcelId,
    claimIds: unique(contradiction.claimIds),
    sourceIds: unique(contradiction.sourceIds),
    displayedValues: unique(contradiction.displayedValues),
  });
}

function addAliasConflict(pack: MutablePack, domain: EvidenceDomain, key: string, id: string, title: string, nextAction: string) {
  const claims = pack.claims.filter((claim) => claim.domain === domain && claim.key === key && claim.normalizedValue != null);
  const values = Array.from(new Set(claims.map((claim) => String(claim.normalizedValue))));
  if (values.length <= 1) return;
  pack.contradictions.push({
    id,
    parcelId: pack.parcelId,
    title,
    severity: "medium",
    explanation: "Recognized official aliases contain materially different normalized values.",
    claimIds: claims.map((claim) => claim.id),
    sourceIds: Array.from(new Set(claims.flatMap((claim) => claim.sourceIds))),
    displayedValues: claims.map((claim) => `${claim.locators[0]?.fieldPath ?? claim.key}: ${claim.value}`),
    nextAction,
    targetTab: "research",
  });
  for (const claim of claims) claim.status = "conflicting";
}

function findClaim(pack: MutablePack, domain: EvidenceDomain, key: string, id?: string) {
  if (id) {
    const exact = pack.claims.find((claim) => claim.id === id);
    if (exact) return exact;
  }
  return pack.claims.find((claim) => claim.domain === domain && claim.key === key && !claim.excluded) ?? null;
}

function markClaimsConflicting(pack: MutablePack, claimIds: string[]) {
  const ids = new Set(claimIds);
  for (const claim of pack.claims) {
    if (ids.has(claim.id)) claim.status = "conflicting";
  }
}

function marketClaim(pack: MutablePack, item: SavedMarketEvidence, base: Partial<EvidenceClaim>, key: string, label: string, value: unknown, unit?: string) {
  if (value == null || String(value).trim() === "") return;
  addClaim(pack, {
    ...(base as EvidenceClaim),
    id: `claim-market-${item.id}-${key}`,
    key,
    label,
    value: typeof value === "number" ? value : String(value),
    normalizedValue: numeric(value) ?? normalizeValue(value),
    unit: unit ?? null,
    locators: [{ sourceUrl: item.sourceUrl, fieldPath: `savedMarketEvidence.${item.id}.${key}` }],
  });
}

function selectChosenScenario(
  parcelId: string,
  chosen: ErfStrategyScenario | null | undefined,
  workspace: ReturnType<typeof createEmptyStrategyWorkspace>,
  scenarios: ErfStrategyScenario[],
) {
  if (chosen?.parcelId === parcelId) return chosen;
  const chosenId = workspace.chosenScenarioId;
  return scenarios.find((scenario) => scenario.id === chosenId) ?? scenarios.find((scenario) => scenario.selected) ?? null;
}

function uniqueScenario(parcelId: string) {
  const seen = new Set<string>();
  return (scenario: ErfStrategyScenario) => {
    if (scenario.parcelId !== parcelId || seen.has(scenario.id)) return false;
    seen.add(scenario.id);
    return true;
  };
}

function candidates(raw: Record<string, unknown>, keys: string[]) {
  return keys
    .map((key) => ({ path: `rawProperties.${key}`, value: raw[key] }))
    .filter((candidate) => candidate.value != null && String(candidate.value).trim() !== "");
}

function firstClaimNumber(
  claims: EvidenceClaim[],
  domain: EvidenceDomain,
  key: string,
  includeConflicting = false,
) {
  const claim = claims.find(
    (item) =>
      item.domain === domain &&
      item.key === key &&
      (item.status === "supported" || (includeConflicting && item.status === "conflicting")),
  );
  return numeric(claim?.normalizedValue ?? claim?.value) ?? null;
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function claimScalar(value: unknown): string | number | boolean | null {
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeValue(value: unknown) {
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = String(value ?? "").trim();
  return text ? normalizeText(text) : null;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slug(value: string) {
  return normalizeText(value).replace(/\s+/g, "-") || "value";
}

export const EXTRACTED_FACT_CONFIDENCE_REASON =
  "Fact explicitly stated in an identity-matched uploaded report; verify against the issuing source for legal reliance.";

/** Categories whose extracted registered extent may outrank the map area. */
const REGISTERED_EXTENT_CATEGORIES = ["paid_report", "title_deed", "sg_diagram", "official_document"];

/**
 * Highest-precedence area input: an explicit `areaM2` claim, with a quote and
 * page, read from an identity-matched deed / SG diagram / paid report.
 * A mismatched or unverified document can never reach this selector.
 */
function selectVerifiedRegisteredExtent(assets: ErfAsset[], parcelId: string) {
  for (const asset of assets) {
    if (asset.parcel_id !== parcelId) continue;
    if (!REGISTERED_EXTENT_CATEGORIES.includes(asset.asset_category)) continue;
    if (!erfAssetHasSearchableExtraction(asset)) continue;
    // A parent General Plan states the PARENT's extent; it may never set this
    // erf's area, so the whole asset is excluded from this selector.
    if (erfAssetIsParentLineageMatch(asset)) continue;
    for (const claim of erfAssetExtractedClaims(asset)) {
      if (!claim || claim.domain !== "identity" || claim.key !== "areaM2") continue;
      if (typeof claim.quote !== "string" || !claim.quote.trim()) continue;
      if (typeof claim.page !== "number" || !Number.isFinite(claim.page)) continue;
      const numeric =
        typeof claim.numericValue === "number" && Number.isFinite(claim.numericValue)
          ? claim.numericValue
          : Number(String(claim.value ?? "").replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(numeric) || numeric <= 0) continue;
      return { areaM2: numeric, sourceKey: `asset:${asset.id}#page${claim.page}` };
    }
  }
  return null;
}

function claimId(domain: EvidenceDomain, key: string, path: string) {
  return `claim-${domain}-${key}-${slug(path)}`;
}

function limitFragment(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, FRAGMENT_LIMIT);
}

function extractionStatus(asset: ErfAsset) {
  const value = asset.metadata.extractionStatus ?? asset.metadata.extraction_status;
  return typeof value === "string" ? value : null;
}

function extractionNote(asset: ErfAsset) {
  const warning = asset.metadata.extractionWarning ?? asset.metadata.extraction_warning;
  return typeof warning === "string" ? warning : null;
}

function assetMetadata(asset: ErfAsset, selectedSiteConcept: boolean) {
  return {
    category: asset.asset_category,
    assetType: asset.asset_type,
    mimeType: asset.mime_type,
    sizeBytes: asset.size_bytes,
    checksumSha256: asset.checksum_sha256,
    storageStatus: asset.status,
    extractionStatus: extractionStatus(asset),
    extractionWarning: extractionNote(asset),
    pageCount: metadataNumber(asset.metadata.pageCount ?? asset.metadata.page_count),
    selectedSiteConcept,
    conceptName: metadataString(asset.metadata.conceptName),
    conceptRationale: metadataString(asset.metadata.conceptRationale ?? asset.metadata.rationale),
  };
}

function metadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function metadataNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractedFragments(asset: ErfAsset) {
  if (!erfAssetHasSearchableExtraction(asset)) return [];
  const text = asset.metadata.extractedText ?? asset.metadata.extracted_text;
  if (typeof text !== "string" || !text.trim()) return [];
  return splitFragments(text).map(limitFragment);
}

function splitFragments(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const fragments: string[] = [];
  for (let index = 0; index < normalized.length; index += FRAGMENT_LIMIT) {
    fragments.push(normalized.slice(index, index + FRAGMENT_LIMIT));
  }
  return fragments;
}

function criticalDocument(asset: ErfAsset) {
  return ["paid_report", "title_deed", "zoning_document", "sg_diagram", "official_document"].includes(asset.asset_category);
}

function splitLines(value: string | null | undefined) {
  return String(value ?? "")
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function newestDate(values: Array<string | null | undefined>): string | null {
  let newest: string | null = null;
  let newestMs = -Infinity;
  for (const value of values) {
    if (!value) continue;
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms) || ms < newestMs) continue;
    newest = value;
    newestMs = ms;
  }
  return newest;
}

function dedupeTimeline(events: EvidenceTimelineEvent[]) {
  return Array.from(new Map(events.map((event) => [event.id, event])).values());
}

function domainExplanation(domain: EvidenceDomain, state: EvidenceDomainState, supported: number, gaps: number) {
  if (state === "supported") return `${domain} has ${supported} supported claim(s).`;
  if (state === "partial") return `${domain} is partially supported with ${supported} claim(s) and ${gaps} gap(s).`;
  if (state === "conflicting") return `${domain} contains conflicting visible evidence.`;
  if (state === "missing") return `${domain} is missing required evidence.`;
  return `${domain} has not been reviewed yet.`;
}

function isOfficialParcelSource(source: string | null | undefined) {
  return Boolean(source && OFFICIAL_PARCEL_SOURCES.has(source.toLowerCase()));
}

function compact<T>(values: Array<T | null | undefined>): T[] {
  return values.filter((value): value is T => value != null);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function sortLocators(locators: EvidenceLocator[]) {
  return locators.slice().sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
