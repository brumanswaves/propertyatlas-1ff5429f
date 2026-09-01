export type HumanReviewReportContent = {
  bottomLine: string;
  known: string[];
  potential: string[];
  risks: string[];
  unknowns: string[];
  nextSteps: string[];
};

export const EMPTY_HUMAN_REVIEW_REPORT_CONTENT: HumanReviewReportContent = {
  bottomLine: "",
  known: [],
  potential: [],
  risks: [],
  unknowns: [],
  nextSteps: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown, max = 1400) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 700))
    .filter(Boolean)
    .slice(0, 8);
}

export function parseHumanReviewReportContent(value: unknown): HumanReviewReportContent | null {
  if (!isRecord(value)) return null;
  const content: HumanReviewReportContent = {
    bottomLine: cleanText(value.bottomLine),
    known: cleanList(value.known),
    potential: cleanList(value.potential),
    risks: cleanList(value.risks),
    unknowns: cleanList(value.unknowns),
    nextSteps: cleanList(value.nextSteps),
  };
  if (
    !content.bottomLine &&
    !content.known.length &&
    !content.potential.length &&
    !content.risks.length &&
    !content.unknowns.length &&
    !content.nextSteps.length
  ) {
    return null;
  }
  return content;
}
