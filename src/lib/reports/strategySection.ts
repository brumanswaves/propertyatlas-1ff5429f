/**
 * Strategy & Financials report section model.
 *
 * Read-only projection of the saved Strategy workspace. It never recalculates
 * anything: values are taken verbatim from the saved scenario so the report and
 * Strategy Lab can never disagree. Every row declares what type of figure it is.
 */
import type { ErfStrategyScenario } from "@/lib/workbench/erfWorkspaceState";

export type StrategyFigureKind =
  | "evidence_input"
  | "user_assumption"
  | "calculation"
  | "ai_interpretation";

export const STRATEGY_FIGURE_LABEL: Record<StrategyFigureKind, string> = {
  evidence_input: "Evidence input",
  user_assumption: "User assumption",
  calculation: "Deterministic calculation",
  ai_interpretation: "AI interpretation",
};

export interface StrategyFigure {
  id: string;
  label: string;
  value: string;
  kind: StrategyFigureKind;
}

export interface StrategySectionModel {
  hasScenario: boolean;
  strategyName: string | null;
  scenarioCount: number;
  savedStatus: string;
  /** Acquisition price as saved in the scenario inputs. */
  acquisition: StrategyFigure | null;
  /** Maximum justified purchase price, only when the calculator produced one. */
  maximumJustifiedPrice: StrategyFigure | null;
  /** Decision-useful headline outputs (max 4). */
  headline: StrategyFigure[];
  /** Remaining saved assumptions, shown behind an expander. */
  assumptions: StrategyFigure[];
  /** Remaining calculated outputs, shown behind an expander. */
  detail: StrategyFigure[];
  emptyMessage: string | null;
}

const ACQUISITION_KEYS = ["purchasePrice", "landPrice", "acquisitionPrice", "offerPrice"];

const MAX_PRICE_PATTERN = /max(imum)?\s+(justified\s+)?(offer|purchase|bid|price)/i;

function humanizeKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function isMoneyish(key: string) {
  return /price|cost|amount|value|rent|fee|deposit|loan/i.test(key);
}

function formatInputValue(key: string, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Not set";
  const numeric = Number(trimmed.replace(/[^0-9.-]/g, ""));
  if (isMoneyish(key) && Number.isFinite(numeric) && numeric > 0) {
    return `R ${Math.round(numeric).toLocaleString("en-ZA")}`;
  }
  return trimmed;
}

export function buildStrategySectionModel(input: {
  chosen: ErfStrategyScenario | null;
  scenarioCount: number;
}): StrategySectionModel {
  const { chosen, scenarioCount } = input;

  if (!chosen) {
    return {
      hasScenario: false,
      strategyName: null,
      scenarioCount,
      savedStatus:
        scenarioCount > 0
          ? `${scenarioCount} saved scenario${scenarioCount === 1 ? "" : "s"} — none chosen for this report`
          : "No scenario saved",
      acquisition: null,
      maximumJustifiedPrice: null,
      headline: [],
      assumptions: [],
      detail: [],
      emptyMessage:
        "No strategy scenario has been chosen for this report. Open Strategy Lab to test purchase, build, flip and hold assumptions, then choose a scenario.",
    };
  }

  const summary = chosen.summary ?? [];
  const outputs: StrategyFigure[] = summary.map((item, index) => ({
    id: `output-${index}-${item.label}`,
    label: item.label,
    value: item.value,
    kind: MAX_PRICE_PATTERN.test(item.label) ? "calculation" : "calculation",
  }));

  const maximumJustifiedPrice =
    outputs.find((item) => MAX_PRICE_PATTERN.test(item.label)) ?? null;

  const inputs = Object.entries(chosen.inputs ?? {});
  const acquisitionEntry = ACQUISITION_KEYS.map((key) =>
    inputs.find(([entryKey]) => entryKey === key),
  ).find((entry) => entry && entry[1]?.trim());

  const acquisition: StrategyFigure | null = acquisitionEntry
    ? {
        id: `acquisition-${acquisitionEntry[0]}`,
        label: humanizeKey(acquisitionEntry[0]),
        value: formatInputValue(acquisitionEntry[0], acquisitionEntry[1]),
        kind: "user_assumption",
      }
    : null;

  const assumptions: StrategyFigure[] = inputs
    .filter(([key, value]) => value?.trim() && key !== acquisitionEntry?.[0])
    .map(([key, value]) => ({
      id: `assumption-${key}`,
      label: humanizeKey(key),
      value: formatInputValue(key, value),
      kind: "user_assumption" as const,
    }));

  const headline = outputs
    .filter((item) => item.id !== maximumJustifiedPrice?.id)
    .slice(0, 4);
  const detail = outputs.filter(
    (item) => item.id !== maximumJustifiedPrice?.id && !headline.includes(item),
  );

  return {
    hasScenario: true,
    strategyName: chosen.label,
    scenarioCount,
    savedStatus: chosen.selected
      ? "Chosen scenario for this erf"
      : "Most recently saved scenario (no scenario explicitly chosen)",
    acquisition,
    maximumJustifiedPrice,
    headline,
    assumptions,
    detail,
    emptyMessage: null,
  };
}
