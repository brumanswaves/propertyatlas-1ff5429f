import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { groupReportActions, materialReportFindings, reportEvidenceAnchor, reportProfessionalSearch, safeReportSourceUrl, reportTaskLabel } from "../reportPresentation";
import { SharedInvestigationReport } from "@/components/humanReview/SharedInvestigationReport";
import { FindingCard, ReportActionPlan } from "@/components/property/dossier/ReportFindingsSection";
import { reportPreviewAssembly } from "../../../../scripts/fixtures/report-preview-data";

describe("decision brief presentation preserves canonical evidence", () => {
  it("groups repeated planning actions without dropping members or changing canonical priority", () => {
    const { document } = reportPreviewAssembly(true);
    const before = JSON.stringify(document);
    const groups = groupReportActions(document.actions, document.nextBestAction);
    expect(groups[0].action.id).toBe(document.nextBestAction!.id);
    const planning = groups.filter((group) => group.members.some((member) => member.professionalType === "Town planner"));
    expect(planning).toHaveLength(1);
    expect(planning[0].members.length).toBeGreaterThan(1);
    expect(new Set(groups.flatMap((group) => group.members.map((member) => member.id))))
      .toEqual(new Set([document.nextBestAction!.id, ...document.actions.map((action) => action.id)]));
    expect(JSON.stringify(document)).toBe(before);
  });

  it("keeps all material contradictions visible and never upgrades sparse evidence", () => {
    const supported = reportPreviewAssembly(true);
    const conflicts = materialReportFindings(supported.document.findings);
    expect(conflicts.some((finding) => finding.status === "conflicting")).toBe(true);
    const html = renderToStaticMarkup(<SharedInvestigationReport assembly={supported} />);
    const opening = html.split('id="report-evidence"')[0];
    for (const conflict of conflicts) expect(opening).toContain(conflict.headline);
    const sparse = renderToStaticMarkup(<SharedInvestigationReport assembly={reportPreviewAssembly(false)} />);
    expect(sparse).toContain("No selected Strategy figures are available");
    expect(sparse).toContain("Still unverified:");
    expect(sparse).not.toContain("Human-reviewed investigation.");
  });

  it("limits the opening to three actions, preserves numbers, findings, sources and the immutable input", () => {
    const assembly = reportPreviewAssembly(true);
    const before = JSON.stringify(assembly);
    const html = renderToStaticMarkup(<SharedInvestigationReport assembly={assembly} />);
    const opening = html.split('id="report-evidence"')[0];
    expect(opening.match(/data-action-id=/g)).toHaveLength(3);
    expect(opening).toContain("8.65%");
    expect(opening).toContain("Calculated from saved assumptions");
    for (const finding of assembly.document.findings) expect(html).toContain(`id="finding-${finding.id}"`);
    for (const source of assembly.pack.sources) expect(html).toContain(`id="investigation-source-${encodeURIComponent(source.id)}"`);
    expect(JSON.stringify(assembly)).toBe(before);
    expect(html).not.toContain("Done when:");
    expect(html).not.toContain("Resolved when:");
    expect(html).not.toContain("Five questions this investigation");
  });

  it("does not render a task button without an actual callback", () => {
    const { document } = reportPreviewAssembly(false);
    expect(renderToStaticMarkup(<ReportActionPlan actions={document.actions} />)).not.toContain("<button");
    expect(renderToStaticMarkup(<FindingCard finding={document.findings[0]} actions={document.actions} />)).not.toContain("<button");
    expect(renderToStaticMarkup(<ReportActionPlan actions={document.actions} onOpenTab={vi.fn()} />)).toContain("<button");
  });

  it("routes source evidence and professional searches separately with a real location", () => {
    const { document } = reportPreviewAssembly(true);
    const planner = document.actions.find((action) => action.professionalType === "Town planner")!;
    expect(reportEvidenceAnchor("zoning-build")).toBe("investigation-planning");
    expect(reportEvidenceAnchor("research", "sg-diagram-evidence")).toBe("investigation-sg");
    expect(reportEvidenceAnchor("listings")).toBe("investigation-market");
    expect(reportTaskLabel("listings")).toBe("Open Market Evidence");
    expect(reportEvidenceAnchor("reports")).toBe("investigation-documents");
    const search = new URL(reportProfessionalSearch(planner, "St Francis Bay, Eastern Cape")!);
    expect(search.hostname).toBe("www.google.com");
    expect(search.searchParams.get("query")).toBe("Town planner near St Francis Bay, Eastern Cape");
    expect(reportProfessionalSearch(planner, null)).toBeNull();
    expect(safeReportSourceUrl("javascript:alert(1)")).toBeNull();
    expect(safeReportSourceUrl("https://example.invalid/source")).toBe("https://example.invalid/source");
  });

  it("expands all evidence for the existing print document and hides task controls", () => {
    const html = renderToStaticMarkup(<SharedInvestigationReport assembly={reportPreviewAssembly(true)} openingControls={{ printOnly: true, onOpenTab: vi.fn() }} />);
    expect(html.match(/<details open="" class="report-evidence-details/g)).toHaveLength(6);
    expect(html).not.toContain("Open investigation research");
  });
});
