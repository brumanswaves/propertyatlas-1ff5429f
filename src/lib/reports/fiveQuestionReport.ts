import type { EasyErfReportDocument } from "@/lib/reports/composeEasyErfReport";

export type FiveQuestionReportContent = {
  known: string[];
  potential: string[];
  risks: string[];
  unknowns: string[];
  nextSteps: string[];
};

function unique(items: Array<string | null | undefined>, max = 4) {
  return Array.from(new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item))))
    .slice(0, max);
}

export function buildSelfServiceFiveQuestionContent(
  doc: EasyErfReportDocument,
): FiveQuestionReportContent {
  const known = unique([
    ...doc.decisionSnapshot.positives,
    ...doc.atAGlance.slice(0, 3).map((item) => `${item.label}: ${item.value} — ${item.provenance}`),
  ]);
  const riskIssues = doc.riskStrip.filter((item) =>
    ["possible_issue", "confirmed_issue"].includes(item.status),
  );
  const unresolved = doc.riskStrip.filter((item) =>
    ["check_needed", "unknown"].includes(item.status),
  );
  const action = doc.nextBestAction;

  return {
    known: known.length
      ? known
      : ["The current investigation has not yet produced a supported property fact for this summary. Review the evidence dossier below."],
    potential: doc.decisionSnapshot.bestOpportunity
      ? [doc.decisionSnapshot.bestOpportunity]
      : ["No evidence-supported property potential is recorded yet."],
    risks: unique([
      doc.decisionSnapshot.biggestConcern,
      ...riskIssues.map((item) => `${item.label}: ${item.explanation}`),
    ]).length
      ? unique([
          doc.decisionSnapshot.biggestConcern,
          ...riskIssues.map((item) => `${item.label}: ${item.explanation}`),
        ])
      : ["No material problem is confirmed by the current recorded evidence. Outstanding checks remain under unknowns."],
    unknowns: unresolved.length
      ? unique(unresolved.map((item) => `${item.label}: ${item.explanation}`))
      : ["No unresolved item appears in the current risk strip. Verify the source evidence before relying on this report."],
    nextSteps: action
      ? unique([`${action.title}${action.reason ? ` — ${action.reason}` : ""}`])
      : ["No next verification action is currently recorded. Continue the investigation before relying on the report."],
  };
}
