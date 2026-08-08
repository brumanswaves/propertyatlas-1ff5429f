/**
 * Easy Erf report findings + actions layer.
 *
 * This module sits directly above the canonical PropertyEvidencePack. It never
 * fetches, never calls a model and never invents evidence: every finding is a
 * deterministic reading of claims, contradictions, gaps and domain states that
 * already exist in the pack. React must never decide evidence meaning itself.
 */
import type {
  EvidenceClaim,
  EvidenceConfidence,
  EvidenceContradiction,
  EvidenceDomain,
  EvidenceDomainState,
  EvidenceGap,
  EvidenceSourceReference,
  PropertyEvidencePack,
} from "@/lib/evidence/propertyEvidenceTypes";

export type ReportFindingStatus =
  | "verified"
  | "supported"
  | "no_issue_visible"
  | "not_checked"
  | "missing"
  | "possible_issue"
  | "confirmed_issue"
  | "conflicting";

export type ReportFindingCategory =
  | "identity"
  | "legal"
  | "buildings"
  | "planning"
  | "market"
  | "strategy"
  | "environment"
  | "services"
  | "location";

export type ReportFindingSeverity = "information" | "low" | "medium" | "high";

export interface ReportFinding {
  id: string;
  parcelId: string;
  category: ReportFindingCategory;
  status: ReportFindingStatus;
  severity: ReportFindingSeverity;
  headline: string;
  whatWeFound: string;
  whatItMeans: string;
  confidence: EvidenceConfidence;
  claimIds: string[];
  sourceIds: string[];
  gapIds: string[];
  contradictionIds: string[];
  actionIds: string[];
}

export type ReportActionStatus = "open" | "in_progress" | "completed" | "dismissed";

export interface ReportAction {
  id: string;
  parcelId: string;
  priority: number;
  title: string;
  reason: string;
  completionCriteria: string;
  status: ReportActionStatus;
  targetTab: string;
  /** Canonical Guided task execution metadata, when this action came from that registry. */
  actionLabel?: string;
  estimatedMinutes?: number;
  steps?: string[];
  sourceUrl?: string;
  sourceLabel?: string;
  extraSources?: Array<{ label: string; url: string }>;
  requestTemplate?: string;
  limitations?: string;
  targetAnchorId?: string;
  afterCompletion?: string;
  professionalType?: string;
  findingIds: string[];
  gapIds: string[];
  contradictionIds: string[];
}

/** Positive statuses may never be produced for unknown evidence. */
const POSITIVE_STATUSES: ReportFindingStatus[] = ["verified", "supported", "no_issue_visible"];

export function isPositiveFindingStatus(status: ReportFindingStatus): boolean {
  return POSITIVE_STATUSES.includes(status);
}

const OWNERSHIP_CLAIM_KEYS = ["registeredOwner", "ownerType", "ownershipShare", "coOwners"];
/**
 * Servitude / building-line evidence that is genuinely scoped to this erf.
 * A generic `conditionsOfTitle` claim is deliberately excluded: the mere
 * existence of some title condition says nothing about servitudes and may
 * never make this category positive.
 */
const SERVITUDE_DEED_KEYS = ["servitudes", "servitudeConditions", "rightOfWay"];
const SERVITUDE_PLANNING_KEYS = ["servitudes", "buildingLines", "rightOfWay"];

/** Approved-building evidence. Site Potential concepts are excluded by design. */
const BUILDING_CLAIM_KEYS = [
  "approvedBuildingPlans",
  "buildingPlanStatus",
  "occupancyCertificate",
  "existingStructures",
  "buildingFootprintM2",
];

const PLANNING_CONTROL_KEYS = [
  "zoning",
  "landUse",
  "coverage",
  "far",
  "heightRestriction",
  "buildingLines",
  "densityUnits",
];

/** Owner identity/registration numbers must never reach the report. */
export function redactPersonalIdentifiers(value: string): string {
  return value
    .replace(/\b\d{6}\s?\d{4}\s?\d{2}\s?\d{1}\b/g, "[redacted]")
    .replace(/\b\d{13}\b/g, "[redacted]")
    .replace(/\b(?:19|20)\d{2}\s?\/\s?\d{4,7}\s?\/\s?\d{2}\b/g, "[redacted]")
    .replace(/\b(?:id|identity|registration|reg)\.?\s*(?:no\.?|number)?\s*[:#]?\s*[\dA-Z/-]{6,}/gi, "[redacted]")
    // South African phone numbers, written locally or in +27 form.
    .replace(/(?:\+27|\b0)\s?\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, "[redacted]")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[redacted]")
    .trim();
}


function liveClaims(pack: PropertyEvidencePack): EvidenceClaim[] {
  return pack.claims.filter((claim) => !claim.excluded && claim.parcelId === pack.parcelId);
}

function claimsFor(pack: PropertyEvidencePack, domain: EvidenceDomain, keys?: string[]): EvidenceClaim[] {
  return liveClaims(pack).filter(
    (claim) => claim.domain === domain && (!keys || keys.includes(claim.key)),
  );
}

function supported(claims: EvidenceClaim[]): EvidenceClaim[] {
  return claims.filter((claim) => claim.status === "supported");
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function sourceIdsOf(claims: EvidenceClaim[]): string[] {
  return uniq(claims.flatMap((claim) => claim.sourceIds));
}

const CONFIDENCE_ORDER: EvidenceConfidence[] = ["unverified", "low", "medium", "high"];

/**
 * Mixed evidence is only ever as strong as its weakest claim. Returning the
 * strongest value here would silently overstate a finding, so the weakest
 * confidence actually present always wins, and no claims means unverified.
 */
export function weakestConfidence(claims: EvidenceClaim[]): EvidenceConfidence {
  let weakest = -1;
  for (const claim of claims) {
    const index = CONFIDENCE_ORDER.indexOf(claim.confidence);
    if (index < 0) continue;
    if (weakest < 0 || index < weakest) weakest = index;
  }
  return weakest >= 0 ? CONFIDENCE_ORDER[weakest] : "unverified";
}

/** Canonical domain state from the pack — never a raw count of claims. */
function domainState(pack: PropertyEvidencePack, domain: EvidenceDomain): EvidenceDomainState {
  return pack.domains.find((summary) => summary.domain === domain)?.state ?? "not_reviewed";
}

const WEAK_SOURCE_QUALITIES = ["untrusted_content", "generated_search", "unavailable", "reference"];

/**
 * A category may only become positive when at least one supporting claim is
 * carried by a source of acceptable authority AND quality. Repeating a weak
 * source, or saving the same listing twice, can never satisfy this.
 */
function hasQualifiedSupport(
  pack: PropertyEvidencePack,
  claims: EvidenceClaim[],
  authorities: string[],
): boolean {
  const ids = new Set(claims.flatMap((claim) => claim.sourceIds));
  return pack.sources.some(
    (source) =>
      ids.has(source.id) &&
      authorities.includes(source.authorityType) &&
      !WEAK_SOURCE_QUALITIES.includes(source.sourceQuality),
  );
}

export function isActualUploadedOwnershipSource(source: EvidenceSourceReference): boolean {
  if (source.kind !== "uploaded_document") return false;
  if (!source.assetId || !source.fileName) return false;
  if (
    source.status === "failed" ||
    source.status === "unavailable" ||
    source.status === "excluded"
  ) {
    return false;
  }
  if (source.asset?.category === "paid_report" || source.asset?.category === "title_deed") {
    return true;
  }
  return /lightstone|windeed|title deed|deeds report/i.test(
    `${source.label} ${source.fileName}`,
  );
}

/**
 * A matched paid-provider document (for example a deeds report) is real,
 * qualified evidence for legal conditions even though its extracted text is
 * treated as untrusted content everywhere else. It must still be a stated
 * fact about this erf, so parent General Plan context and drawing
 * interpretations are removed before this test runs.
 */
function subjectFactClaims(claims: EvidenceClaim[]): EvidenceClaim[] {
  return claims.filter(
    (claim) =>
      claim.nature === "fact" &&
      !/general plan|parent/i.test(claim.confidenceReason ?? "") &&
      !/general plan|parent/i.test(claim.notes ?? ""),
  );
}

function hasMatchedPaidDocumentSupport(
  pack: PropertyEvidencePack,
  claims: EvidenceClaim[],
): boolean {
  const ids = new Set(claims.flatMap((claim) => claim.sourceIds));
  return pack.sources.some(
    (source) =>
      ids.has(source.id) &&
      source.authorityType === "paid_provider" &&
      source.status === "ready",
  );
}

/**
 * A municipal/official document (approved plan set, occupancy certificate)
 * that was read and matched to this erf. Architectural plans, notes, listings
 * and AI concepts are deliberately excluded.
 */
function hasMatchedOfficialDocumentSupport(
  pack: PropertyEvidencePack,
  claims: EvidenceClaim[],
): boolean {
  const ids = new Set(claims.flatMap((claim) => claim.sourceIds));
  return pack.sources.some(
    (source) =>
      ids.has(source.id) &&
      source.asset?.category === "official_document" &&
      source.status === "ready",
  );
}

function distinctKeyCount(claims: EvidenceClaim[]): number {
  return new Set(claims.map((claim) => claim.key)).size;
}

/** Collapse duplicate listing saves so repetition cannot look like breadth. */
function distinctSources(sources: PropertyEvidencePack["sources"]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = String(source.url ?? source.label ?? source.id)
      .trim()
      .toLowerCase()
      .replace(/[?#].*$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}


export function claimNumericValue(claim: EvidenceClaim | null | undefined): number | null {
  if (!claim) return null;
  const raw = claim.normalizedValue ?? claim.value;
  const parsed = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function officialAreaClaim(pack: PropertyEvidencePack): EvidenceClaim | null {
  return (
    supported(claimsFor(pack, "identity", ["areaM2"])).find((claim) =>
      claim.sourceIds.some((id) => id === "official-parcel-record" || id.startsWith("official")),
    ) ?? null
  );
}

export function deedExtentClaim(pack: PropertyEvidencePack): EvidenceClaim | null {
  return (
    supported(claimsFor(pack, "identity", ["registeredExtent"])).find((claim) =>
      claim.sourceIds.some((id) => id.startsWith("asset-")),
    ) ?? null
  );
}

interface FindingSeed extends Omit<ReportFinding, "parcelId" | "actionIds" | "gapIds" | "contradictionIds"> {
  gapIds?: string[];
  contradictionIds?: string[];
}

/**
 * Deterministically derive report findings from the canonical evidence pack.
 * A finding without at least one claim, source, gap or contradiction link is
 * dropped: the report may never assert something with no evidence behind it.
 */
export function buildReportFindings(pack: PropertyEvidencePack): ReportFinding[] {
  const findings: ReportFinding[] = [];
  const add = (seed: FindingSeed) => {
    const finding: ReportFinding = {
      ...seed,
      parcelId: pack.parcelId,
      gapIds: seed.gapIds ?? [],
      contradictionIds: seed.contradictionIds ?? [],
      actionIds: [],
    };
    const hasEvidence =
      finding.claimIds.length > 0 ||
      finding.sourceIds.length > 0 ||
      finding.gapIds.length > 0 ||
      finding.contradictionIds.length > 0;
    if (hasEvidence) findings.push(finding);
  };
  const gapById = (id: string) => pack.gaps.find((gap) => gap.id === id) ?? null;
  const gapsWherePrefix = (prefix: string) => pack.gaps.filter((gap) => gap.id.startsWith(prefix));

  // 1. Parcel identity ------------------------------------------------------
  const identityClaims = supported(claimsFor(pack, "identity", ["erfNumber", "lpi", "parcelKey", "portion"]));
  const identityConfirmed = identityClaims.some((claim) => claim.userConfirmed);
  const identityGap = gapById("identity-not-confirmed") ?? gapsWherePrefix("identity-").at(0) ?? null;
  add({
    id: "finding-identity-parcel",
    category: "identity",
    status: identityClaims.length ? (identityConfirmed ? "verified" : "supported") : "missing",
    severity: identityClaims.length ? "information" : "high",
    headline: identityClaims.length
      ? identityConfirmed
        ? "Parcel identity checked against the official record"
        : "Parcel identity read from the official cadastral record"
      : "Parcel identity not established",
    whatWeFound: identityClaims.length
      ? identityClaims.map((claim) => `${claim.label}: ${claim.value}`).join(" · ")
      : "No official identifier claim exists for this erf.",
    whatItMeans: identityClaims.length
      ? identityConfirmed
        ? "Every other finding in this report is tied to this confirmed erf."
        : "Identifiers come from the official parcel layer. Confirming them yourself removes the risk of researching the wrong erf."
      : "Nothing else in this report can be relied on until the erf is identified.",
    confidence: identityClaims.length ? weakestConfidence(identityClaims) : "unverified",
    claimIds: identityClaims.map((claim) => claim.id),
    sourceIds: sourceIdsOf(identityClaims),
    gapIds: identityClaims.length ? [] : identityGap ? [identityGap.id] : [],
  });

  // 2. Address / parcel conflict -------------------------------------------
  const addressConflicts = pack.contradictions.filter((item) => item.id.startsWith("market-address-"));
  if (addressConflicts.length) {
    add({
      id: "finding-address-conflict",
      category: "identity",
      status: "conflicting",
      severity: "high",
      headline: "Working address and official parcel do not agree",
      whatWeFound: addressConflicts.map((item) => item.displayedValues.join(" vs ")).join(" · "),
      whatItMeans:
        "The address being researched may not belong to this erf. Resolve this before relying on any market or planning finding.",
      confidence: "unverified",
      claimIds: uniq(addressConflicts.flatMap((item) => item.claimIds)),
      sourceIds: uniq(addressConflicts.flatMap((item) => item.sourceIds)),
      contradictionIds: addressConflicts.map((item) => item.id),
    });
  }

  // 3 & 4. Official area and registered/deed extent -------------------------
  const officialArea = officialAreaClaim(pack);
  const officialAreaValue = claimNumericValue(officialArea);
  if (officialArea) {
    add({
      id: "finding-official-area",
      category: "identity",
      status: "supported",
      severity: "information",
      headline: `Official cadastral extent ${officialAreaValue?.toLocaleString("en-ZA")} m²`,
      whatWeFound: `The official parcel record states ${officialAreaValue?.toLocaleString("en-ZA")} m².`,
      whatItMeans:
        "This is the cadastral area used for area-based calculations unless a registered deed extent is confirmed.",
      confidence: officialArea.confidence,
      claimIds: [officialArea.id],
      sourceIds: officialArea.sourceIds,
    });
  }
  const deedExtent = deedExtentClaim(pack);
  const deedExtentValue = claimNumericValue(deedExtent);
  if (deedExtent) {
    add({
      id: "finding-registered-extent",
      category: "legal",
      status: "supported",
      severity: "information",
      headline: "Registered extent read from an uploaded document",
      whatWeFound: `The uploaded document states a registered extent of ${deedExtent.value}.`,
      whatItMeans:
        "A registered extent is the deed/diagram figure. It is kept separate from the official cadastral area and never overwrites it.",
      confidence: deedExtent.confidence,
      claimIds: [deedExtent.id],
      sourceIds: deedExtent.sourceIds,
    });
  }

  // 5. Area discrepancy -----------------------------------------------------
  // The discrepancy itself is canonical: it lives in the evidence pack as a
  // contradiction. This finding only reads it, so the report can never invent
  // a discrepancy the evidence layer did not record.
  const areaDiscrepancy = pack.contradictions.find(
    (item) => item.id === "official-area-vs-registered-extent",
  );
  if (areaDiscrepancy && officialAreaValue && deedExtentValue) {
    add({
      id: "finding-area-discrepancy",
      category: "legal",
      status: "conflicting",
      severity: "medium",
      headline: "Cadastral area and registered extent differ",
      whatWeFound: `Official cadastral area ${officialAreaValue.toLocaleString("en-ZA")} m² vs registered extent ${deedExtentValue.toLocaleString("en-ZA")} m².`,
      whatItMeans:
        "Both figures are kept. A conveyancer or land surveyor must confirm which extent applies before it is used in pricing or planning.",
      confidence: "low",
      claimIds: uniq([...areaDiscrepancy.claimIds, officialArea!.id, deedExtent!.id]),
      sourceIds: uniq([...areaDiscrepancy.sourceIds, ...officialArea!.sourceIds, ...deedExtent!.sourceIds]),
      contradictionIds: [areaDiscrepancy.id],
    });
  }


  // 6. Ownership ------------------------------------------------------------
  const ownershipClaims = supported(claimsFor(pack, "ownership", OWNERSHIP_CLAIM_KEYS));
  const ownershipGap = gapById("ownership-not-verified");
  const paidReportSources = pack.sources.filter(isActualUploadedOwnershipSource);
  if (ownershipClaims.length) {
    add({
      id: "finding-ownership",
      category: "legal",
      status: "supported",
      severity: "information",
      headline: "Ownership details read from an identity-matched report",
      whatWeFound: ownershipClaims
        .map((claim) => `${claim.label}: ${redactPersonalIdentifiers(String(claim.value ?? ""))}`)
        .join(" · "),
      whatItMeans:
        "These values were read from a document matched to this erf. Easy Erf does not certify ownership; a conveyancer must confirm it before any legal reliance.",
      confidence: weakestConfidence(ownershipClaims),
      claimIds: ownershipClaims.map((claim) => claim.id),
      sourceIds: sourceIdsOf(ownershipClaims),
    });
  } else {
    const uploadedNotSearchable = paidReportSources.length > 0;
    add({
      id: "finding-ownership",
      category: "legal",
      status: uploadedNotSearchable ? "not_checked" : "missing",
      severity: "high",
      headline: uploadedNotSearchable
        ? "Ownership report uploaded but not readable as evidence yet"
        : "Ownership not established",
      whatWeFound: uploadedNotSearchable
        ? `${paidReportSources.length} uploaded report(s) exist, but no ownership value has been matched to this erf.`
        : "No ownership document has been attached to this erf.",
      whatItMeans: uploadedNotSearchable
        ? "The document is stored, but until it is read and matched to this erf it cannot be used as ownership evidence."
        : "The registered owner, bonds and title conditions are unknown for this erf.",
      confidence: "unverified",
      claimIds: [],
      sourceIds: paidReportSources.map((source) => source.id),
      gapIds: ownershipGap ? [ownershipGap.id] : [],
    });
  }

  // 7. Title deed -----------------------------------------------------------
  const deedClaims = supported(claimsFor(pack, "deeds", ["titleDeedNumber", "registrationDate", "conditionsOfTitle"]));
  const deedGap = gapById("no-title-deed-or-paid-report");
  add({
    id: "finding-title-deed",
    category: "legal",
    status: deedClaims.length ? "supported" : "missing",
    severity: deedClaims.length ? "information" : "medium",
    headline: deedClaims.length ? "Title deed details on file" : "No title deed evidence on file",
    whatWeFound: deedClaims.length
      ? deedClaims.map((claim) => `${claim.label}: ${claim.value}`).join(" · ")
      : "No title deed or deeds-office document has been read for this erf.",
    whatItMeans: deedClaims.length
      ? "Deed values are document-derived and must still be confirmed against the deeds office record."
      : "Title conditions, servitudes and bonds cannot be assessed without the deed.",
    confidence: deedClaims.length ? weakestConfidence(deedClaims) : "unverified",
    claimIds: deedClaims.map((claim) => claim.id),
    sourceIds: sourceIdsOf(deedClaims),
    gapIds: deedClaims.length ? [] : deedGap ? [deedGap.id] : [],
  });

  // 8. SG parent lineage ----------------------------------------------------
  const parentLineageGaps = gapsWherePrefix("document-parent-lineage-");
  if (parentLineageGaps.length) {
    add({
      id: "finding-sg-parent-lineage",
      category: "legal",
      status: "not_checked",
      severity: "low",
      headline: "Parent General Plan attached as context only",
      whatWeFound: parentLineageGaps.map((gap) => gap.title).join(" · "),
      whatItMeans:
        "A parent General Plan covers the parent property and several erven. It is contextual cadastral evidence for this erf, never a legal clearance and never this erf's extent.",
      confidence: "unverified",
      claimIds: [],
      sourceIds: [],
      gapIds: parentLineageGaps.map((gap) => gap.id),
    });
  }

  // 8b. Servitudes / SG -----------------------------------------------------
  // Positive ONLY for an explicit subject-scoped servitude / building-line /
  // right-of-way claim carried by a qualified matched source. A generic title
  // condition, a stored diagram or deed, or a matched parent General Plan is
  // never clearance and never turns this category green.
  const servitudeClaims = supported([
    ...claimsFor(pack, "deeds", SERVITUDE_DEED_KEYS),
    ...claimsFor(pack, "planning", SERVITUDE_PLANNING_KEYS),
  ]);
  const servitudeSubjectClaims = subjectFactClaims(servitudeClaims);
  const servitudeQualified =
    servitudeSubjectClaims.length > 0 &&
    (hasQualifiedSupport(pack, servitudeSubjectClaims, ["official", "municipal"]) ||
      hasMatchedPaidDocumentSupport(pack, servitudeSubjectClaims));
  const sgSources = pack.sources.filter(
    (source) => source.asset?.category === "sg_diagram" || source.asset?.category === "title_deed",
  );
  const sgStatus: ReportFindingStatus = servitudeQualified
    ? "supported"
    : servitudeClaims.length || parentLineageGaps.length || sgSources.length || deedClaims.length
      ? "not_checked"
      : "missing";
  add({
    id: "finding-servitudes-sg",
    category: "legal",
    status: sgStatus,
    severity: servitudeQualified ? "information" : "medium",
    headline: servitudeQualified
      ? "Servitude and building-line conditions read for this erf"
      : servitudeClaims.length
        ? "Servitude wording found, but not from a qualified matched source"
        : parentLineageGaps.length
          ? "Only parent General Plan context is available for servitudes"
          : sgSources.length
            ? "Diagram or deed uploaded, servitude conditions not read yet"
            : "No servitude or building-line evidence",
    whatWeFound: servitudeClaims.length
      ? servitudeClaims.map((claim) => `${claim.label}: ${claim.value}`).join(" · ")
      : parentLineageGaps.length
        ? "A parent General Plan is attached as context. It does not state this erf's servitudes."
        : sgSources.length
          ? `${sgSources.length} diagram/deed file(s) are stored, but no servitude or building-line value has been read from them.`
          : "No SG diagram, general plan or deed condition has been read for this erf.",
    whatItMeans:
      "Servitudes and building lines can only be cleared from this erf's own diagram and title conditions. A stored file, a generic title condition, or a matched parent General Plan is not clearance.",
    confidence: servitudeClaims.length ? weakestConfidence(servitudeClaims) : "unverified",
    claimIds: servitudeClaims.map((claim) => claim.id),
    sourceIds: uniq([...sourceIdsOf(servitudeClaims), ...sgSources.map((source) => source.id)]),
    gapIds: parentLineageGaps.map((gap) => gap.id),
  });

  // 8c. Buildings & plans ---------------------------------------------------
  // Deliberately independent of Site Potential: an AI concept is not building
  // plan evidence and may never make this category positive. Positive requires
  // qualified official/municipal approved-plan or occupancy evidence scoped to
  // this parcel, with no unresolved building-plan gap or contradiction.
  const buildingClaims = supported(claimsFor(pack, "planning", BUILDING_CLAIM_KEYS));
  const buildingPlanSources = pack.sources.filter(
    (source) => source.asset?.category === "architectural_plan",
  );
  const buildingGaps = pack.gaps.filter(
    (gap) => gap.domain === "planning" && /building plan|occupancy|approved plan/i.test(gap.title),
  );
  const buildingContradictions = pack.contradictions.filter((item) =>
    /building plan|occupancy|approved plan|structure/i.test(item.title),
  );
  const buildingSubjectClaims = subjectFactClaims(buildingClaims);
  const buildingQualified =
    buildingSubjectClaims.length > 0 &&
    buildingGaps.length === 0 &&
    buildingContradictions.length === 0 &&
    (hasQualifiedSupport(pack, buildingSubjectClaims, ["official", "municipal"]) ||
      hasMatchedOfficialDocumentSupport(pack, buildingSubjectClaims));
  add({
    id: "finding-buildings-plans",
    category: "buildings",
    status: buildingQualified
      ? "supported"
      : buildingClaims.length || buildingPlanSources.length
        ? "not_checked"
        : "missing",
    severity: buildingQualified ? "information" : "medium",
    headline: buildingQualified
      ? "Approved building information recorded"
      : buildingClaims.length
        ? "Building information found, but not from a qualified municipal source"
        : buildingPlanSources.length
          ? "Building plans uploaded but not read as evidence yet"
          : "No approved building plan evidence",
    whatWeFound: buildingClaims.length
      ? buildingClaims.map((claim) => `${claim.label}: ${claim.value}`).join(" · ")
      : buildingPlanSources.length
        ? `${buildingPlanSources.length} plan file(s) are stored, but no approved-plan value has been read from them.`
        : "No approved building plan, occupancy certificate or recorded structure exists for this erf.",
    whatItMeans:
      "Whether existing structures are approved can only be answered from municipal building plan records. Uploaded architectural plans, user notes and AI site concepts are not evidence of approved buildings.",
    confidence: buildingClaims.length ? weakestConfidence(buildingClaims) : "unverified",
    claimIds: buildingClaims.map((claim) => claim.id),
    sourceIds: uniq([...sourceIdsOf(buildingClaims), ...buildingPlanSources.map((s) => s.id)]),
    gapIds: buildingGaps.map((gap) => gap.id),
    contradictionIds: buildingContradictions.map((item) => item.id),

  });

  // 9. Zoning / planning completeness --------------------------------------
  // Canonical domain state + source quality decide this, never a claim count.
  const planningClaims = supported(claimsFor(pack, "planning", PLANNING_CONTROL_KEYS));
  const planningGaps = pack.gaps.filter((gap) => gap.domain === "planning");
  const planningState = domainState(pack, "planning");
  const planningQualified =
    planningState === "supported" &&
    planningGaps.length === 0 &&
    distinctKeyCount(planningClaims) > 0 &&
    hasQualifiedSupport(pack, planningClaims, ["official", "municipal"]);
  const planningStatus: ReportFindingStatus =
    planningState === "conflicting"
      ? "conflicting"
      : planningQualified
        ? "supported"
        : planningClaims.length
          ? "not_checked"
          : "missing";
  add({
    id: "finding-planning-completeness",
    category: "planning",
    status: planningStatus,
    severity: planningQualified ? "information" : planningClaims.length ? "medium" : "high",
    headline: planningClaims.length
      ? `${distinctKeyCount(planningClaims)} planning control(s) recorded`
      : "No planning controls recorded",
    whatWeFound: planningClaims.length
      ? planningClaims.map((claim) => `${claim.label}: ${claim.value}`).join(" · ")
      : "No zoning, coverage, FAR or height value exists for this erf.",
    whatItMeans:
      "What may legally be built cannot be established until the municipal zoning certificate and scheme controls are confirmed. Repeating the same source does not strengthen this.",
    confidence: planningClaims.length ? weakestConfidence(planningClaims) : "unverified",
    claimIds: planningClaims.map((claim) => claim.id),
    sourceIds: sourceIdsOf(planningClaims),
    gapIds: planningGaps.map((gap) => gap.id),
  });

  // 10. Market evidence strength -------------------------------------------
  // Duplicate saves of the same listing collapse, and asking prices are never
  // a valuation, so market can only reach "supported" on canonical state.
  const marketSourcesAll = pack.sources.filter((source) => source.kind === "market_listing");
  const marketSources = distinctSources(marketSourcesAll);
  const marketClaims = supported(claimsFor(pack, "market"));
  const marketGaps = pack.gaps.filter((gap) => gap.domain === "market");
  const marketState = domainState(pack, "market");
  const marketQualified =
    marketState === "supported" &&
    marketGaps.length === 0 &&
    marketClaims.length > 0 &&
    marketSources.length > 1 &&
    hasQualifiedSupport(pack, marketClaims, ["market", "paid_provider", "official", "municipal"]);
  const marketStatus: ReportFindingStatus =
    marketState === "conflicting"
      ? "conflicting"
      : marketQualified
        ? "supported"
        : marketSourcesAll.length
          ? "not_checked"
          : "missing";
  add({
    id: "finding-market-strength",
    category: "market",
    status: marketStatus,
    severity: marketQualified ? "information" : "medium",
    headline: marketSources.length
      ? `${marketSources.length} distinct market evidence item(s)`
      : "No market evidence saved",
    whatWeFound: marketSources.length
      ? marketSources.map((source) => source.label).slice(0, 4).join(" · ")
      : "No listing or comparable has been saved against this erf.",
    whatItMeans:
      "Asking prices are not sold prices. Saved listings indicate the asking market only and are never a formal valuation.",
    confidence: marketQualified ? "low" : "unverified",
    claimIds: marketClaims.map((claim) => claim.id),
    sourceIds: marketSourcesAll.map((source) => source.id),
    gapIds: marketGaps.map((gap) => gap.id),
  });


  // 11. Selected strategy ---------------------------------------------------
  const strategyClaims = claimsFor(pack, "strategy").filter((claim) => claim.status !== "missing");
  const strategyGaps = pack.gaps.filter((gap) => gap.domain === "strategy");
  add({
    id: "finding-strategy",
    category: "strategy",
    status: strategyClaims.length ? "not_checked" : "missing",
    severity: "low",
    headline: strategyClaims.length ? "Strategy assumptions saved" : "No strategy scenario saved",
    whatWeFound: strategyClaims.length
      ? strategyClaims.slice(0, 4).map((claim) => `${claim.label}: ${claim.value}`).join(" · ")
      : "No Strategy Lab scenario has been saved for this erf.",
    whatItMeans:
      "Strategy figures are your own assumptions and calculations. They are not valuations, quotes or feasibility approvals.",
    confidence: "unverified",
    claimIds: strategyClaims.map((claim) => claim.id),
    sourceIds: sourceIdsOf(strategyClaims),
    gapIds: strategyGaps.map((gap) => gap.id),
  });

  // 12. Site Potential ------------------------------------------------------
  const siteClaims = claimsFor(pack, "site").filter((claim) => claim.status !== "missing");
  const siteGaps = pack.gaps.filter((gap) => gap.domain === "site");
  add({
    id: "finding-site-potential",
    category: "buildings",
    status: siteClaims.length ? "not_checked" : "missing",
    severity: "low",
    headline: siteClaims.length ? "Site Potential concepts generated" : "No Site Potential concept generated",
    whatWeFound: siteClaims.length
      ? siteClaims.slice(0, 3).map((claim) => claim.label).join(" · ")
      : "No AI site concept has been generated or selected for this erf.",
    whatItMeans:
      "Site Potential output is an AI concept visualisation. It is not an architectural plan, approval or proof of buildability.",
    confidence: "unverified",
    claimIds: siteClaims.map((claim) => claim.id),
    sourceIds: sourceIdsOf(siteClaims),
    gapIds: siteGaps.map((gap) => gap.id),
  });

  // 13. Documents / evidence completeness -----------------------------------
  const documentSources = pack.sources.filter(
    (source) => source.kind === "uploaded_document" || source.kind === "uploaded_image",
  );
  const documentGaps = pack.gaps.filter((gap) => gap.domain === "documents");
  add({
    id: "finding-documents-completeness",
    category: "legal",
    status: documentSources.length ? "not_checked" : "missing",
    severity: documentSources.length ? "low" : "medium",
    headline: documentSources.length
      ? `${documentSources.length} document(s) in the Erf File Vault`
      : "No documents uploaded",
    whatWeFound: documentSources.length
      ? documentSources.slice(0, 4).map((source) => source.fileName ?? source.label).join(" · ")
      : "No SG diagram, deed or paid report has been uploaded for this erf.",
    whatItMeans:
      "Only documents that are readable and matched to this erf become evidence. Storage alone does not verify anything.",
    confidence: "unverified",
    claimIds: [],
    sourceIds: documentSources.map((source) => source.id),
    gapIds: documentGaps.map((gap) => gap.id),
  });

  return findings;
}

function severityRank(input: { blocking: boolean; importance: "low" | "medium" | "high" }): number {
  if (input.blocking && input.importance === "high") return 0;
  if (input.importance === "high") return 1;
  if (input.importance === "medium") return 2;
  return 3;
}

/** Which professional resolves a contradiction, when that is unambiguous. */
function professionalForContradiction(contradiction: EvidenceContradiction): string | undefined {
  if (contradiction.id === "official-area-vs-registered-extent") {
    return "Land surveyor or conveyancer";
  }
  if (/deed|owner|transfer|bond/i.test(contradiction.title)) return "Conveyancer";
  return undefined;
}

function professionalFor(domain: EvidenceDomain): string | undefined {
  switch (domain) {
    case "ownership":
    case "deeds":
    case "transfers":
      return "Conveyancer";
    case "planning":
      return "Town planner";
    case "environment":
      return "Environmental consultant";
    case "documents":
      return "Land surveyor";
    default:
      return undefined;
  }
}

function completionCriteriaFor(item: { title: string; nextAction: string }): string {
  return `Resolved when: ${item.nextAction.replace(/\.$/, "")}, and the result is saved against this erf.`;
}

/**
 * Actions are derived from canonical gaps and contradictions only. Ordering is
 * deterministic: blocking high, high, medium, low, then a stable id tiebreak.
 */
export function buildReportActions(
  pack: PropertyEvidencePack,
  findings: ReportFinding[] = [],
): ReportAction[] {
  type Seed = {
    key: string;
    rank: number;
    title: string;
    reason: string;
    completionCriteria: string;
    targetTab: string;
    professionalType?: string;
    gapIds: string[];
    contradictionIds: string[];
  };

  const seeds: Seed[] = [];
  for (const contradiction of pack.contradictions as EvidenceContradiction[]) {
    seeds.push({
      key: `action-${contradiction.id}`,
      rank: severityRank({ blocking: contradiction.severity === "high", importance: contradiction.severity }),
      title: contradiction.nextAction,
      reason: contradiction.explanation,
      completionCriteria: completionCriteriaFor({ title: contradiction.title, nextAction: contradiction.nextAction }),
      targetTab: contradiction.targetTab ?? "research",
      professionalType: professionalForContradiction(contradiction),

      gapIds: [],
      contradictionIds: [contradiction.id],
    });
  }
  for (const gap of pack.gaps as EvidenceGap[]) {
    seeds.push({
      key: `action-${gap.id}`,
      rank: severityRank({ blocking: gap.blocking, importance: gap.importance }),
      title: gap.nextAction,
      reason: gap.explanation,
      completionCriteria: completionCriteriaFor(gap),
      targetTab: gap.targetTab ?? "research",
      professionalType: professionalFor(gap.domain),
      gapIds: [gap.id],
      contradictionIds: [],
    });
  }

  seeds.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.key.localeCompare(b.key)));

  return seeds.map((seed, index) => ({
    id: seed.key,
    parcelId: pack.parcelId,
    priority: index + 1,
    title: seed.title,
    reason: seed.reason,
    completionCriteria: seed.completionCriteria,
    status: "open" as const,
    targetTab: seed.targetTab,
    professionalType: seed.professionalType,
    findingIds: findings
      .filter(
        (finding) =>
          finding.gapIds.some((id) => seed.gapIds.includes(id)) ||
          finding.contradictionIds.some((id) => seed.contradictionIds.includes(id)),
      )
      .map((finding) => finding.id),
    gapIds: seed.gapIds,
    contradictionIds: seed.contradictionIds,
  }));
}

/** Links actions back onto their findings without mutating the inputs. */
export function linkFindingActions(findings: ReportFinding[], actions: ReportAction[]): ReportFinding[] {
  return findings.map((finding) => ({
    ...finding,
    actionIds: actions
      .filter(
        (action) =>
          action.gapIds.some((id) => finding.gapIds.includes(id)) ||
          action.contradictionIds.some((id) => finding.contradictionIds.includes(id)),
      )
      .map((action) => action.id),
  }));
}

export function nextBestAction(actions: ReportAction[]): ReportAction | null {
  return actions.find((action) => action.status === "open" || action.status === "in_progress") ?? null;
}
