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

describe("PropertyIntelligenceReport view (source-level)", () => {
  const source = readFileSync(
    resolve(__dirname, "../../../components/property/ErfResearchDossier.tsx"),
    "utf8",
  );

  it("wires a print action using window.print", () => {
    expect(source).toContain("window.print()");
    expect(source).toContain("Print / Save PDF");
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
    relationship: "nearby",
    confidence: "medium",
    includeInSummary: true,
    listingRole: "nearby_comp",
    savedAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-02T00:00:00Z",
  }));
}
