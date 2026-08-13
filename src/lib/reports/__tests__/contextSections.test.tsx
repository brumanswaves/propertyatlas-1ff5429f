import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildLocationLifestyleSectionModel,
  buildMunicipalServicesSectionModel,
  buildSiteRiskSectionModel,
} from "@/lib/reports/contextSections";
import { buildSgSectionModel } from "@/lib/reports/sgSection";
import {
  ReportContextSection,
  ReportMunicipalSection,
  ReportSgLineageSection,
  registerSgPreviewSettlement,
} from "@/components/property/dossier/ReportContextSections";
import type { EvidenceClaim, PropertyEvidencePack } from "@/lib/evidence/propertyEvidenceTypes";
import type { EvidenceAppendixRow } from "@/lib/reports/evidenceAppendix";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

function claim(overrides: Partial<EvidenceClaim>): EvidenceClaim {
  return {
    id: overrides.id ?? "claim-1",
    parcelId: "parcel:erf-1570",
    domain: overrides.domain ?? "environment",
    key: overrides.key ?? "floodRisk",
    label: overrides.label ?? "Flood risk",
    value: overrides.value ?? "Within the 1:100 year flood line",
    nature: "fact",
    status: overrides.status ?? "supported",
    confidence: overrides.confidence ?? "high",
    confidenceReason: "read from document",
    sourceIds: overrides.sourceIds ?? ["asset-flood"],
    locators: overrides.locators ?? [{ pageNumber: 3 }],
    userConfirmed: overrides.userConfirmed ?? false,
    excluded: overrides.excluded ?? false,
    unit: overrides.unit ?? null,
    normalizedValue: overrides.normalizedValue,
  } as EvidenceClaim;
}

function pack(claims: EvidenceClaim[]): PropertyEvidencePack {
  return { claims, sources: [], parcelId: "parcel:erf-1570" } as unknown as PropertyEvidencePack;
}

describe("site risk section model", () => {
  it("keeps unknown checks unknown and never renders a clearance", () => {
    const model = buildSiteRiskSectionModel({ pack: null });
    expect(model.supportedCount).toBe(0);
    expect(model.facts.every((fact) => fact.value === null)).toBe(true);
    expect(model.headline).toMatch(/No physical constraint has been established/);
    expect(model.note).toMatch(/Unknown is not the same as cleared/);
    expect(model.missingChecks.length).toBeGreaterThan(0);

    const html = renderToStaticMarkup(
      <ReportContextSection
        anchorId="report-site-risk"
        eyebrow="Site, Environmental & Physical Risk"
        title="Physical and environmental conditions supported by evidence"
        model={model}
      />,
    );
    expect(html).toContain('id="report-site-risk"');
    expect(html).toContain("Not established");
    expect(html).not.toMatch(/no risk identified|risk cleared/i);
  });

  it("surfaces the highest recorded constraint from evidence only", () => {
    const model = buildSiteRiskSectionModel({
      pack: pack([claim({ key: "floodRisk", value: "Partially within the 1:100 flood line" })]),
    });
    expect(model.supportedCount).toBe(1);
    expect(model.headline).toContain("Flood risk");
    expect(model.facts.find((f) => f.id === "flood")?.source).toBe("document");
  });
});

describe("municipal services section model", () => {
  it("never shows R0 and refuses to estimate a monthly cost without monthly inputs", () => {
    const model = buildMunicipalServicesSectionModel({
      pack: pack([
        claim({ id: "c-rates", domain: "valuation", key: "ratesAmount", label: "Rates", value: 0 }),
        claim({
          id: "c-value",
          domain: "valuation",
          key: "municipalValue",
          label: "Municipal value",
          value: 1250000,
        }),
      ]),
    });
    expect(model.facts.find((f) => f.id === "rates")?.value).toBeNull();
    expect(model.facts.find((f) => f.id === "municipal-valuation")?.value).toMatch(/^R 1.250.000$/);
    expect(model.monthlyEstimate).toBeNull();

    const html = renderToStaticMarkup(
      <ReportMunicipalSection anchorId="report-municipal" model={model} />,
    );
    expect(html).toContain('id="report-municipal"');
    expect(html).not.toContain("R 0");
  });

  it("only totals amounts the source itself states as monthly", () => {
    const model = buildMunicipalServicesSectionModel({
      pack: pack([
        claim({
          id: "c-rates",
          domain: "valuation",
          key: "ratesAmount",
          label: "Rates per month",
          value: 1200,
        }),
        claim({
          id: "c-levies",
          domain: "valuation",
          key: "levies",
          label: "Estate levy",
          value: 900,
        }),
      ]),
    });
    expect(model.monthlyEstimate?.value).toMatch(/^R 1.200$/);
    expect(model.monthlyEstimate?.basis).toMatch(/partial figure/);
  });
});

describe("location & lifestyle section model", () => {
  it("separates official, listing and user-confirmed context and invents no distances", () => {
    const model = buildLocationLifestyleSectionModel({
      pack: null,
      identity: {
        marketAddressLine: "24 Padrone Crescent",
        municipality: "Kouga",
        province: "Eastern Cape",
        coordinates: { lng: 24.83, lat: -34.17 },
      },
      subjectListing: null,
    });
    expect(model.facts.find((f) => f.id === "address")?.source).toBe("user_confirmed");
    expect(model.facts.find((f) => f.id === "area")?.source).toBe("official");
    for (const fact of model.facts.filter((f) => f.id.startsWith("distance-"))) {
      expect(fact.value).toBeNull();
      expect(fact.provenance).toMatch(/does not estimate/);
    }
  });
});

describe("SG lineage section model", () => {
  const rows: EvidenceAppendixRow[] = [
    {
      id: "row-sg-1",
      name: "sg-diagram-1496.tif",
      category: "Surveyor-General diagram",
      providerType: "Surveyor-General",
      readState: "parent_plan_context",
      readLabel: "Parent General Plan matched — context only",
      scope: "parent_plan_context",
      pageLocator: "page 1",
      detail: null,
      assetId: "asset-sg-1",
      url: null,
    },
  ];

  it("labels parent-plan context and exposes filenames and lineage", () => {
    const model = buildSgSectionModel({
      appendixRows: rows,
      pack: pack([
        claim({
          id: "c-gp",
          domain: "identity",
          key: "generalPlanNumber",
          label: "General plan",
          value: "GP12252",
        }),
        claim({
          id: "c-parent",
          domain: "identity",
          key: "parentErfNumber",
          label: "Parent erf",
          value: "1496",
        }),
      ]),
    });
    expect(model.files).toHaveLength(1);
    expect(model.hasParentContext).toBe(true);
    expect(model.contextNote).toMatch(/parent-plan context/i);
    expect(model.lineage.map((row) => row.value)).toContain("GP12252");

    const html = renderToStaticMarkup(
      <ReportSgLineageSection anchorId="report-sg-evidence" model={model} />,
    );
    expect(html).toContain("sg-diagram-1496.tif");
    expect(html).toContain("GP12252");
    expect(html).toContain("Parent-plan context");
  });

  it("shows an honest empty state with no diagram evidence", () => {
    const model = buildSgSectionModel({ appendixRows: [], pack: null });
    expect(model.emptyMessage).toMatch(/No Surveyor-General diagram/);
    expect(model.hasParentContext).toBe(false);
  });

  it("keeps the SG empty state when only another searchable vault document exists", () => {
    const paidReport = {
      id: "asset-paid-report",
      asset_category: "paid_report",
      metadata: { extractionStatus: "ready", identityMatchStatus: "matched" },
    } as unknown as ErfAsset;
    const model = buildSgSectionModel({ appendixRows: [], pack: null, assets: [paidReport] });

    expect(model.emptyMessage).toMatch(/No Surveyor-General diagram has been read/);
    expect(model.evidence).toHaveLength(0);
  });

  it("registers each SG signed-preview settlement with report print preparation", async () => {
    let resolveSettlement: (() => void) | undefined;
    const settlement = new Promise<void>((resolve) => {
      resolveSettlement = resolve;
    });
    const register = vi.fn();

    registerSgPreviewSettlement(register, settlement);

    expect(register).toHaveBeenCalledWith(settlement);
    resolveSettlement?.();
    await expect(settlement).resolves.toBeUndefined();
  });

  it("shows stored SG findings as scoped visual evidence without upgrading identity", () => {
    const sgAsset = {
      id: "asset-sg-readable",
      user_id: "user-1",
      parcel_id: "parcel:erf-1570",
      asset_category: "sg_diagram",
      asset_type: "sg_diagram",
      source_label: "Surveyor-General",
      storage_bucket: "erf-files",
      storage_path: "user-1/parcel:erf-1570/sg_diagram/asset/readable.tif",
      original_file_name: "readable-sg-test-fixture.tif",
      mime_type: "image/tiff",
      size_bytes: 100,
      checksum_sha256: null,
      status: "ready",
      metadata: {
        extractionStatus: "partial",
        identityMatchStatus: "unverified",
        identityBinding: "user_confirmed",
        identityUserConfirmedParcelId: "parcel:erf-1570",
        extractionSummary: "The document shows a cadastral diagram reference.",
        extractedClaims: [
          {
            label: "General plan number",
            value: "GP12252",
            scope: "parent_plan",
            confidence: "medium",
          },
        ],
      },
      local_migration_fingerprint: null,
      created_at: "2026-08-12T08:00:00.000Z",
      updated_at: "2026-08-12T08:00:00.000Z",
    } as unknown as ErfAsset;
    const model = buildSgSectionModel({ appendixRows: [], pack: null, assets: [sgAsset] });
    expect(model.evidence).toHaveLength(1);
    expect(model.evidence[0]?.isUserConfirmed).toBe(true);
    expect(model.evidence[0]?.findings[0]?.scope).toBe("parent_plan");

    const html = renderToStaticMarkup(
      <ReportSgLineageSection anchorId="report-sg-evidence" model={model} />,
    );
    expect(html).toContain("What Easy Erf found");
    expect(html).toContain("Easy Erf read this document, but it has not been automatically bound to this erf.");
    expect(html).toContain("parent context");
    expect(html).toContain("No visual preview was generated for this diagram.");
    expect(html).toContain("The document shows a cadastral diagram reference.");
  });

  it("selects the strongest subject SG diagram for the report and leaves supporting plans in the appendix", () => {
    const subjectDiagram = {
      id: "asset-subject-sg",
      parcel_id: "parcel:erf-1570",
      asset_category: "sg_diagram",
      original_file_name: "subject-erf-1570.tif",
      updated_at: "2026-08-13T10:00:00.000Z",
      metadata: {
        extractionStatus: "ready",
        identityMatchStatus: "matched",
        extractionSummary: "Individual diagram for the selected erf.",
        extractedClaims: [],
      },
    } as unknown as ErfAsset;
    const parentPlan = {
      id: "asset-parent-plan",
      parcel_id: "parcel:erf-1570",
      asset_category: "sg_diagram",
      original_file_name: "general-plan-12252.tif",
      updated_at: "2026-08-13T11:00:00.000Z",
      metadata: {
        extractionStatus: "ready",
        identityMatchStatus: "parent_lineage_match",
        extractionSummary: "Supporting parent General Plan.",
        extractedClaims: [],
      },
    } as unknown as ErfAsset;

    const model = buildSgSectionModel({
      appendixRows: [],
      pack: null,
      assets: [parentPlan, subjectDiagram],
    });
    expect(model.evidence.map((block) => block.asset.id)).toEqual(["asset-subject-sg"]);
    expect(model.supportingDiagramCount).toBe(1);

    const html = renderToStaticMarkup(
      <ReportSgLineageSection anchorId="report-sg-evidence" model={model} />,
    );
    expect(html).toContain("subject-erf-1570.tif");
    expect(html).not.toContain("general-plan-12252.tif");
    expect(html).toContain("additional readable SG diagram");
  });

  it("does not admit a wrong-property SG diagram into the report summary", () => {
    const wrongPropertyDiagram = {
      id: "asset-wrong-sg",
      parcel_id: "parcel:erf-1570",
      asset_category: "sg_diagram",
      original_file_name: "other-property.tif",
      updated_at: "2026-08-13T11:00:00.000Z",
      metadata: {
        extractionStatus: "ready",
        identityMatchStatus: "mismatch",
        extractedClaims: [{ label: "Erf", value: "999", scope: "subject", confidence: "high" }],
      },
    } as unknown as ErfAsset;

    const model = buildSgSectionModel({ appendixRows: [], pack: null, assets: [wrongPropertyDiagram] });
    expect(model.evidence).toHaveLength(0);
    expect(model.emptyMessage).toMatch(/No Surveyor-General diagram has been read/);
  });
});
