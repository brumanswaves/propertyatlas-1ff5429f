export const EASY_ERF_AGENT_JOB_CONTRACT_VERSION = "easy-erf-agent-job-v1" as const;

export type EasyErfAgentJobStatus = "completed" | "needs_review" | "blocked";
export type EasyErfAgentJobConfidence = "high" | "medium" | "low" | "unverified";
export type EasyErfAgentJobProcessStatus = "completed" | "skipped" | "blocked";
export type EasyErfAgentJobActionStatus = "applied" | "proposed" | "withheld";

export interface EasyErfAgentJobTool {
  id: string;
  label: string;
  kind: "canonical_state" | "evidence_graph" | "official_source" | "municipal_source" | "document" | "deterministic_engine" | "ai_model";
  detail: string;
}

export interface EasyErfAgentJobProcessStep {
  id: string;
  label: string;
  status: EasyErfAgentJobProcessStatus;
  detail: string;
}

export interface EasyErfAgentJobEvidence {
  id: string;
  label: string;
  authority: string;
  quality: string;
  status: string;
  url?: string | null;
  supports: string[];
}

export interface EasyErfAgentJobAction {
  id: string;
  label: string;
  status: EasyErfAgentJobActionStatus;
  detail: string;
}

export interface EasyErfAgentJobApprovalRule {
  id: string;
  required: boolean;
  label: string;
  reason: string;
}

export interface EasyErfAgentJobNextJob {
  id: string;
  title: string;
  reason: string;
  targetTab?: string | null;
}

/**
 * Shared machine-readable contract for real Easy Erf investigation jobs.
 *
 * This is deliberately a job contract, not an agent personality model. The
 * UI should normally hide this machinery and surface the completed work.
 */
export interface EasyErfAgentJobContractV1<TInputs, TContext, TOutput> {
  contractVersion: typeof EASY_ERF_AGENT_JOB_CONTRACT_VERSION;
  jobType: string;
  jobId: string;
  status: EasyErfAgentJobStatus;
  goal: string;
  inputs: TInputs;
  context: TContext;
  tools: EasyErfAgentJobTool[];
  process: EasyErfAgentJobProcessStep[];
  evidence: EasyErfAgentJobEvidence[];
  confidence: EasyErfAgentJobConfidence;
  actions: EasyErfAgentJobAction[];
  approvalRules: EasyErfAgentJobApprovalRule[];
  output: TOutput;
  nextJob: EasyErfAgentJobNextJob | null;
  completedAt: string;
}
