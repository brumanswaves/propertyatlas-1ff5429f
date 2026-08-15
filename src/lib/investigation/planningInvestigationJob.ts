import type { PropertyEvidencePack } from "@/lib/evidence/propertyEvidenceTypes";
import type {
  ParcelPlanningAssessment,
  PlanningConfidence,
  MunicipalityPlanningSource,
} from "@/lib/planning/municipalityPlanningTypes";
import {
  EASY_ERF_AGENT_JOB_CONTRACT_VERSION,
  type EasyErfAgentJobConfidence,
  type EasyErfAgentJobContractV1,
  type EasyErfAgentJobEvidence,
  type EasyErfAgentJobStatus,
} from "./agentJobContract";

export const PLANNING_INVESTIGATION_JOB_TYPE = "planning-position-v1" as const;

export interface PlanningInvestigationPropertyInput {
  parcelId: string;
  erfNumber?: string | number | null;
  portion?: string | number | null;
  lpi?: string | null;
  parcelKey?: string | null;
  municipality?: string | null;
  province?: string | null;
  suburbOrArea?: string | null;
  town?: string | null;
}

export interface PlanningInvestigationJobInput {
  property: PlanningInvestigationPropertyInput;
  planningAssessment: ParcelPlanningAssessment;
  evidencePack?: PropertyEvidencePack | null;
}

export interface PlanningInvestigationFinding {
  id: string;
  kind: "zoning" | "published_rule" | "verified_right" | "evidence_claim";
  label: string;
  value: string;
  status: string;
  confidence: EasyErfAgentJobConfidence;
  sourceIds: string[];
}

export interface PlanningInvestigationContradiction {
  id: string;
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
  sourceIds: string[];
}

export interface PlanningInvestigationOutput {
  summary: string;
  zoning: {
    code: string | null;
    name: string | null;
    method: ParcelPlanningAssessment["detection"]["method"];
    statement: string;
  };
  findings: PlanningInvestigationFinding[];
  contradictions: PlanningInvestigationContradiction[];
  unresolvedEvidence: string[];
  sourceSummary: {
    checked: number;
    officialOrMunicipal: number;
    propertySpecificEvidence: number;
  };
  headlineWarning: string;
}

export type PlanningInvestigationJobV1 = EasyErfAgentJobContractV1<
  PlanningInvestigationPropertyInput,
  {
    planningArea: string | null;
    registryMatched: boolean;
    evidenceFingerprint: string | null;
  },
  PlanningInvestigationOutput
>;

function asJobConfidence(confidence: PlanningConfidence): EasyErfAgentJobConfidence {
  return confidence;
}

function formatRuleValue(value: number | null, unit: string | null, statement: string) {
  if (value == null) return statement;
  if (unit === "percent") return `${value}%`;
  if (unit === "m") return `${value} m`;
  if (unit === "ratio") return `${value}`;
  if (unit === "units") return `${value} unit${value === 1 ? "" : "s"}`;
  return statement;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)),
    ),
  ];
}

function sourceQuality(source: MunicipalityPlanningSource) {
  if (source.status !== "active") return "reference";
  if (source.jurisdiction === "municipal" || source.jurisdiction === "provincial") return "direct";
  return "strong";
}

function planningEvidenceFromAssessment(
  assessment: ParcelPlanningAssessment,
): EasyErfAgentJobEvidence[] {
  const ruleLabelsBySource = new Map<string, string[]>();
  for (const rule of assessment.publishedRules) {
    ruleLabelsBySource.set(rule.sourceId, [
      ...(ruleLabelsBySource.get(rule.sourceId) ?? []),
      rule.label,
    ]);
  }
  for (const guideline of assessment.guidelines) {
    ruleLabelsBySource.set(guideline.sourceId, [
      ...(ruleLabelsBySource.get(guideline.sourceId) ?? []),
      guideline.title,
    ]);
  }

  return assessment.sources.map((source) => ({
    id: source.id,
    label: source.title,
    authority: source.jurisdiction,
    quality: sourceQuality(source),
    status: source.status,
    url: source.url,
    supports: uniqueStrings(ruleLabelsBySource.get(source.id) ?? []),
  }));
}

function planningEvidenceFromPack(
  pack: PropertyEvidencePack | null | undefined,
): EasyErfAgentJobEvidence[] {
  if (!pack) return [];
  const planningClaims = pack.claims.filter(
    (claim) => claim.domain === "planning" && !claim.excluded,
  );
  const claimLabelsBySource = new Map<string, string[]>();
  for (const claim of planningClaims) {
    for (const sourceId of claim.sourceIds) {
      claimLabelsBySource.set(sourceId, [
        ...(claimLabelsBySource.get(sourceId) ?? []),
        claim.label,
      ]);
    }
  }

  return [...claimLabelsBySource.entries()].flatMap(([sourceId, labels]) => {
    const source = pack.sources.find((candidate) => candidate.id === sourceId);
    if (!source) return [];
    return [
      {
        id: source.id,
        label: source.label,
        authority: source.authorityType,
        quality: source.sourceQuality,
        status: source.status,
        url: source.url ?? null,
        supports: uniqueStrings(labels),
      },
    ];
  });
}

function mergeEvidence(...groups: EasyErfAgentJobEvidence[][]): EasyErfAgentJobEvidence[] {
  const merged = new Map<string, EasyErfAgentJobEvidence>();
  for (const evidence of groups.flat()) {
    const current = merged.get(evidence.id);
    if (!current) {
      merged.set(evidence.id, evidence);
      continue;
    }
    merged.set(evidence.id, {
      ...current,
      supports: uniqueStrings([...current.supports, ...evidence.supports]),
      url: current.url ?? evidence.url,
    });
  }
  return [...merged.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function buildFindings(
  assessment: ParcelPlanningAssessment,
  pack: PropertyEvidencePack | null | undefined,
): PlanningInvestigationFinding[] {
  const findings: PlanningInvestigationFinding[] = [];
  if (assessment.detection.zoneCode || assessment.detection.zoneName) {
    findings.push({
      id: "planning-zoning",
      kind: "zoning",
      label: "Working zoning",
      value: [assessment.detection.zoneCode, assessment.detection.zoneName]
        .filter(Boolean)
        .join(" · "),
      status: assessment.detection.method,
      confidence: asJobConfidence(assessment.detection.confidence),
      sourceIds: assessment.detection.supportingAssetId
        ? [assessment.detection.supportingAssetId]
        : [],
    });
  }

  for (const rule of assessment.publishedRules) {
    findings.push({
      id: `rule-${rule.id}`,
      kind: "published_rule",
      label: rule.label,
      value: formatRuleValue(rule.value, rule.unit, rule.statement),
      status: "published_general_rule",
      confidence: rule.status === "active" ? "medium" : "low",
      sourceIds: [rule.sourceId],
    });
  }

  for (const right of assessment.verifiedRights) {
    findings.push({
      id: `right-${right.id}`,
      kind: "verified_right",
      label: right.label,
      value: right.value,
      status: "property_specific_evidence",
      confidence: "medium",
      sourceIds: right.assetId ? [right.assetId] : [],
    });
  }

  if (pack) {
    const existingLabels = new Set(findings.map((finding) => finding.label.toLowerCase()));
    for (const claim of pack.claims.filter(
      (candidate) =>
        candidate.domain === "planning" &&
        !candidate.excluded &&
        candidate.value != null &&
        candidate.status !== "missing",
    )) {
      if (existingLabels.has(claim.label.toLowerCase())) continue;
      findings.push({
        id: `claim-${claim.id}`,
        kind: "evidence_claim",
        label: claim.label,
        value: String(claim.value),
        status: claim.status,
        confidence: claim.confidence === "unverified" ? "unverified" : claim.confidence,
        sourceIds: claim.sourceIds,
      });
    }
  }

  return findings;
}

function buildContradictions(
  assessment: ParcelPlanningAssessment,
  pack: PropertyEvidencePack | null | undefined,
): PlanningInvestigationContradiction[] {
  const contradictions: PlanningInvestigationContradiction[] = [];
  const planningClaimIds = new Set(
    pack?.claims.filter((claim) => claim.domain === "planning").map((claim) => claim.id) ?? [],
  );

  for (const contradiction of pack?.contradictions ?? []) {
    if (
      contradiction.targetTab !== "zoning-build" &&
      !contradiction.claimIds.some((claimId) => planningClaimIds.has(claimId))
    ) {
      continue;
    }
    contradictions.push({
      id: contradiction.id,
      title: contradiction.title,
      detail: contradiction.explanation,
      severity: contradiction.severity,
      sourceIds: contradiction.sourceIds,
    });
  }

  for (const checklist of assessment.checklist.filter((item) => item.status === "conflict")) {
    if (contradictions.some((item) => item.id === checklist.id)) continue;
    contradictions.push({
      id: checklist.id,
      title: checklist.label,
      detail: checklist.detail,
      severity: "high",
      sourceIds: [],
    });
  }

  return contradictions;
}

function overallConfidence(
  assessment: ParcelPlanningAssessment,
  contradictions: PlanningInvestigationContradiction[],
): EasyErfAgentJobConfidence {
  if (contradictions.length) return "low";
  return asJobConfidence(assessment.detection.confidence);
}

function propertyLabel(property: PlanningInvestigationPropertyInput) {
  const parts = [
    property.erfNumber != null ? `Erf ${property.erfNumber}` : null,
    property.portion != null ? `Portion ${property.portion}` : null,
    property.suburbOrArea,
    property.municipality,
  ];
  return uniqueStrings(parts).join(", ") || property.parcelId;
}

export function buildPlanningInvestigationJob(
  input: PlanningInvestigationJobInput,
): PlanningInvestigationJobV1 {
  const { property, planningAssessment: assessment, evidencePack = null } = input;
  const findings = buildFindings(assessment, evidencePack);
  const contradictions = buildContradictions(assessment, evidencePack);
  const planningGaps = evidencePack?.gaps.filter((gap) => gap.domain === "planning") ?? [];
  const unresolvedEvidence = uniqueStrings([
    ...assessment.missingEvidence,
    ...planningGaps.map((gap) => gap.title),
  ]);
  const evidence = mergeEvidence(
    planningEvidenceFromAssessment(assessment),
    planningEvidenceFromPack(evidencePack),
  );
  const propertySpecificEvidence = evidence.filter(
    (item) => item.authority === "user_supplied" || item.id.startsWith("asset-"),
  ).length;
  const approvalRequired =
    assessment.detection.method === "manual_selection" &&
    Boolean(assessment.detection.zoneCode) &&
    assessment.userConfirmedZoneCode !== assessment.detection.zoneCode;
  const confidence = overallConfidence(assessment, contradictions);
  const noInvestigationMaterial =
    !assessment.registryMatched && evidence.length === 0 && findings.length === 0;
  const status: EasyErfAgentJobStatus = noInvestigationMaterial
    ? "blocked"
    : approvalRequired || contradictions.length > 0 || unresolvedEvidence.length > 0
      ? "needs_review"
      : "completed";
  const nextAction = assessment.actions.find((action) => !action.completed) ?? null;
  const nextGap = planningGaps.find((gap) => gap.blocking) ?? planningGaps[0] ?? null;
  const nextJob = nextAction
    ? {
        id: nextAction.id,
        title: nextAction.title,
        reason: nextAction.detail,
        targetTab: nextAction.actionTab,
      }
    : nextGap
      ? {
          id: `resolve-${nextGap.id}`,
          title: nextGap.nextAction,
          reason: nextGap.explanation,
          targetTab: nextGap.targetTab ?? null,
        }
      : null;

  const summary = assessment.detection.zoneCode
    ? `${propertyLabel(property)} has a ${assessment.detection.method.replaceAll("_", " ")} planning position for ${assessment.detection.zoneCode}. Easy Erf checked ${evidence.length} planning source${evidence.length === 1 ? "" : "s"}, found ${findings.length} planning finding${findings.length === 1 ? "" : "s"}, and kept ${unresolvedEvidence.length} unresolved evidence item${unresolvedEvidence.length === 1 ? "" : "s"} visible.`
    : `${propertyLabel(property)} does not yet have a defensible working zoning. Easy Erf checked the planning material currently available, preserved the gaps, and did not promote a scheme rule or assumption into a property right.`;

  return {
    contractVersion: EASY_ERF_AGENT_JOB_CONTRACT_VERSION,
    jobType: PLANNING_INVESTIGATION_JOB_TYPE,
    jobId: `${PLANNING_INVESTIGATION_JOB_TYPE}:${property.parcelId}`,
    status,
    goal: "Investigate this property's planning position.",
    inputs: property,
    context: {
      planningArea: assessment.planningArea,
      registryMatched: assessment.registryMatched,
      evidenceFingerprint: evidencePack?.fingerprint ?? null,
    },
    tools: [
      {
        id: "canonical-property-state",
        label: "Canonical Easy Erf property state",
        kind: "canonical_state",
        detail:
          "Uses the already-selected parcel and official identifiers instead of creating a second property record.",
      },
      {
        id: "planning-assessment-engine",
        label: "Planning assessment engine",
        kind: "deterministic_engine",
        detail:
          "Applies the reviewed municipality registry, zoning detection state, rules, restrictions, checklist and risk logic.",
      },
      {
        id: "property-evidence-graph",
        label: "Property evidence graph",
        kind: "evidence_graph",
        detail:
          "Reads source-linked planning claims, contradictions and unresolved evidence already attached to this parcel.",
      },
      ...assessment.sources.slice(0, 8).map((source) => ({
        id: `source-${source.id}`,
        label: source.title,
        kind:
          source.jurisdiction === "municipal"
            ? ("municipal_source" as const)
            : ("official_source" as const),
        detail: `${source.status} ${source.sourceType.replaceAll("_", " ")} source for ${source.municipality}.`,
      })),
    ],
    process: [
      {
        id: "confirm-canonical-identity",
        label: "Use canonical property identity",
        status: property.parcelId ? "completed" : "blocked",
        detail: propertyLabel(property),
      },
      {
        id: "inspect-existing-planning-state",
        label: "Inspect existing Easy Erf planning state",
        status: "completed",
        detail: assessment.registryMatched
          ? `Matched the reviewed planning registry${assessment.planningArea ? ` for ${assessment.planningArea}` : ""}.`
          : "No reviewed municipality planning registry matched this parcel.",
      },
      {
        id: "inspect-evidence-graph",
        label: "Inspect existing evidence",
        status: evidencePack ? "completed" : "skipped",
        detail: evidencePack
          ? `Reviewed the planning claims, source links, contradictions and gaps in evidence pack ${evidencePack.fingerprint}.`
          : "No property evidence pack was supplied to this run.",
      },
      {
        id: "inspect-configured-sources",
        label: "Inspect configured public and municipal sources",
        status: assessment.sources.length ? "completed" : "skipped",
        detail: assessment.sources.length
          ? `Classified ${assessment.sources.length} configured planning source${assessment.sources.length === 1 ? "" : "s"} by jurisdiction and publication status.`
          : "No configured planning sources were available for this municipality.",
      },
      {
        id: "extract-published-rules",
        label: "Extract applicable published rules",
        status: assessment.publishedRules.length ? "completed" : "skipped",
        detail: assessment.publishedRules.length
          ? `Retained ${assessment.publishedRules.length} published rule${assessment.publishedRules.length === 1 ? "" : "s"} as general scheme rules, not parcel-specific rights.`
          : "No published zone rules were applied because no supported zone was available.",
      },
      {
        id: "correlate-property",
        label: "Correlate planning evidence to the property",
        status: assessment.detection.method === "not_detected" ? "blocked" : "completed",
        detail: assessment.detection.statement,
      },
      {
        id: "detect-contradictions",
        label: "Detect contradictions",
        status: "completed",
        detail: contradictions.length
          ? `Found ${contradictions.length} planning contradiction${contradictions.length === 1 ? "" : "s"} that require resolution.`
          : "No planning contradiction is currently recorded in the canonical evidence.",
      },
      {
        id: "assign-confidence",
        label: "Assign confidence",
        status: "completed",
        detail: `Planning confidence is ${confidence}. Missing evidence remains explicit rather than being filled by assumption.`,
      },
      {
        id: "propagate-shared-result",
        label: "Propagate the shared result",
        status: "completed",
        detail:
          "The job is derived from the same canonical planning assessment and evidence graph already used by Guided Investigation, Dossier and Report, so no duplicate state write is required.",
      },
    ],
    evidence,
    confidence,
    actions: [
      {
        id: "surface-planning-result",
        label: "Surface the planning investigation result",
        status: "applied",
        detail:
          "The structured result can be rendered in Guided Investigation while Dossier and Report continue reading the same canonical planning state and evidence graph.",
      },
      {
        id: "confirm-working-zoning",
        label: "Confirm the working zoning",
        status: approvalRequired ? "withheld" : "applied",
        detail: approvalRequired
          ? "Easy Erf will not turn a manually selected zoning into a user-confirmed working conclusion without explicit user approval."
          : "No additional zoning confirmation is required by this job's current evidence state.",
      },
    ],
    approvalRules: [
      {
        id: "manual-zone-confirmation",
        required: approvalRequired,
        label: "Confirm manually selected working zoning",
        reason: approvalRequired
          ? "The selected zoning is a working conclusion, not property-specific municipal proof."
          : "The current run does not have an unconfirmed manual zoning selection awaiting approval.",
      },
    ],
    output: {
      summary,
      zoning: {
        code: assessment.detection.zoneCode,
        name: assessment.detection.zoneName,
        method: assessment.detection.method,
        statement: assessment.detection.statement,
      },
      findings,
      contradictions,
      unresolvedEvidence,
      sourceSummary: {
        checked: evidence.length,
        officialOrMunicipal: evidence.filter((item) =>
          ["official", "municipal", "national", "provincial"].includes(item.authority),
        ).length,
        propertySpecificEvidence,
      },
      headlineWarning: assessment.headlineWarning,
    },
    nextJob,
    completedAt: evidencePack?.builtAt ?? assessment.assessedAt,
  };
}
