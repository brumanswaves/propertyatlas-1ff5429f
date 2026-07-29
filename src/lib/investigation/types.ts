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
  /** External public source the user can open for this task, when one exists. */
  sourceUrl?: string;
  sourceLabel?: string;
  /** Extra public sources (for example Property24 and Private Property). */
  extraSources?: Array<{ label: string; url: string }>;
  /** Deterministic copy-and-send template, for example a plans request. */
  requestTemplate?: string;
  steps: string[];
  afterCompletion: string;
  canSkip: boolean;
  confidenceBefore: InvestigationConfidence;
  confidenceAfterLabel: string;
  limitations?: string;
}

/**
 * The single canonical next action. The investigation panel, the guided task
 * and the report opening must all read this same value.
 */
export interface InvestigationNextAction {
  id: string;
  label: string;
  targetTab: InvestigationTab;
  targetAnchorId?: string;
  stageId: InvestigationStageId;
}

export type InvestigationMessageKind =
  | "identified"
  | "supported"
  | "estimated"
  | "missing"
  | "conflict"
  | "reward"
  | "next_action";

export interface InvestigationMessage {
  id: string;
  kind: InvestigationMessageKind;
  text: string;
  targetTab?: InvestigationTab;
  targetAnchorId?: string;
}

export type InvestigationOverallStatus =
  | "starting"
  | "underway"
  | "waiting_on_evidence"
  | "ready_for_report";

export interface InvestigationProgress {
  percent: number;
  completedStages: number;
  totalStages: number;
  status: InvestigationOverallStatus;
}

/**
 * One step of the visible six-step investigation journey.
 *
 * The journey is a presentation grouping of the underlying stages: strategy and
 * report are shown as a single "Decision" step so the user always sees six
 * steps, never a shifting count.
 */
export interface InvestigationJourneyStep {
  id: InvestigationStageId;
  /** 1-based position in the six-step row. */
  index: number;
  label: string;
  shortLabel: string;
  status: InvestigationStageStatus;
  summary: string;
  targetTab: InvestigationTab;
  current: boolean;
}

export interface PropertyInvestigation {
  parcelId: string;
  startedAt: string;
  headline: string;
  identitySummary: string;
  overallStatus: InvestigationOverallStatus;
  overallProgressPercent: number;
  progress: InvestigationProgress;
  stages: InvestigationStage[];
  /** Always six steps, in order. */
  journey: InvestigationJourneyStep[];
  /** 1-based index of the step the user is on right now. */
  currentStepIndex: number;
  totalSteps: number;
  latestFindings: InvestigationFinding[];
  nextTask: GuidedEvidenceTask | null;
  nextAction: InvestigationNextAction | null;
  messages: InvestigationMessage[];
  reportReady: boolean;
}

