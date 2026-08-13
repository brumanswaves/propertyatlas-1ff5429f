import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildReportViewModel,
  REPORT_SECTIONS,
  type BuildReportInput,
} from "@/lib/reports/buildReportViewModel";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import { buildParcelPlanningAssessment } from "@/lib/planning/parcelPlanningAssessment";

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

function reportAsset(overrides: Partial<ErfAsset> = {}): ErfAsset {
  return {
    id: "asset-1",
    user_id: "user-1",
    parcel_id: "parcel:erf-224",
    asset_category: "sg_diagram",
    asset_type: "survey_pdf",
    source_label: "Survey document",
    storage_bucket: "erf-files",
    storage_path: "user-1/parcel:erf-224/sg_diagram/asset-1/document-123.pdf",
    original_file_name: "document-123.pdf",
    mime_type: "application/pdf",
    size_bytes: 12345,
    checksum_sha256: "sha256-asset",
    status: "ready",
    metadata: {},
    local_migration_fingerprint: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildReportViewModel", () => {
  it("does not fabricate an owner when no ownership evidence is present", () => {
    const vm = buildReportViewModel(baseInput());
    expect(vm.ownership.hasUploadedReport).toBe(false);
    expect(vm.ownership.isVerified).toBe(false);
    expect(vm.ownership.message).toMatch(/not verified/i);
    expect(vm.ownership.message).not.toMatch(/uploaded but not readable/i);
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

  it("does not treat a selected address candidate as confirmed report identity", () => {
    const vm = buildReportViewModel(
      baseInput({
        marketAddress: {
          selectedAddressId: "addr-1",
          candidates: [
            {
              id: "addr-1",
              formattedAddress: "Selected only address",
              municipality: "Kouga",
              source: "google_reverse_geocode",
              confidence: "medium",
              reason: "reverse geocode",
              createdAt: "2026-01-01T00:00:00Z",
            },
          ],
        },
      }),
    );

    expect(vm.identity.marketAddressLine).toBeNull();
    expect(
      vm.evidencePack?.claims.find((claim) => claim.id === "claim-address-addr-1-marketAddress"),
    ).toMatchObject({
      status: "not_reviewed",
      userConfirmed: false,
    });
  });

  it("keeps a user-confirmed zoning conclusion distinct from planning assumptions", () => {
    const planningAssessment = buildParcelPlanningAssessment({
      parcelId: "parcel:erf-224",
      municipality: "Kouga Local Municipality",
      locationHints: ["Sea Vista"],
      erfAreaM2: 987,
      manualZoneCode: "RES1",
      userConfirmedZoneCode: "RES1",
      hasParcelPolygon: true,
      now: new Date("2026-08-13T10:00:00Z"),
    });
    const vm = buildReportViewModel(baseInput({ planningAssessment }));

    expect(vm.planning.find((field) => field.label === "Zoning")).toMatchObject({
      value: "Residential Zone 1 (single residential)",
      badge: "user_confirmed",
    });
    expect(vm.planning.find((field) => field.label === "Coverage %")?.badge).toBe("assumption");
  });

  it("uses canonical pack values for planning labels, market, documents, strategy and site", () => {
    const savedEvidence = buildEvidence(3);
    const chosenScenario = {
      id: "scenario-1",
      parcelId: "parcel:erf-224",
      label: "Development to sell",
      strategy: "development_sell",
      inputs: { landCost: "1000000" },
      summary: [{ label: "Profit", value: "R 10" }],
      selected: true,
      savedAt: "2026-01-01T00:00:00Z",
    };
    const vm = buildReportViewModel(
      baseInput({
        workspaceState: {
          ...createEmptyErfWorkspaceState(),
          chosenScenarioId: "scenario-1",
          sitePotential: {
            ...createEmptyErfWorkspaceState().sitePotential,
            selectedDesignAssetId: "design-1",
            conceptCount: 1,
          },
        },
        savedEvidence,
        chosenScenario,
        strategyScenarios: [chosenScenario],
        assets: [
          {
            id: "design-1",
            user_id: "user-1",
            parcel_id: "parcel:erf-224",
            asset_category: "generated_design",
            asset_type: "image",
            source_label: "Concept",
            storage_bucket: "erf-files",
            storage_path: "concept.png",
            original_file_name: "concept.png",
            mime_type: "image/png",
            size_bytes: 10,
            checksum_sha256: null,
            status: "ready",
            metadata: {},
            local_migration_fingerprint: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        selectedSiteDesign: {
          id: "design-1",
          user_id: "user-1",
          parcel_id: "parcel:erf-224",
          asset_category: "generated_design",
          asset_type: "image",
          source_label: "Concept",
          storage_bucket: "erf-files",
          storage_path: "concept.png",
          original_file_name: "concept.png",
          mime_type: "image/png",
          size_bytes: 10,
          checksum_sha256: null,
          status: "ready",
          metadata: {},
          local_migration_fingerprint: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      }),
    );

    const planningLabels = vm.planning.map((field) => field.label).join(" | ");
    expect(vm.planning.find((field) => field.label === "Erf size (m²)")?.value).toBe("987");
    expect(planningLabels).not.toContain("\u00c2");
    expect(planningLabels).not.toContain("\u00c3");
    expect(planningLabels).not.toContain("\ufffd");
    expect(planningLabels).not.toContain("\u00ef\u00bf\u00bd");
    expect(vm.market.evidenceCount).toBe(3);
    expect(vm.documents.assetCount).toBe(1);
    expect(vm.strategy.chosen?.id).toBe("scenario-1");
    expect(vm.site.selectedDesign?.id).toBe("design-1");
  });

  it("keeps report Strategy chosen scenario parcel-scoped", () => {
    const validScenario = {
      id: "scenario-current",
      parcelId: "parcel:erf-224",
      label: "Current parcel scenario",
      strategy: "development_sell",
      inputs: { landCost: "1000000" },
      summary: [{ label: "Profit", value: "R 100" }],
      selected: true,
      savedAt: "2026-01-01T00:00:00Z",
    };
    const foreignScenario = {
      ...validScenario,
      id: "scenario-foreign",
      parcelId: "parcel:other",
      label: "Foreign parcel scenario",
    };

    const vm = buildReportViewModel(
      baseInput({
        workspaceState: {
          ...createEmptyErfWorkspaceState(),
          chosenScenarioId: validScenario.id,
        },
        strategyScenarios: [validScenario],
        chosenScenario: foreignScenario,
      }),
    );

    expect(vm.strategy.chosen?.id).toBe(validScenario.id);
    expect(vm.strategy.chosen?.parcelId).toBe("parcel:erf-224");
    expect(vm.strategy.chosen?.id).not.toBe(foreignScenario.id);
  });

  it("rejects a cross-parcel chosen scenario instead of leaking it through valid Strategy claims", () => {
    const validScenario = {
      id: "scenario-valid",
      parcelId: "parcel:erf-224",
      label: "Valid but not chosen",
      strategy: "development_sell",
      inputs: { landCost: "1000000" },
      summary: [{ label: "Profit", value: "R 100" }],
      selected: false,
      savedAt: "2026-01-01T00:00:00Z",
    };
    const foreignScenario = {
      ...validScenario,
      id: "scenario-foreign",
      parcelId: "parcel:other",
      label: "Foreign chosen scenario",
      selected: true,
    };

    const vm = buildReportViewModel(
      baseInput({
        strategyScenarios: [validScenario],
        chosenScenario: foreignScenario,
      }),
    );

    expect(vm.strategy.chosen).toBeNull();
    expect(vm.strategy.scenarioCount).toBe(1);
  });

  it("keeps scenario IDs containing input or summary separators intact", () => {
    const trickyScenario = {
      id: "deal-input-keeper-summary-final",
      parcelId: "parcel:erf-224",
      label: "Tricky ID scenario",
      strategy: "development_sell",
      inputs: { landCost: "1000000" },
      summary: [{ label: "Profit", value: "R 100" }],
      selected: true,
      savedAt: "2026-01-01T00:00:00Z",
    };

    const vm = buildReportViewModel(
      baseInput({
        workspaceState: {
          ...createEmptyErfWorkspaceState(),
          chosenScenarioId: trickyScenario.id,
        },
        strategyScenarios: [trickyScenario],
        chosenScenario: trickyScenario,
      }),
    );

    expect(vm.strategy.chosen?.id).toBe("deal-input-keeper-summary-final");
    expect(vm.strategy.scenarioCount).toBe(1);
  });

  it("derives document counts from structured asset metadata categories", () => {
    const vm = buildReportViewModel(
      baseInput({
        assets: [
          reportAsset({
            id: "4f47dd8a-bd52-4f20-b455-e3563b147ba0",
            asset_category: "sg_diagram",
            source_label: "Survey document",
            original_file_name: "document-123.pdf",
          }),
          reportAsset({
            id: "paid-1",
            asset_category: "paid_report",
            source_label: "Lightstone report",
            original_file_name: "lightstone.pdf",
          }),
          reportAsset({
            id: "deed-1",
            asset_category: "title_deed",
            source_label: "Title deed",
            original_file_name: "deed.pdf",
          }),
        ],
      }),
    );

    expect(vm.documents.assetCount).toBe(3);
    expect(vm.documents.sgDiagramCount).toBe(1);
    expect(vm.documents.uploadedReportCount).toBe(1);
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
    expect(ids).toContain("report-sg-evidence");
    expect(ids).toContain("report-documents");
    for (const id of ids) expect(id.startsWith("report-")).toBe(true);
  });
});

describe("PropertyIntelligenceReport view (source-level)", () => {
  // The report UI is split across the dossier and its extracted, testable
  // presentation primitives, so source-level checks read both.
  const source = [
    readFileSync(resolve(__dirname, "../../../components/property/ErfResearchDossier.tsx"), "utf8"),
    readFileSync(
      resolve(__dirname, "../../../components/property/dossier/ReportEvidenceUi.tsx"),
      "utf8",
    ),
    readFileSync(
      resolve(__dirname, "../../../components/property/dossier/ReportOpening.tsx"),
      "utf8",
    ),
  ].join("\n");

  const styles = readFileSync(resolve(__dirname, "../../../styles.css"), "utf8");
  const lifecycleSource = readFileSync(resolve(__dirname, "../reportPrintLifecycle.ts"), "utf8");

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
    expect(source).not.toContain("setTimeout(() => cleanup(), 600)");
    expect(lifecycleSource).toContain('frameWindow.addEventListener("afterprint"');
    expect(lifecycleSource).toContain('frameWindow.matchMedia?.("print")');
    expect(lifecycleSource).toContain("printMediaEntered = true");
    expect(lifecycleSource).toContain("now() - printStartedAt >= focusMinimumHoldMs");
    expect(
      readFileSync(
        resolve(process.cwd(), "src/components/property/dossier/ReportOpening.tsx"),
        "utf8",
      ),
    ).toContain("Print / Save PDF");
  });

  it("renders the Phase 2 Executive Decision Brief from decision intelligence", () => {
    expect(source).toContain("buildDecisionIntelligence(report)");
    expect(source).toContain("Decision snapshot");
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
    expect(source.replace(/\s+/g, " ")).toContain(
      "property-quality score, valuation confidence, or purchase recommendation",
    );
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

  it("renders section anchor targets that match REPORT_SECTIONS", () => {
    for (const s of REPORT_SECTIONS) {
      const rendered =
        source.includes(`id="${s.anchorId}"`) || source.includes(`anchorId="${s.anchorId}"`);
      expect(rendered, `missing anchor for ${s.anchorId}`).toBe(true);
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
