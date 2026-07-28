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
  EvidenceGap,
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

function weakestConfidence(claims: EvidenceClaim[]): EvidenceConfidence {
  const order: EvidenceConfidence[] = ["unverified", "low", "medium", "high"];
  let best = -1;
  for (const claim of claims) {
    const index = order.indexOf(claim.confidence);
    if (index > best) best = index;
  }
  return best >= 0 ? order[best] : "unverified";
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
  if (officialAreaValue && deedExtentValue) {
    const delta = Math.abs(officialAreaValue - deedExtentValue);
    if (delta / Math.max(officialAreaValue, deedExtentValue) > 0.005) {
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
        claimIds: [officialArea!.id, deedExtent!.id],
        sourceIds: uniq([...officialArea!.sourceIds, ...deedExtent!.sourceIds]),
      });
    }
  }

  // 6. Ownership ------------------------------------------------------------
  const ownershipClaims = supported(claimsFor(pack, "ownership", OWNERSHIP_CLAIM_KEYS));
  const ownershipGap = gapById("ownership-not-verified");
  const paidReportSources = pack.sources.filter(
    (source) => source.asset?.category === "paid_report" || source.authorityType === "paid_provider",
  );
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

  // 9. Zoning / planning completeness --------------------------------------
  const planningClaims = supported(claimsFor(pack, "planning", PLANNING_CONTROL_KEYS));
  const planningGaps = pack.gaps.filter((gap) => gap.domain === "planning");
  add({
    id: "finding-planning-completeness",
    category: "planning",
    status: planningClaims.length >= 4 ? "supported" : planningClaims.length ? "not_checked" : "missing",
    severity: planningClaims.length >= 4 ? "information" : planningClaims.length ? "medium" : "high",
    headline: planningClaims.length
      ? `${planningClaims.length} planning control(s) recorded`
      : "No planning controls recorded",
    whatWeFound: planningClaims.length
      ? planningClaims.map((claim) => `${claim.label}: ${claim.value}`).join(" · ")
      : "No zoning, coverage, FAR or height value exists for this erf.",
    whatItMeans:
      "What may legally be built cannot be established until the municipal zoning certificate and scheme controls are confirmed.",
    confidence: planningClaims.length ? weakestConfidence(planningClaims) : "unverified",
    claimIds: planningClaims.map((claim) => claim.id),
    sourceIds: sourceIdsOf(planningClaims),
    gapIds: planningGaps.map((gap) => gap.id),
  });

  // 10. Market evidence strength -------------------------------------------
  const marketSources = pack.sources.filter((source) => source.kind === "market_listing");
  const marketClaims = supported(claimsFor(pack, "market"));
  const marketGaps = pack.gaps.filter((gap) => gap.domain === "market");
  add({
    id: "finding-market-strength",
    category: "market",
    status: marketSources.length >= 3 ? "supported" : marketSources.length ? "not_checked" : "missing",
    severity: marketSources.length >= 3 ? "information" : "medium",
    headline: marketSources.length
      ? `${marketSources.length} saved market evidence item(s)`
      : "No market evidence saved",
    whatWeFound: marketSources.length
      ? marketSources.map((source) => source.label).slice(0, 4).join(" · ")
      : "No listing or comparable has been saved against this erf.",
    whatItMeans:
      "Asking prices are not sold prices. Saved listings indicate the asking market only and are never a formal valuation.",
    confidence: marketSources.length >= 3 ? "low" : "unverified",
    claimIds: marketClaims.map((claim) => claim.id),
    sourceIds: marketSources.map((source) => source.id),
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
