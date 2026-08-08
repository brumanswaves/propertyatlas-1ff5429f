import { readFileSync } from "node:fs";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { buildReportComposition } from "@/lib/reports/reportComposition";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportOpening } from "../ReportOpening";
import { ReportViewSelector } from "../ReportViewSelector";
import { AssetExtractionStatusChip, ReportOwnershipSection } from "../ReportEvidenceUi";
import { buildReportViewModel } from "@/lib/reports/buildReportViewModel";
import { composeEasyErfReport } from "@/lib/reports/composeEasyErfReport";
import {
  buildEvidencePackFixture,
  evidenceAsset,
  evidenceParcel,
} from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import { canonicalReportAction } from "@/lib/investigation/canonicalNextAction";
import { GUIDED_TASK_DEFINITIONS } from "@/lib/investigation/guidedTaskRegistry";

const LIGHTSTONE: ErfAsset = evidenceAsset({
  id: "asset-lightstone",
  asset_category: "paid_report",
  asset_type: "pdf",
  mime_type: "application/pdf",
  source_label: "Lightstone Property Report",
  original_file_name: "lightstone-erf-1021.pdf",
  metadata: {
    extractionStatus: "ready",
    identityMatchStatus: "matched",
    extractedText: "Lightstone report for Erf 1021, St Francis Bay.",
    extractedClaims: [
      {
        domain: "ownership",
        key: "registeredOwner",
        label: "Registered owner",
        value: "J A DU PLESSIS (ID 8001015009087)",
        page: 2,
      },
      {
        domain: "ownership",
        key: "coOwners",
        label: "Co-owner",
        value: "M E DU PLESSIS · 021 555 1234 · me.duplessis@example.com",
        page: 2,
      },
      {
        domain: "ownership",
        key: "ownershipShare",
        label: "J A du Plessis share",
        value: "50%",
        page: 2,
      },
      {
        domain: "ownership",
        key: "ownershipShare",
        label: "M E du Plessis share",
        value: "50%",
        page: 2,
      },
      {
        domain: "deeds",
        key: "titleDeedNumber",
        label: "Title deed number",
        value: "T2574/2024",
        page: 3,
      },
    ],
  },
});

function buildDoc(assets: ErfAsset[] = []) {
  const report = buildReportViewModel({
    parcel: evidenceParcel(),
    workspaceState: createEmptyErfWorkspaceState(),
    savedEvidence: [],
    marketAddress: null,
    assets,
    chosenScenario: null,
    strategyScenarios: [],
    selectedSiteDesign: null,
    propertyNotes: null,
  });
  const pack = buildEvidencePackFixture({ assets, savedMarketEvidence: [] });
  return {
    report,
    pack,
    doc: composeEasyErfReport({ report, pack, generatedAt: "2026-07-23T10:00:00Z" }),
  };
}

function buildGuidedActionDoc(identityConfirmed = true) {
  const { report, pack } = buildDoc();
  const workspaceState = createEmptyErfWorkspaceState();
  workspaceState.identityStatus = identityConfirmed ? "looks_correct" : "none";
  const canonicalNextAction = canonicalReportAction({
    parcel: evidenceParcel(),
    workspaceState,
    assets: [],
    savedEvidence: [],
  });

  return composeEasyErfReport({
    report,
    pack,
    canonicalNextAction,
    generatedAt: "2026-07-23T10:00:00Z",
  });
}

type TestElementProps = { children?: ReactNode; onClick?: () => void };

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement<TestElementProps>(node)) {
    return Children.toArray(node).map(textContent).join("");
  }
  return textContent(node.props.children);
}

function findButton(node: ReactNode, label: string): ReactElement<TestElementProps> | null {
  if (node == null || typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    return null;
  }
  if (!isValidElement<TestElementProps>(node)) {
    for (const child of Children.toArray(node)) {
      const match = findButton(child, label);
      if (match) return match;
    }
    return null;
  }
  if (node.type === "button" && textContent(node.props.children).includes(label)) return node;
  return findButton(node.props.children, label);
}

describe("ReportOpening (rendered)", () => {
  const { doc } = buildDoc();
  const web = renderToStaticMarkup(
    <ReportOpening doc={doc} askSlot={<textarea aria-label="Ask Easy Erf about this erf" />} />,
  );
  const print = renderToStaticMarkup(<ReportOpening doc={doc} printOnly />);

  it("renders the approved Easy Erf logo lockup in the header", () => {
    expect(web).toContain('alt="Easy Erf"');
    expect(web).toContain("/easy-erf/logos/easy-erf-nav-logo-transparent.png");
  });

  it("renders exactly one opening and one Ask block, before the supporting sections", () => {
    expect(web.match(/class="report-opening /g)?.length ?? 0).toBe(1);
    expect(web.match(/id="report-ask"/g)?.length ?? 0).toBe(1);
    expect(web.indexOf('id="report-ask"')).toBeLessThan(web.indexOf('id="report-decision"'));
    expect(web.indexOf('id="report-decision"')).toBeLessThan(
      web.indexOf('id="report-next-action"'),
    );
  });

  it("shows a live Ask control in web mode and a static explanation in print mode", () => {
    expect(web).toContain("Ask Easy Erf about this erf");
    expect(web).toContain("<textarea");
    expect(print).not.toContain("<textarea");
    expect(print).not.toContain("Ask Easy Erf about this erf");
    expect(print).toContain(doc.ask.printExplanation);
  });

  it("uses continuous scroll in web mode with no A4 page frame or page labels", () => {
    expect(web).not.toMatch(/Page \d+ of \d+/);
    expect(web.toLowerCase()).not.toContain("a4-page");
    expect(web.toLowerCase()).not.toContain("page-frame");
  });

  it("routes the next best action to a real workbench tab", () => {
    const tabs = ["overview", "sources", "research", "market", "reports", "strategy", "site"];
    if (doc.nextBestAction) {
      expect(tabs).toContain(doc.nextBestAction.targetTab);
      expect(web).toContain("Take this step");
    }
  });

  it("renders SG action guidance from the canonical Guided task", () => {
    const sg = GUIDED_TASK_DEFINITIONS.find((task) => task.id === "add-sg-diagram")!;
    const actionable = buildGuidedActionDoc();
    const markup = renderToStaticMarkup(<ReportOpening doc={actionable} />);

    expect(actionable.nextBestAction?.id).toBe("investigation-add-sg-diagram");
    expect(markup).toContain(sg.title);
    expect(markup).toContain(sg.whyItMatters);
    for (const step of sg.steps) expect(markup).toContain(step);
    expect(markup).toContain(`href="${sg.sourceUrl}"`);
    expect(markup).toContain(sg.sourceLabel);
    expect(markup).toContain(sg.primaryActionLabel);
    expect(actionable.nextBestAction?.targetAnchorId).toBe("sg-diagram-evidence");
  });

  it("routes the canonical action to its exact Guided tab and anchor", () => {
    const actionable = buildGuidedActionDoc();
    const onOpenTab = vi.fn();
    const tree = ReportOpening({ doc: actionable, onOpenTab });
    const button = findButton(tree, "Open Sources and add the SG diagram");

    expect(button).not.toBeNull();
    button?.props.onClick?.();
    expect(onOpenTab).toHaveBeenCalledWith("research", { anchorId: "sg-diagram-evidence" });
  });

  it("does not render an external source action when the canonical task has no source URL", () => {
    const identity = buildGuidedActionDoc(false);
    const markup = renderToStaticMarkup(<ReportOpening doc={identity} />);

    expect(identity.nextBestAction?.id).toBe("investigation-confirm-property-identity");
    expect(identity.nextBestAction?.sourceUrl).toBeUndefined();
    expect(markup).not.toContain('target="_blank"');
  });

  it("keeps useful canonical guidance in print without interactive action controls", () => {
    const actionable = buildGuidedActionDoc();
    const markup = renderToStaticMarkup(<ReportOpening doc={actionable} printOnly />);

    expect(markup).toContain("Why this matters");
    expect(markup).toContain("How to do it");
    expect(markup).toContain("Chief Surveyor-General document viewer");
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain('target="_blank"');
  });

  it("never renders an unsupported metric or glance value as zero", () => {
    for (const metric of doc.primaryMetrics) {
      expect(metric.value.trim()).not.toBe("0");
      expect(metric.value).not.toMatch(/^R\s?0$/);
      expect(metric.value).not.toMatch(/^0\s?m²$/);
    }
    for (const item of doc.atAGlance) {
      expect(item.value.trim()).not.toBe("0");
      expect(item.value).not.toMatch(/^0\s?m²$/);
    }
  });

  it("states the denominator whenever a price per m² metric is shown", () => {
    for (const metric of doc.primaryMetrics.filter((m) => /per m²/i.test(m.label))) {
      expect(metric.denominator).toBeTruthy();
      expect(web).toContain(`Denominator: ${metric.denominator}`);
    }
  });

  it("does not claim that no actions remain when there is no canonical evidence", () => {
    const empty = composeEasyErfReport({
      report: buildDoc().report,
      pack: undefined,
      generatedAt: "2026-07-23T10:00:00Z",
    });
    const markup = renderToStaticMarkup(<ReportOpening doc={empty} printOnly />);
    if (!empty.nextBestAction) {
      expect(markup).toContain("Evidence for this erf is unavailable");
      expect(markup).not.toContain("No material gap or contradiction remains");
    }
  });
});

describe("Ownership section (rendered)", () => {
  const { report } = buildDoc([LIGHTSTONE]);
  const markup = renderToStaticMarkup(<ReportOwnershipSection ownership={report.ownership} />);

  it("renders matched owner names, 50% shares and the title deed number", () => {
    expect(markup).toContain("DU PLESSIS");
    expect(markup.match(/50%/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(markup).toContain("T2574/2024");
  });

  it("attributes every rendered value to a source id and page locator", () => {
    expect(markup).toContain("asset-asset-lightstone");
    expect(markup).toContain("page 2");
    expect(markup).toContain("page 3");
  });

  it("never renders identity numbers, phone numbers or email addresses", () => {
    expect(markup).not.toContain("8001015009087");
    expect(markup).not.toContain("021 555 1234");
    expect(markup).not.toContain("me.duplessis@example.com");
    expect(markup).toContain("not displayed in the Easy Erf Report");
    expect(markup).not.toContain("never extracted");
  });

  it("hides the missing owner/deed badges when both are supported, and keeps bond and transfer missing", () => {
    expect(markup).not.toContain(">Owner name<");
    expect(markup).not.toContain(">Deed number<");
    expect(markup).toContain("Bond info");
    expect(markup).toContain("Transfer history");
  });

  it("shows the missing badges when nothing is supported", () => {
    const { report: empty } = buildDoc([]);
    const emptyMarkup = renderToStaticMarkup(
      <ReportOwnershipSection ownership={empty.ownership} />,
    );
    expect(emptyMarkup).toContain("Owner name");
    expect(emptyMarkup).toContain("Deed number");
    expect(emptyMarkup).toContain("Not verified by Easy Erf");
  });
});

describe("Extraction status chip (rendered)", () => {
  const chip = (asset: Partial<ErfAsset>) =>
    renderToStaticMarkup(
      <AssetExtractionStatusChip
        asset={evidenceAsset({
          asset_category: "paid_report",
          mime_type: "application/pdf",
          ...asset,
        })}
      />,
    );

  it("says the report is searchable when it is ready and matched", () => {
    expect(
      chip({ metadata: { extractionStatus: "ready", identityMatchStatus: "matched" } }),
    ).toContain("Report searchable");
  });

  it("labels parent General Plan context as context only", () => {
    expect(
      chip({
        asset_category: "sg_diagram",
        metadata: {
          extractionStatus: "ready",
          identityMatchStatus: "parent_lineage_match",
          documentLineage: { parentErfNumber: "1496", generalPlanReference: "GP12252" },
        },
      }),
    ).toContain("context only");
  });

  it("shows a pending state while extraction is queued or processing", () => {
    expect(chip({ metadata: { extractionStatus: "queued" } })).toContain("Queued for reading");
    expect(chip({ metadata: { extractionStatus: "processing" } })).toContain("Extracting report");
  });

  it("shows an unreadable state when nothing could be read", () => {
    expect(
      chip({ metadata: { extractionStatus: "partial", identityMatchStatus: "matched" } }),
    ).toContain("no structured values found");
    expect(chip({ metadata: { extractionStatus: "unsupported" } })).toContain(
      "Cannot be read automatically",
    );
  });

  it("shows the wrong-property state for a mismatched document", () => {
    expect(
      chip({ metadata: { extractionStatus: "ready", identityMatchStatus: "mismatch" } }),
    ).toContain("Wrong property report");
  });

  it("shows the failure reason when extraction failed", () => {
    expect(
      chip({
        metadata: {
          extractionStatus: "failed",
          identityMatchStatus: "matched",
          extractionError: "The file could not be read",
        },
      }),
    ).toContain("The file could not be read");
  });

  it("labels a non-extractable asset as reference only", () => {
    expect(chip({ asset_category: "site_photo", mime_type: "image/heic", metadata: {} })).toContain(
      "Stored for reference",
    );
  });
});

describe("Report opening order (dossier source)", () => {
  const source = readFileSync(resolve(__dirname, "../../ErfResearchDossier.tsx"), "utf8");

  it("renders the opening, then the lens navigation, then the composed groups", () => {
    const opening = source.indexOf("<ReportOpening");
    // Navigation is driven by the decision-lens composition destinations, and
    // the lettered groups are rendered after it in composition order.
    const nav = source.indexOf("composition.destinations.map");
    const groups = source.indexOf("composition.groupOrder.map");
    expect(opening).toBeGreaterThan(-1);
    expect(nav).toBeGreaterThan(opening);
    expect(groups).toBeGreaterThan(nav);
  });

  it("keeps supporting sections inside the final group of every lens", () => {
    // Change tracking must never precede the report opening at runtime: it
    // lives in the "next" group, which is last in both compositions.
    expect(source).toContain("<ReportChangeTrackingSection");
    for (const mode of ["standard", "investor"] as const) {
      expect(buildReportComposition(mode).groupOrder.at(-1)).toBe("next");
    }
  });

  it("keeps vacant-land reports free of unsupported house fields", () => {
    const { doc } = buildDoc();
    // Vacant land has no building metrics, so no house metric may be composed.
    for (const metric of doc.primaryMetrics) {
      expect(metric.label.toLowerCase()).not.toMatch(/bedroom|bathroom/);
    }
    // A house field may only render when the view model marked it supported.
    expect(source).not.toMatch(/Bedrooms[^]{0,80}\{0\}/);
  });

  it("forwards the canonical Guided anchor through the dossier to the Workbench", () => {
    const panel = readFileSync(resolve(__dirname, "../../OfficialParcelPanel.tsx"), "utf8");

    expect(source).toContain(
      "onOpenTab={(tab, options) => onSelectView?.(routeTabFor(tab), options)}",
    );
    expect(panel).toContain("anchorId: options?.anchorId");
  });
});

describe("Report view selector (rendered)", () => {
  const { doc } = buildDoc();
  const render = (mode: "standard" | "investor", onChange = () => {}) =>
    renderToStaticMarkup(
      <ReportOpening
        doc={doc}
        modeSlot={<ReportViewSelector mode={mode} onChange={onChange} />}
        askSlot={<textarea aria-label="Ask Easy Erf about this erf" />}
      />,
    );

  it("renders one obvious Report view control before Ask Easy Erf", () => {
    const web = render("standard");
    expect(web).toContain("Report view");
    expect(web).toContain("Buyer due diligence");
    expect(web).toContain("Returns, assumptions &amp; downside");
    expect(web.indexOf('id="report-view-mode"')).toBeGreaterThan(
      web.indexOf('id="report-opening-header"'),
    );
    expect(web.indexOf('id="report-view-mode"')).toBeLessThan(web.indexOf('id="report-ask"'));
    expect(web.match(/aria-label="Report view"/g)?.length ?? 0).toBe(1);
  });

  it("marks the active mode unmistakably and never both at once", () => {
    for (const mode of ["standard", "investor"] as const) {
      const markup = render(mode);
      expect(markup.match(/aria-pressed="true"/g)?.length ?? 0).toBe(1);
    }
    expect(render("investor")).toContain("Active");
  });

  it("hides the control from the printed report", () => {
    const print = renderToStaticMarkup(
      <ReportOpening
        doc={doc}
        printOnly
        modeSlot={<ReportViewSelector mode="investor" onChange={() => {}} />}
      />,
    );
    expect(print).not.toContain('id="report-view-mode"');
  });

  it("switching to Investor changes the composition the report renders", () => {
    const standard = buildReportComposition("standard");
    const investor = buildReportComposition("investor");
    expect(investor.groupOrder).not.toEqual(standard.groupOrder);
    expect(investor.destinations.map((d) => d.id)).not.toEqual(
      standard.destinations.map((d) => d.id),
    );
    expect(investor.askSuggestionFocus).not.toEqual(standard.askSuggestionFocus);
    expect(investor.verdictHeading).not.toBe(standard.verdictHeading);
  });
});

describe("Report concision (dossier source)", () => {
  const source = readFileSync(resolve(__dirname, "../../ErfResearchDossier.tsx"), "utf8");

  it("exposes exactly five primary destinations by default in both lenses", () => {
    for (const mode of ["standard", "investor"] as const) {
      expect(buildReportComposition(mode).destinations).toHaveLength(5);
    }
  });

  it("keeps every deep evidence block behind exactly one disclosure", () => {
    const disclosureMatches = source.match(/<details\s*\n\s*id="report-due-diligence"/g) ?? [];
    expect(disclosureMatches).toHaveLength(1);

    const start = source.indexOf('id="report-due-diligence"');
    const end = source.indexOf("</details>", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const inside = source.slice(start, end);

    for (const marker of [
      "ReportSgLineageSection",
      'id="report-zoning-build"',
      "Decision Detail",
      'id="report-risk"',
      "ReportEvidenceAppendix",
      "ReportChangeTrackingSection",
    ]) {
      expect(inside).toContain(marker);
    }

    // None of these deep markers may also appear outside the disclosure.
    const outside = source.slice(0, start) + source.slice(end);
    for (const marker of ["<ReportSgLineageSection", 'id="report-zoning-build"', "<ReportEvidenceAppendix", "<ReportChangeTrackingSection"]) {
      expect(outside).not.toContain(marker);
    }
  });

  it("replaces repeated unknown-only context with a single still-to-verify summary", () => {
    expect(source.match(/<ReportStillToVerifySection/g) ?? []).toHaveLength(1);
  });

  it("shows technical evidence in a separated appendix in print mode", () => {
    expect(source).toContain('open={printOnly || undefined}');
  });

  it("makes Standard and Investor compositions genuinely differ", () => {
    const standard = buildReportComposition("standard");
    const investor = buildReportComposition("investor");
    expect(investor.groupOrder).not.toEqual(standard.groupOrder);
    expect(investor.destinations.map((d) => d.id)).not.toEqual(
      standard.destinations.map((d) => d.id),
    );
  });
});
