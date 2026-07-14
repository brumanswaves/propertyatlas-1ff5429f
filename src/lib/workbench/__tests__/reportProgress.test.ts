import { describe, expect, it } from "vitest";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { createEmptyErfWorkspaceState } from "../erfWorkspaceState";
import { buildReportActionCards, buildReportBuilderProgress } from "../reportProgress";

const parcel: Pick<
  NormalizedOfficialParcel,
  "erfNumber" | "portion" | "lpi" | "parcelKey" | "knownFields" | "missingFields"
> = {
  erfNumber: "962",
  portion: "0",
  lpi: "C03400140000096200000",
  parcelKey: "E108C034001400000962000000",
  knownFields: [{ label: "Erf number", value: "962", source: "CSG" }],
  missingFields: ["Ownership", "Valuation"],
};

describe("reportProgress", () => {
  it("derives report rows from real workspace state and saved evidence count", () => {
    const rows = buildReportBuilderProgress({
      parcel,
      workspaceState: {
        ...createEmptyErfWorkspaceState(),
        identityStatus: "looks_correct",
        openedSourceIds: ["csg-property-viewer", "deeds-registry-guidance"],
        reviewedSourceIds: ["csg-property-viewer"],
        marketEvidenceStarted: true,
        calculatorStarted: true,
      },
      savedMarketEvidenceCount: 2,
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Identity", status: "Done" }),
        expect.objectContaining({
          label: "Sources",
          status: "Done",
          evidence: "2 opened / 1 reviewed / 0 SG files",
        }),
        expect.objectContaining({
          label: "Site",
          status: "Not started",
          evidence: "Property state not set",
        }),
        expect.objectContaining({ label: "Market", status: "Done", evidence: "2 saved comps" }),
        expect.objectContaining({ label: "Strategy", status: "In progress" }),
        expect.objectContaining({ label: "Report", status: "Not started" }),
      ]),
    );
  });

  it("counts SG diagram attachments, market address and saved strategy scenarios as workflow progress", () => {
    const rows = buildReportBuilderProgress({
      parcel,
      workspaceState: {
        ...createEmptyErfWorkspaceState(),
        identityStatus: "checked",
        sgDiagramAttachmentCount: 2,
        sitePotential: {
          ...createEmptyErfWorkspaceState().sitePotential,
          selectedDesignAssetId: "asset-123",
          conceptCount: 6,
          progressState: "design_selected",
        },
        marketAddressSaved: true,
        strategyScenarioCount: 1,
      },
      savedMarketEvidenceCount: 0,
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Sources",
          status: "Done",
          evidence: "0 opened / 0 reviewed / 2 SG files",
        }),
        expect.objectContaining({
          label: "Market",
          status: "Done",
          evidence: "Market address saved",
        }),
        expect.objectContaining({
          label: "Site",
          status: "Done",
          evidence: "6 concepts generated, 1 selected",
        }),
        expect.objectContaining({
          label: "Strategy",
          status: "Done",
          evidence: "1 saved scenario",
        }),
        expect.objectContaining({ label: "Report", status: "Needs evidence" }),
      ]),
    );
  });

  it("marks report actions as real tab CTAs rather than decorative cards", () => {
    const actions = buildReportActionCards({
      parcel,
      workspaceState: {
        ...createEmptyErfWorkspaceState(),
        identityStatus: "checked",
        reviewedSourceIds: ["csg-property-viewer"],
      },
      savedMarketEvidenceCount: 0,
    });

    expect(actions.map((action) => action.title)).toEqual([
      "Verify the erf",
      "Add evidence",
      "Run numbers",
      "Create report",
    ]);
    expect(actions.find((action) => action.id === "evidence")).toMatchObject({
      action: "Add market evidence",
      tab: "listings",
      primary: true,
    });
    expect(actions.find((action) => action.id === "report")).toMatchObject({
      action: "Open Site Potential",
      tab: "site-potential",
      primary: false,
    });
    expect(JSON.stringify(actions)).not.toMatch(/fake|screenshot|auto-fill/i);
  });

  it("keeps Site Potential after strategy and before the Easy Erf Report", () => {
    const rows = buildReportBuilderProgress({
      parcel,
      workspaceState: {
        ...createEmptyErfWorkspaceState(),
        identityStatus: "checked",
        reviewedSourceIds: ["csg-property-viewer"],
        marketEvidenceStarted: true,
        strategyScenarioCount: 1,
      },
      savedMarketEvidenceCount: 1,
    });

    expect(rows.map((row) => row.id)).toEqual([
      "identity",
      "sources",
      "market",
      "strategy",
      "site",
      "report",
    ]);

    const actions = buildReportActionCards({
      parcel,
      workspaceState: {
        ...createEmptyErfWorkspaceState(),
        identityStatus: "checked",
        reviewedSourceIds: ["csg-property-viewer"],
        marketEvidenceStarted: true,
        strategyScenarioCount: 1,
      },
      savedMarketEvidenceCount: 1,
    });

    expect(actions.find((action) => action.id === "report")).toMatchObject({
      action: "Open Site Potential",
      tab: "site-potential",
      primary: true,
    });
  });
});
