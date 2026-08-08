import type { ReportAction } from "@/lib/reports/reportFindings";
import {
  buildCanonicalNextAction,
  GUIDED_TASK_DEFINITIONS,
  type InvestigationFacts,
} from "./guidedTaskRegistry";
import {
  deriveInvestigationFacts,
  type BuildPropertyInvestigationInput,
} from "./propertyInvestigation";

/**
 * Translates the canonical investigation next action into the ReportAction
 * shape the Easy Erf Report opening renders.
 *
 * There is only one ranking engine (the guided task registry). This adapter
 * exists so the report opening and the investigation panel cannot drift.
 */
export function canonicalReportAction(input: BuildPropertyInvestigationInput): ReportAction | null {
  const facts: InvestigationFacts = deriveInvestigationFacts(input);
  const action = buildCanonicalNextAction(facts, input.skippedTaskIds ?? []);
  if (!action) return null;
  const definition = GUIDED_TASK_DEFINITIONS.find((task) => task.id === action.id);
  if (!definition) return null;

  return {
    id: `investigation-${definition.id}`,
    parcelId: input.parcel.id,
    priority: definition.priority,
    title: definition.title,
    reason: definition.whyItMatters,
    completionCriteria: definition.afterCompletion,
    status: "open",
    targetTab: definition.targetTab,
    actionLabel: definition.primaryActionLabel,
    estimatedMinutes: definition.estimatedMinutes,
    steps: [...definition.steps],
    sourceUrl: definition.sourceUrl,
    sourceLabel: definition.sourceLabel,
    extraSources: definition.extraSources?.map((source) => ({ ...source })),
    requestTemplate: definition.requestTemplate,
    limitations: definition.limitations,
    targetAnchorId: definition.targetAnchorId,
    afterCompletion: definition.afterCompletion,
    findingIds: [],
    gapIds: [],
    contradictionIds: [],
  };
}

export function canonicalActionNavigation(action: ReportAction): {
  targetTab: string;
  targetAnchorId?: string;
} {
  return {
    targetTab: action.targetTab,
    ...(action.targetAnchorId ? { targetAnchorId: action.targetAnchorId } : {}),
  };
}
