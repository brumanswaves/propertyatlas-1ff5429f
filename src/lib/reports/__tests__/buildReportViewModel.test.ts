import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildReportViewModel,
  REPORT_SECTIONS,
  type BuildReportInput,
} from "@/lib/reports/buildReportViewModel";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import { __REPORT_PRESENTATION_TESTS } from "@/components/property/ErfResearchDossier";

function baseParcel(overrides: Partial<NormalizedOfficialParcel> = {}): NormalizedOfficialParcel {
  return {
    id: "parcel:erf-224",
    sourceLabel: "Kouga SG",
    erfNumber: 224,
    portion: 0,
    lpi: "C01900010000022400000",
    parcelKey: "C01900010000022400000",
    municipality: "Kouga",
    province: "Eastern Cape",
    knownFields: [{ label: "Erf", value: "224", source: "csg" }],
    missingFields: [],
    rawProperties: { SHAPE_Area: 987 },
    coordinates: { lng: 24.9, lat: -34.1 },
    ...overrides,
  } as NormalizedOfficialParcel;
}

function baseInput(overrides: Partial<BuildReportInput> = {}): BuildReportInput {
  const parcel = overrides.parcel ?? baseParcel();
  return {
    parcel,
    workspaceState: createEmptyErfWorkspaceState(),
    savedEvidence: [],
    marketAddress: null,
    assets: [],
    chosenScenario: null,
    strategyScenarios: [],
    selectedSiteDesign: null,
    siteBrief: null,
    now: new Date("2026-07-16T00:00:00Z"),
    ...overrides,
  };
}

describe("buildReportViewModel", () => {
  it("does not fabricate an owner when no ownership evidence is present", () => {
    const vm = buildReportViewModel(baseInput());
    expect(vm.ownership.hasUploadedReport).toBe(false);
    expect(vm.ownership.isVerified).toBe(false);
    expect(vm.ownership.message).toMatch(/not verified/i);
    expect(vm.ownership.uploadedReportNames).toHaveLength(0);
    const readiness = vm.brief.categories.find((c) => c.id === "ownership");
    expect(readiness?.state).not.toBe("confirmed");
  });

  it("does not show an AI valuation when market evidence is unsupported", () => {
    const vm = buildReportViewModel(baseInput());
    expect(vm.market.canShowIndicativeValue).toBe(false);
    expect(vm.market.evidenceCount).toBe(0);
    expect(vm.market.includedCount).toBe(0);
  });

  it("scales decision readiness with evidence completeness only", () => {
    const empty = buildReportViewModel(baseInput());
    const populated = buildReportViewModel(
      baseInput({
        workspaceState: {
          ...createEmptyErfWorkspaceState(),
          identityStatus: "checked",
          reviewedSourceIds: ["a", "b", "c"],
          marketAddressSaved: true,
          strategyScenarioCount: 1,
          chosenScenarioId: "scenario-1",
        },
        savedEvidence: buildEvidence(4),
      }),
    );
    expect(populated.brief.readinessPercent).toBeGreaterThan(empty.brief.readinessPercent);
  });

  it("keeps official identity and market address distinct with mismatch flag", () => {
    const vm = buildReportViewModel(
      baseInput({
        marketAddress: {
          selectedAddressId: "addr-1",
          candidates: [],
          userConfirmedAddress: {
            id: "addr-1",
            formattedAddress: "12 Elm St, Cape Town",
            municipality: "City of Cape Town",
            source: "user_entered",
            confidence: "high",
            reason: "user typed",
            createdAt: "2026-01-01T00:00:00Z",
          },
        },
      }),
    );
    expect(vm.identity.officialLine).toContain("Kouga");
    expect(vm.identity.marketAddressLine).toContain("Cape Town");
    expect(vm.identity.addressAndOfficialMismatch).toBe(true);
  });

  it("attaches the concept-only disclaimer whenever a Site Potential design is selected", () => {
    const vm = buildReportViewModel(
      baseInput({
        selectedSiteDesign: {
          id: "asset-1",
          asset_category: "generated_design",
          asset_type: "generated_design",
          original_file_name: "concept.png",
          storage_path: "path",
          size_bytes: 100,
          created_at: "2026-07-01T00:00:00Z",
          status: "uploaded",
          source_label: null,
          metadata: {},
        } as never,
      }),
    );
    expect(vm.site.selectedDesign).not.toBeNull();
    expect(vm.site.disclaimer).toMatch(/Not an architectural plan/i);
  });

  it("exposes stable anchor section metadata for navigation", () => {
    const ids = REPORT_SECTIONS.map((s) => s.anchorId);
    expect(ids).toContain("report-brief");
    expect(ids).toContain("report-identity");
    expect(ids).toContain("report-ownership");
    expect(ids).toContain("report-recommendations");
    for (const id of ids) expect(id.startsWith("report-")).toBe(true);
  });
});

describe("Easy Erf report presentation rendering", () => {
  const {
    DecisionLensSelector,
    PrintFactTable,
    PrintStrategyAssumptions,
    formatArea,
    investorAssumptionRows,
    printFactRow,
  } = __REPORT_PRESENTATION_TESTS;

  it("renders the persistent Standard and Investor selector with current print mode copy", () => {
    const standardHtml = renderToStaticMarkup(
      createElement(DecisionLensSelector, { mode: "standard", onChange: () => undefined }),
    );
    const investorHtml = renderToStaticMarkup(
      createElement(DecisionLensSelector, { mode: "investor", onChange: () => undefined }),
    );

    expect(standardHtml).toContain("Standard report");
    expect(standardHtml).toContain("Investor report");
    expect(standardHtml).toContain(
      "Clear property facts, planning readiness, risks and recommended next actions.",
    );
    expect(standardHtml).toContain(
      "Deal assumptions, financial readiness, evidence gaps and investment risks.",
    );
    expect(standardHtml).toContain("Currently viewing and printing: Standard report");
    expect(standardHtml).toContain("Selected");
    expect(investorHtml).toContain("Currently viewing and printing: Investor report");
  });

  it("renders explicit factual statuses for missing and populated area and zoning rows", () => {
    const html = renderToStaticMarkup(
      createElement(PrintFactTable, {
        title: "Rendered status proof",
        rows: [
          printFactRow("Missing erf area", null, "Official"),
          printFactRow("Verified erf area", formatArea(1570), "Official"),
          printFactRow("Missing zoning", null, "Official"),
          printFactRow("Populated zoning", "Single Residential", "Official"),
        ],
      }),
    );

    expect(html).toMatch(/Missing erf area[\s\S]*Not yet verified[\s\S]*Missing/);
    expect(html).toMatch(/Verified erf area[\s\S]*1(?:,|&nbsp;|\s)570 m2[\s\S]*Official/);
    expect(html).toMatch(/Missing zoning[\s\S]*Not yet verified[\s\S]*Missing/);
    expect(html).toMatch(/Populated zoning[\s\S]*Single Residential[\s\S]*Official/);
    expect(html).not.toContain(
      '<td>Not yet verified</td><td><span class="print-status print-status-good">Official</span>',
    );
  });

  it("renders saved development assumptions from the real Strategy keys", () => {
    const scenario = {
      strategy: "development_sell",
      inputs: {
        landCost: "1175000",
        buildCost: "3500000",
        professionalFees: "250000",
        municipalPlanningFees: "120000",
        contingencyPercent: "10",
        developmentDurationMonths: "14",
        monthlyHoldingCost: "18000",
        exitSellingCosts: "150000",
        expectedSaleValue: "6200000",
      },
    };

    const standardHtml = renderToStaticMarkup(
      createElement(PrintStrategyAssumptions, { scenario: scenario as never }),
    );
    const investorHtml = renderToStaticMarkup(
      createElement(PrintFactTable, {
        title: "Investor assumptions",
        rows: investorAssumptionRows(scenario as never),
      }),
    );
    const combined = `${standardHtml}${investorHtml}`;

    expect(combined).toContain("Municipal planning fees");
    expect(combined).toContain("120000 (User assumption)");
    expect(combined).toContain("Contingency percent");
    expect(combined).toContain("10% (User assumption)");
    expect(combined).toContain("Exit selling costs");
    expect(combined).toContain("150000 (User assumption)");
    expect(combined).not.toMatch(/Municipal planning fees[\s\S]*Not yet verified/);
    expect(combined).not.toMatch(/Contingency percent[\s\S]*Not yet verified/);
    expect(combined).not.toMatch(/Exit selling costs[\s\S]*Not yet verified/);
  });

  it("renders missing development assumptions as not yet verified and missing", () => {
    const html = renderToStaticMarkup(
      createElement(PrintFactTable, {
        title: "Missing investor assumptions",
        rows: investorAssumptionRows({ strategy: "development_sell", inputs: {} } as never),
      }),
    );

    expect(html).toMatch(/Municipal planning fees[\s\S]*Not yet verified[\s\S]*Missing/);
    expect(html).toMatch(/Contingency percent[\s\S]*Not yet verified[\s\S]*Missing/);
    expect(html).toMatch(/Exit selling costs[\s\S]*Not yet verified[\s\S]*Missing/);
  });
});

describe("PropertyIntelligenceReport view (source-level)", () => {
  const source = readFileSync(
    resolve(__dirname, "../../../components/property/ErfResearchDossier.tsx"),
    "utf8",
  );
  const styles = readFileSync(resolve(__dirname, "../../../styles.css"), "utf8");
  const lifecycleSource = readFileSync(
    resolve(__dirname, "../reportPrintLifecycle.ts"),
    "utf8",
  );
  const printPresentationSource = source.slice(
    source.indexOf("function EasyErfPrintReport"),
    source.indexOf("function PrintPageHeading"),
  );
  const standardScreenSource = source.slice(
    source.indexOf("function EasyErfStandardScreenReport"),
    source.indexOf("function EasyErfInvestorScreenReport"),
  );
  const investorScreenSource = source.slice(
    source.indexOf("function EasyErfInvestorScreenReport"),
    source.indexOf("function ScreenPanel"),
  );

  it("wires print through a dedicated iframe document", () => {
    expect(source).toContain("createReportPrintFrame");
    expect(source).toContain("prepareReportPrintFrame");
    expect(source).toContain("contentWindow");
    expect(source).toContain("frameWindow.print()");
    expect(source).not.toContain("window.print()");
    expect(source).toContain("easy-erf-report-print-frame");
    expect(source).toContain("easy-erf-report-print-root");
    expect(source).toContain("createPortal");
    expect(source).not.toContain("easy-erf-report-printing");
    expect(source).toContain("Printable Easy Erf Report");
    expect(source).toContain("waitForPrintableReportImages");
    expect(source).toContain("waitForReportPrintPreparation");
    expect(source).toContain("REPORT_PRINT_EMERGENCY_CLEANUP_MS = 2 * 60 * 1000");
    expect(source).toContain("pendingSignedAssetPreviewSettlements");
    expect(source).toContain("signedAssetPreviewUrlCache");
    expect(source).toContain("SignedAssetPreviewState");
    expect(source).toContain('status: "unavailable"');
    expect(source).toContain("onError");
    expect(source).toContain("printInProgressRef.current");
    expect(source).toContain("createReportPrintLifecycleController");
    expect(source).toContain("REPORT_PRINT_FOCUS_MIN_HOLD_MS = 30_000");
    expect(source).toContain("lifecycle?.markPrintStarted()");
    expect(source).toContain(
      'For a clean Easy Erf PDF, turn off "Headers and footers" in Chrome\\\'s print options.',
    );
    expect(source).not.toContain("setTimeout(() => cleanup(), 600)");
    expect(lifecycleSource).toContain('frameWindow.addEventListener("afterprint"');
    expect(lifecycleSource).toContain('frameWindow.matchMedia?.("print")');
    expect(lifecycleSource).toContain("printMediaEntered = true");
    expect(lifecycleSource).toContain("now() - printStartedAt >= focusMinimumHoldMs");
    expect(source).toContain("Print / Save PDF");
  });

  it("renders the Phase 2 Executive Decision Brief from decision intelligence", () => {
    expect(source).toContain("buildDecisionIntelligence(report)");
    expect(source).toContain("Overall verdict");
    expect(source).toContain('return "Proceed"');
    expect(source).toContain('return "Proceed with conditions"');
    expect(source).toContain('return "Investigate further"');
    expect(source).toContain('return "High risk"');
    expect(source).toContain("Evidence-grounded interpretation");
    expect(source).toContain("Property IQ / Confidence Engine");
    expect(source).toContain("What Easy Erf knows");
    expect(source).toContain("What Easy Erf still needs");
    expect(source).toContain("No direct contradictions were detected");
    expect(source).toContain("Missing evidence is not proof that no conflict exists");
    expect(source).toContain("Immediate next actions");
    expect(source).toContain("Decision Matrix");
    expect(source).toContain("Evidence Timeline");
  });

  it("routes decision actions through the existing Workbench navigation", () => {
    expect(source).toContain("onSelectView?.(routeTabFor(action.tab))");
    expect(source).toContain('case "research"');
    expect(source).toContain('case "listings"');
    expect(source).toContain('case "reports"');
    expect(source).toContain('case "calculators"');
    expect(source).toContain('case "site-potential"');
    expect(source).toContain('case "stoep-report"');
  });

  it("keeps the visible report away from unsupported advice claims", () => {
    expect(source).toContain("property-quality score, valuation confidence, or purchase recommendation");
    expect(source).not.toMatch(/\bBuy recommendation\b/i);
    expect(source).not.toMatch(/\bSell recommendation\b/i);
    expect(source).not.toMatch(/\bownership is verified\b/i);
  });

  it("prints the decision intelligence sections without heavy interactive chrome", () => {
    expect(styles).not.toContain("body.easy-erf-report-printing #root");
    expect(source).toContain("REPORT_PRINT_IFRAME_CSS");
    expect(source.indexOf('document.querySelectorAll<HTMLStyleElement>("style")')).toBeLessThan(
      source.indexOf("style.textContent = REPORT_PRINT_IFRAME_CSS"),
    );
    expect(source).toContain(".report-print-document");
    expect(styles).toContain(".report-no-print { display: none !important; }");
    expect(styles).toContain(".report-decision-hero");
    expect(styles).toContain("break-inside: avoid");
    expect(styles).toContain(".report-print-avoid-break");
    expect(styles).toContain('[style*="conic-gradient"]');
  });

  it("uses separate approved Standard and Investor screen and print components", () => {
    expect(source).toContain("function EasyErfStandardScreenReport");
    expect(source).toContain("function EasyErfInvestorScreenReport");
    expect(source).toContain("function EasyErfStandardPrintReport");
    expect(source).toContain("function EasyErfInvestorPrintReport");
    expect(source).toContain('data-report-kind="standard"');
    expect(source).toContain('data-report-kind="investor"');
    expect(printPresentationSource).toContain('data-report-page={`${totalPages === 4 ? "standard" : "investor"}-${page}`}');
    expect(printPresentationSource).toContain("<StandardSnapshotPage");
    expect(printPresentationSource).toContain("<StandardFactsPage");
    expect(printPresentationSource).toContain("<StandardMarketStrategyPage");
    expect(printPresentationSource).toContain("<StandardSiteActionPage");
    expect(printPresentationSource).toContain("<InvestorDealSnapshotPage");
    expect(printPresentationSource).toContain("<InvestorAssumptionsEvidencePage");
    expect(printPresentationSource).toContain("<InvestorConceptActionPage");
  });

  it("keeps screen reports continuous and separate from compact print pages", () => {
    expect(source).toContain("<DecisionLensSelector mode={decisionMode} onChange={updateDecisionMode} />");
    expect(standardScreenSource).toContain("Property intelligence snapshot");
    expect(standardScreenSource).toContain("Property facts and planning");
    expect(standardScreenSource).toContain("Market and strategy");
    expect(standardScreenSource).toContain("Site Potential");
    expect(investorScreenSource).toContain("Deal snapshot");
    expect(investorScreenSource).toContain("Missing-input state");
    expect(investorScreenSource).toContain("Assumptions and evidence");
    expect(investorScreenSource).toContain("Investor actions");
    expect(standardScreenSource).not.toContain("<PrintPage");
    expect(investorScreenSource).not.toContain("<PrintPage");
    expect(standardScreenSource).not.toContain("report-print-page");
    expect(investorScreenSource).not.toContain("report-print-page");
    expect(standardScreenSource).not.toContain("print-page-footer");
    expect(investorScreenSource).not.toContain("print-page-footer");
    expect(standardScreenSource).not.toContain("Page {page} of {totalPages}");
    expect(investorScreenSource).not.toContain("Page {page} of {totalPages}");
  });

  it("locks the approved print page architecture and key fields", () => {
    const standardPrintSource = printPresentationSource.slice(
      printPresentationSource.indexOf("function EasyErfStandardPrintReport"),
      printPresentationSource.indexOf("function EasyErfInvestorPrintReport"),
    );
    const investorPrintSource = printPresentationSource.slice(
      printPresentationSource.indexOf("function EasyErfInvestorPrintReport"),
      printPresentationSource.indexOf("function StandardSnapshotPage"),
    );

    expect((standardPrintSource.match(/<Standard[A-Za-z]+Page/g) ?? []).length).toBe(4);
    expect((investorPrintSource.match(/<Investor[A-Za-z]+Page/g) ?? []).length).toBe(3);
    expect(printPresentationSource).toContain('eyebrow="Property intelligence snapshot"');
    expect(printPresentationSource).toContain('eyebrow="Facts and planning"');
    expect(printPresentationSource).toContain('eyebrow="Market, risks and strategy"');
    expect(printPresentationSource).toContain('eyebrow="Site potential and action plan"');
    expect(printPresentationSource).toContain('eyebrow="Investor deal snapshot"');
    expect(printPresentationSource).toContain('eyebrow="Assumptions and evidence"');
    expect(printPresentationSource).toContain('eyebrow="Concept and investor action plan"');
    expect(printPresentationSource).toContain("Evidence confidence");
    expect(printPresentationSource).toContain("Overall risk");
    expect(printPresentationSource).toContain("Erf size");
    expect(printPresentationSource).toContain("Market evidence");
    expect(printPresentationSource).toContain("Documents on file");
    expect(printPresentationSource).toContain("Total project cost");
    expect(printPresentationSource).toContain("Expected exit value");
    expect(printPresentationSource).toContain("Return on cost");
    expect(printPresentationSource).toContain("Break-even");
    expect(printPresentationSource).toContain("Evidence readiness");
  });

  it("keeps print output free of raw app chrome and file inventory details", () => {
    expect(printPresentationSource).not.toContain("AskEasyErfSection");
    expect(printPresentationSource).not.toContain("ReportChangeTrackingSection");
    expect(printPresentationSource).not.toContain("Stable asset ID");
    expect(printPresentationSource).not.toContain("original_file_name");
    expect(printPresentationSource).not.toContain("formatAssetSize");
    expect(printPresentationSource).not.toContain("formatAssetDate");
    expect(printPresentationSource).not.toContain("Living report");
    expect(printPresentationSource).not.toContain("AI extraction is not enabled");
    expect(printPresentationSource).not.toContain("report-change");
    expect(printPresentationSource).toContain("summarizePrintDocuments");
    expect(printPresentationSource).toContain("Paid reports");
    expect(printPresentationSource).toContain("Official/source documents");
    expect(printPresentationSource).toContain("User-uploaded documents");
    expect(printPresentationSource).toContain("Concept images");
    expect(printPresentationSource).toContain("Total items");
  });

  it("prints honest missing-input states instead of fake financial outputs", () => {
    expect(printPresentationSource).toContain("Not calculated");
    expect(printPresentationSource).toContain("Required assumptions are missing");
    expect(printPresentationSource).toContain("safeStrategyOutputRows");
    expect(printPresentationSource).toContain("row.state === \"available\"");
    expect(printPresentationSource).not.toContain("-100%");
    expect(printPresentationSource).not.toContain("zero margin");
  });

  it("prints corrected cover facts, Strategy assumptions and selected Site Potential images", () => {
    expect(printPresentationSource).toContain("Market address");
    expect(printPresentationSource).toContain("Erf area");
    expect(source).toContain("PrintStrategyAssumptions");
    expect(source).toContain("(User assumption)");
    expect(source).toContain("Calculated outputs");
    expect(source).toContain("preloadPrintableImageUrl");
    expect(source).toContain("waitForRenderSettlement");
    expect(source).toContain("selectedDesignImageUrl");
    expect(source).toContain("Selected Site Potential image could not be loaded for this PDF.");
    expect(source).toContain("trackSignedAssetPreviewSettlement(settlement.then(() => undefined))");
    expect(source).toContain(
      "const cachedSignedUrl = signedAssetPreviewUrlCache.get(selectedDesign.id) ?? null;",
    );
    expect(source).toContain(
      "cachedSignedUrl ? Promise.resolve(cachedSignedUrl) : createErfAssetSignedUrl(selectedDesign)",
    );
    expect(source).toContain("signedAssetPreviewUrlCache.delete(selectedDesign.id)");
    expect(source).not.toContain('url: signedAssetPreviewUrlCache.get(selectedDesign.id) as string');
    expect(source).toContain("props.selectedDesign && props.selectedDesignImageUrl ? (");
    expect(styles).toContain(".report-print-site-image");
    expect(styles).toContain("object-fit: contain");
    expect(styles).toContain(".report-print-image-placeholder");
    expect(printPresentationSource).toContain("Selected Site Potential image could not be loaded for this PDF.");
    expect(printPresentationSource).toContain("Development brief");
    expect(printPresentationSource).toContain("Concept image for illustration only");
  });

  it("renders section anchor targets that match REPORT_SECTIONS", () => {
    for (const s of REPORT_SECTIONS) {
      expect(source).toContain(`id="${s.anchorId}"`);
    }
  });

  it("keeps ownership section labelled unverified in the UI", () => {
    expect(source).toMatch(/Not verified by Easy Erf/);
  });
});

function buildEvidence(n: number): SavedMarketEvidence[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    parcelId: "parcel:erf-224",
    sourceUrl: `https://example.com/${i}`,
    sourcePortal: "example",
    title: `Comp ${i}`,
    askingPrice: 1_000_000 + i * 50_000,
    relationship: "same_node_comp",
    confidence: "medium",
    includeInSummary: true,
    listingRole: "comparable_evidence",
    savedAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-02T00:00:00Z",
  }));
}
