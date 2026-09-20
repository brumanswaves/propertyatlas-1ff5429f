import type { ReportAction, ReportFinding } from "./reportFindings";
import { customServiceGoogleMapsUrl } from "@/lib/localServices/customServiceSearch";

/** Presentation groups only. Canonical actions, priority and evidence are not rewritten. */
export function groupReportActions(actions: ReportAction[], canonical?: ReportAction | null) {
  const ordered = canonical ? [canonical, ...actions.filter((action) => action.id !== canonical.id)] : actions;
  const groups: Array<{ action: ReportAction; members: ReportAction[]; title: string }> = [];
  for (const action of ordered.filter((item) => item.status === "open" || item.status === "in_progress")) {
    const planning = action.targetTab === "zoning-build" || action.professionalType === "Town planner";
    const existing = planning ? groups.find((group) => group.members.some((member) =>
      member.targetTab === "zoning-build" || member.professionalType === "Town planner")) : undefined;
    if (existing) existing.members.push(action);
    else groups.push({ action, members: [action], title: action.title });
  }
  return groups.map((group) => ({ ...group, title: group.members.length > 1 ? "Confirm the property's planning controls" : group.title }));
}

export function reportProfessionalSearch(action: ReportAction, location?: string | null) {
  return action.professionalType && location ? customServiceGoogleMapsUrl(action.professionalType, location) : null;
}

export function reportEvidenceAnchor(tab: string, taskAnchor?: string) {
  if (taskAnchor === "sg-diagram-evidence") return "investigation-sg";
  const anchors: Record<string, string> = {
    "zoning-build": "investigation-planning", market: "investigation-market", listings: "investigation-market", reports: "investigation-documents", calculators: "investigation-strategy",
    "site-potential": "investigation-site", "sg-diagram": "investigation-sg", "erf-file-vault": "investigation-documents",
    "title-deed": "investigation-title", "paid-reports": "investigation-title", overview: "investigation-identity",
    research: "investigation-findings", "property-checks": "investigation-site-risk",
  };
  return anchors[tab] ?? "investigation-findings";
}

export function reportTaskLabel(tab: string) {
  const labels: Record<string, string> = {
    "zoning-build": "Open zoning task", market: "Open Market Evidence", listings: "Open Market Evidence", reports: "Open property documents", calculators: "Open Strategy",
    "site-potential": "Open Site Potential", "sg-diagram": "Open SG task", "erf-file-vault": "Open File Vault",
    "title-deed": "Open title task", "paid-reports": "Open property documents", overview: "Open property identity",
    research: "Open investigation research", "property-checks": "Open Property Checks",
  };
  return labels[tab] ?? "Open investigation task";
}

export function materialReportFindings(findings: ReportFinding[]) {
  // Never truncate actual contradictions or issues to make a summary look calmer.
  return findings.filter((finding) => ["conflicting", "confirmed_issue", "possible_issue"].includes(finding.status));
}

export function safeReportSourceUrl(value?: string) {
  if (!value) return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
