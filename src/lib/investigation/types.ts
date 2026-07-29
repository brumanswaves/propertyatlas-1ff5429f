/**
 * Investigation model for the selected-erf experience.
 *
 * Everything in this module is deterministic and derived from state Easy Erf
 * has actually recorded. No AI call, no network call, no fabricated fact.
 */

export type InvestigationStageId =
  | "identify"
  | "planning"
  | "constraints"
  | "site_potential"
  | "market"
  | "strategy"
  | "report";

export type InvestigationStageStatus =
  | "complete"
  | "in_progress"
  | "waiting"
  | "blocked"
  | "unavailable";

export type InvestigationTab =
  | "investigation"
  | "research"
  | "zoning-build"
  | "site-potential"
  | "listings"
  | "reports"
  | "notes"
  | "calculators"
  | "stoep-report"
  | "local-services";

export type InvestigationConfidence = "verified" | "supported" | "indicative" | "unconfirmed";

export interface InvestigationStage {
  id: InvestigationStageId;
  label: string;
  status: InvestigationStageStatus;
  summary: string;
  evidenceCount: number;
  confidence: InvestigationConfidence;
  targetTab: InvestigationTab;
}

export type InvestigationFindingStatus =
  | "verified"
  | "supported"
  | "estimated"
  | "user_supplied"
  | "missing"
  | "conflicting";

export interface InvestigationFinding {
  id: string;
  stageId: InvestigationStageId;
  title: string;
  body: string;
  status: InvestigationFindingStatus;
  sourceLabel: string;
  targetTab?: InvestigationTab;
}

export type GuidedEvidenceTaskStatus = "ready" | "completed" | "skipped" | "blocked";

export interface GuidedEvidenceTask {
  id: string;
  stageId: InvestigationStageId;
  title: string;
  shortExplanation: string;
  whyItMatters: string;
  improves: string[];
  estimatedMinutes: number;
  status: GuidedEvidenceTaskStatus;
  primaryActionLabel: string;
  targetTab: InvestigationTab;
  targetAnchorId?: string;
  sourceUrl?: string;
  steps: string[];
  afterCompletion: string;
  canSkip: boolean;
  confidenceBefore: InvestigationConfidence;
  confidenceAfterLabel: string;
  limitations?: string;
}

export type InvestigationOverallStatus =
  | "starting"
  | "underway"
  | "waiting_on_evidence"
  | "ready_for_report";

export interface PropertyInvestigation {
  parcelId: string;
  startedAt: string;
  headline: string;
  identitySummary: string;
  overallStatus: InvestigationOverallStatus;
  overallProgressPercent: number;
  stages: InvestigationStage[];
  latestFindings: InvestigationFinding[];
  nextTask: GuidedEvidenceTask | null;
  assistantMessages: string[];
  reportReady: boolean;
}
