import type { ReportDecisionMode } from "./reportDecisionMode";

/**
 * Report composition = what the reader actually sees, per decision lens.
 *
 * The report stays one continuous web scroll. Composition only controls:
 *  - the five primary destinations in the sticky nav,
 *  - the order of the lettered section groups,
 *  - which groups open collapsed (progressive disclosure),
 *  - opening verdict copy and preferred opening metrics.
 *
 * Standard and Investor must never resolve to the same composition.
 */

export type ReportGroupId = "identity" | "planning" | "market" | "context" | "next";

export interface ReportDestination {
  id: string;
  label: string;
  anchorId: string;
}

export interface ReportComposition {
  mode: ReportDecisionMode;
  destinations: ReportDestination[];
  groupOrder: ReportGroupId[];
  /** Groups rendered inside a closed disclosure by default. */
  collapsedGroups: ReportGroupId[];
  verdictEyebrow: string;
  verdictHeading: string;
  openingIntro: string;
  /** Preferred opening metrics, most wanted first. Unsupported ones are dropped. */
  openingMetricPreference: string[];
  /** Ordered priorities used to rank the opening critical checks / actions. */
  actionPriority: string[];
  askSuggestionFocus: string[];
}

const DESTINATIONS: Record<ReportGroupId, ReportDestination> = {
  identity: { id: "identity", label: "Property & legal", anchorId: "report-group-identity" },
  planning: { id: "planning", label: "Planning & Site Potential", anchorId: "report-group-planning" },
  market: { id: "market", label: "Market & financials", anchorId: "report-group-market" },
  context: { id: "context", label: "Context", anchorId: "report-group-context" },
  next: { id: "next", label: "Risks & next actions", anchorId: "report-group-next" },
};

const SUMMARY_DESTINATION: ReportDestination = {
  id: "summary",
  label: "Summary",
  anchorId: "report-opening",
};

const STANDARD: ReportComposition = {
  mode: "standard",
  destinations: [
    SUMMARY_DESTINATION,
    DESTINATIONS.identity,
    DESTINATIONS.planning,
    DESTINATIONS.market,
    DESTINATIONS.next,
  ],
  groupOrder: ["identity", "planning", "context", "market", "next"],
  collapsedGroups: [],
  verdictEyebrow: "Buyer decision",
  verdictHeading: "What a buyer should do next on this erf",
  openingIntro:
    "This read is buyer-focused: who owns it, what is legally registered, what may be built, and what it will cost to own.",
  openingMetricPreference: [
    "askingPrice",
    "municipalValuation",
    "erfSizeM2",
    "lastTransfer",
    "zoning",
  ],
  actionPriority: [
    "ownership",
    "title",
    "sg",
    "approved_plans",
    "zoning",
    "physical_risk",
    "ownership_costs",
    "market",
    "strategy",
  ],
  askSuggestionFocus: [
    "Who owns this property?",
    "What is registered against the title?",
    "Are the buildings approved?",
    "What does it cost to own this erf?",
  ],
};

const INVESTOR: ReportComposition = {
  mode: "investor",
  destinations: [
    SUMMARY_DESTINATION,
    DESTINATIONS.market,
    DESTINATIONS.planning,
    DESTINATIONS.identity,
    DESTINATIONS.next,
  ],
  groupOrder: ["identity", "planning", "context", "market", "next"],
  collapsedGroups: [],
  verdictEyebrow: "Investor readiness",
  verdictHeading: "Is this erf ready to underwrite?",
  openingIntro:
    "This read is investor-focused: what the deal costs, what supports the exit, and which planning or evidence gaps break the underwriting.",
  openingMetricPreference: [
    "acquisitionPrice",
    "totalProjectCost",
    "projectedExitValue",
    "profit",
    "cashRequired",
    "erfSizeM2",
  ],
  actionPriority: [
    "missing_costs",
    "exit_support",
    "buildability",
    "downside_risk",
    "zoning",
    "approved_plans",
    "ownership",
    "title",
  ],
  askSuggestionFocus: [
    "What costs are missing from this deal?",
    "How well supported is the exit value?",
    "What planning risk could break this project?",
    "How much of the erf can I cover?",
  ],
};

export function buildReportComposition(mode: ReportDecisionMode): ReportComposition {
  return mode === "investor" ? INVESTOR : STANDARD;
}

export function isGroupCollapsedByDefault(
  composition: ReportComposition,
  group: ReportGroupId,
): boolean {
  return composition.collapsedGroups.includes(group);
}

/** Filters preferred opening metrics down to the ones actually supported. */
export function selectOpeningMetrics<T extends { id: string }>(
  composition: ReportComposition,
  supported: T[],
  limit = 4,
): T[] {
  const byId = new Map(supported.map((metric) => [metric.id, metric]));
  const ordered: T[] = [];
  for (const id of composition.openingMetricPreference) {
    const metric = byId.get(id);
    if (metric) {
      ordered.push(metric);
      byId.delete(id);
    }
  }
  // Never pad with placeholders: only genuinely supported metrics remain.
  for (const metric of byId.values()) ordered.push(metric);
  return ordered.slice(0, limit);
}

/** Ranks actions by the lens priority; unknown kinds keep their input order. */
export function rankByComposition<T>(
  composition: ReportComposition,
  items: T[],
  kindOf: (item: T) => string,
): T[] {
  return items
    .map((item, index) => {
      const rank = composition.actionPriority.indexOf(kindOf(item));
      return { item, index, rank: rank === -1 ? composition.actionPriority.length : rank };
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
}
