import { readFileSync } from "node:fs";
import { buildReportComposition } from "@/lib/reports/reportComposition";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportOpening } from "../ReportOpening";
import {
  AssetExtractionStatusChip,
  ReportOwnershipSection,
} from "../ReportEvidenceUi";
import { buildReportViewModel } from "@/lib/reports/buildReportViewModel";
import { composeEasyErfReport } from "@/lib/reports/composeEasyErfReport";
import {
  buildEvidencePackFixture,
  evidenceAsset,
  evidenceParcel,
} from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

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
    doc: composeEasyErfReport({ report, pack, generatedAt: "2026-07-23T10:00:00Z" }),
  };
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
    expect(web.indexOf('id="report-decision"')).toBeLessThan(web.indexOf('id="report-next-action"'));
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
    const emptyMarkup = renderToStaticMarkup(<ReportOwnershipSection ownership={empty.ownership} />);
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
    expect(chip({ metadata: { extractionStatus: "partial", identityMatchStatus: "matched" } })).toContain(
      "no structured values found",
    );
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
    expect(
      chip({ asset_category: "site_photo", mime_type: "image/heic", metadata: {} }),
    ).toContain("Stored for reference");
  });
});

describe("Report opening order (dossier source)", () => {
  const source = readFileSync(
    resolve(__dirname, "../../ErfResearchDossier.tsx"),
    "utf8",
  );

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
});
