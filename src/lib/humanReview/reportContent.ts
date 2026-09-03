import {
  DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS,
  type DoneForYouInvestigationChecklistItemId,
} from "@/lib/humanReview/scope";

export type HumanReviewReportContent = {
  bottomLine: string;
  known: string[];
  potential: string[];
  risks: string[];
  unknowns: string[];
  nextSteps: string[];
};

export const HUMAN_REVIEW_INVESTIGATION_CHECKLIST_STATUSES = [
  "pending",
  "complete",
  "blocked",
  "not_applicable",
] as const;

export type HumanReviewInvestigationChecklistStatus =
  (typeof HUMAN_REVIEW_INVESTIGATION_CHECKLIST_STATUSES)[number];

export type HumanReviewInvestigationChecklist = Record<
  DoneForYouInvestigationChecklistItemId,
  HumanReviewInvestigationChecklistStatus
>;

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

export function createPendingHumanReviewInvestigationChecklist(): HumanReviewInvestigationChecklist {
  return DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS.reduce(
    (checklist, item) => {
      checklist[item.id] = "pending";
      return checklist;
    },
    {} as HumanReviewInvestigationChecklist,
  );
}

function isChecklistStatus(value: unknown): value is HumanReviewInvestigationChecklistStatus {
  return typeof value === "string" &&
    HUMAN_REVIEW_INVESTIGATION_CHECKLIST_STATUSES.includes(
      value as HumanReviewInvestigationChecklistStatus,
    );
}

export function parseHumanReviewInvestigationChecklist(
  value: unknown,
): HumanReviewInvestigationChecklist | null {
  if (!isRecord(value) || !isRecord(value.investigationChecklist)) return null;

  const rawChecklist = value.investigationChecklist;
  const expectedIds = new Set(
    DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS.map((item) => item.id),
  );
  const actualIds = Object.keys(rawChecklist);
  if (
    actualIds.length !== expectedIds.size ||
    actualIds.some((id) => !expectedIds.has(id as DoneForYouInvestigationChecklistItemId))
  ) {
    return null;
  }

  const checklist = {} as HumanReviewInvestigationChecklist;
  for (const item of DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS) {
    const status = rawChecklist[item.id];
    if (!isChecklistStatus(status)) return null;
    checklist[item.id] = status;
  }
  return checklist;
}

export function isHumanReviewInvestigationChecklistResolved(
  checklist: HumanReviewInvestigationChecklist,
) {
  return DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS.every((item) => {
    const status = checklist[item.id];
    return status === "complete" || status === "not_applicable";
  });
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
