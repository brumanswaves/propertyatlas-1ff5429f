import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { SharedInvestigationReport } from "@/components/humanReview/SharedInvestigationReport";
import { ReportOwnershipSection } from "@/components/property/dossier/ReportEvidenceUi";
import { assembleInvestigation } from "@/lib/investigation/sharedInvestigation";
import { buildMunicipalServicesSectionModel } from "@/lib/reports/contextSections";
import { ReportEvidenceAppendix } from "@/components/property/dossier/ReportBodySections";
import { GuidedTitleStep } from "@/components/property/investigation/GuidedTitleStep";
import { buildPropertyInvestigation } from "@/lib/investigation/propertyInvestigation";
import { buildReportViewModel } from "@/lib/reports/buildReportViewModel";
import { buildReportFindings } from "@/lib/reports/reportFindings";
import { buildEvidenceAppendixRows } from "@/lib/reports/evidenceAppendix";
import { buildAskEasyErfSelectedEvidencePayload } from "@/lib/reports/askEasyErf";
import {
  evidenceAsset,
  evidenceParcel,
  evidenceWorkspace,
  buildEvidencePackFixture,
} from "./propertyEvidenceTestUtils";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

const vault = vi.hoisted(() => ({
  assets: [] as ErfAsset[],
  signedIn: true,
  loading: false,
  upload: vi.fn(),
  remove: vi.fn(),
  refresh: vi.fn(),
  confirmIdentity: vi.fn(),
  open: vi.fn(),
}));
const extract = vi.hoisted(() => vi.fn());
vi.mock("@/lib/workbench/useErfFileVault", () => ({
  useErfFileVault: () => vault,
  dispatchErfFileVaultUpdated: vi.fn(),
}));
vi.mock("@/lib/workbench/erfAssetExtraction", () => ({ extractErfAsset: extract }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function asset(
  identity = "unverified",
  extraction = "ready",
  confirmed = true,
  overrides: Partial<ErfAsset> = {},
) {
  return evidenceAsset({
    id: "report",
    asset_category: "paid_report",
    ...overrides,
    metadata: {
      extractionStatus: extraction,
      identityMatchStatus: identity,
      ...(confirmed
        ? { identityBinding: "user_confirmed", identityUserConfirmedParcelId: "parcel-a" }
        : {}),
      extractedClaims: [
        {
          domain: "ownership",
          key: "registeredOwner",
          label: "Owner",
          value: "Synthetic owner",
          scope: "subject",
          page: 1,
        },
      ],
      ...overrides.metadata,
    },
  });
}
function surfaces(assets: ErfAsset[], parcel = evidenceParcel()) {
  vault.assets = assets;
  const pack = buildEvidencePackFixture({ assets, parcel });
  const investigation = buildPropertyInvestigation({
    assets,
    parcel,
    workspaceState: evidenceWorkspace(),
  });
  const report = buildReportViewModel({
    assets,
    parcel,
    workspaceState: evidenceWorkspace(),
    savedEvidence: [],
    marketAddress: null,
    chosenScenario: null,
    strategyScenarios: [],
    evidencePack: pack,
  });
  return {
    pack,
    risks: report.risks,
    recommendations: report.recommendations,
    guided: renderToStaticMarkup(
      <GuidedTitleStep parcel={parcel} onContinue={vi.fn()} onOpenPaidReports={vi.fn()} />,
    ),
    investigation: investigation.latestFindings.find((f) => f.id === "finding-paid-report"),
    messages: investigation.messages,
    ownership: buildReportFindings(pack).find((f) => f.id === "finding-ownership")!,
    report: report.ownership,
    appendix: buildEvidenceAppendixRows({ assets, pack }),
    ask: buildAskEasyErfSelectedEvidencePayload({
      pack,
      question: "What ownership evidence is available?",
    }),
  };
}

describe("document identity provenance across Guided and report consumers", () => {
  it.each(["ready", "partial"])(
    "preserves unverified user-attached %s evidence without mutation or extraction",
    (extraction) => {
      const a = asset("unverified", extraction);
      const before = JSON.stringify(a);
      const fetch = vi.fn(() => {
        throw new Error("No network permitted");
      });
      vi.stubGlobal("fetch", fetch);
      const s = surfaces([a]);
      expect(s.guided).toContain("Readable - attached by you");
      expect(s.guided).toContain("Document identity has not been independently matched");
      expect(s.investigation?.title).toBe("Property report attached by user");
      expect(s.ownership.headline).toBe("Ownership details from user-attached evidence");
      expect(s.ownership.whatWeFound).toContain("document identity not independently matched");
      expect(s.report.owners[0].value).toContain("user-attached");
      expect(s.appendix[0].readState).toBe("user_attached");
      const appendix = renderToStaticMarkup(
        <ReportEvidenceAppendix anchorId="evidence" rows={s.appendix} completenessPercent={0} />,
      );
      expect(appendix).toContain("Document identity has not been independently matched");
      expect(JSON.stringify(s.ask)).not.toContain(
        "Ownership details read from an identity-matched report",
      );
      expect(JSON.stringify(a)).toBe(before);
      expect(fetch).not.toHaveBeenCalled();
      expect(extract).not.toHaveBeenCalled();
      for (const fn of [
        vault.upload,
        vault.remove,
        vault.refresh,
        vault.confirmIdentity,
        vault.open,
      ])
        expect(fn).not.toHaveBeenCalled();
    },
  );
  it("uses current matched metadata even when a historical user binding remains", () => {
    const s = surfaces([asset("matched", "ready", true)]);
    expect(s.ownership.headline).toContain("identity-matched");
    expect(s.ownership.whatWeFound).not.toContain("not independently matched");
  });
  it("does not infer a match from a legacy claim without source identity metadata", () => {
    const pack = buildEvidencePackFixture({ assets: [asset("matched", "ready", false)] });
    for (const source of pack.sources) if (source.asset) delete source.asset.identityMatchStatus;
    const finding = buildReportFindings(pack).find((f) => f.id === "finding-ownership")!;
    expect(finding.headline).not.toContain("identity-matched");
    expect(finding.whatWeFound).toContain("document identity not established");
  });
  it("retains a genuine automatic match without certifying ownership", () => {
    const s = surfaces([asset("matched", "ready", false)]);
    expect(s.guided).toContain("Matched and readable");
    expect(s.investigation?.title).toBe("Identity-matched property report on file");
    expect(s.ownership.headline).toContain("identity-matched");
    expect(s.report.isVerified).toBe(false);
  });
  it.each([
    ["unconfirmed", asset("unverified", "ready", false)],
    ["mismatch", asset("mismatch")],
    ["parent context", asset("parent_lineage_match", "ready", false)],
    [
      "wrong binding",
      asset("unverified", "ready", true, {
        metadata: { identityUserConfirmedParcelId: "parcel-b" },
      }),
    ],
    ["unread", asset("unverified", "not_started")],
    ["failed extraction", asset("unverified", "failed")],
    ["archived", asset("matched", "ready", false, { status: "archived" })],
    ["failed asset", asset("matched", "ready", false, { status: "failed" })],
    ["unknown identity", asset("unknown", "ready", false)],
  ])("does not upgrade %s", (_label, a) => {
    const s = surfaces([a as ErfAsset]);
    expect(s.investigation).toBeUndefined();
    expect(s.ownership.headline).not.toContain("identity-matched");
    expect(s.report.owners).toHaveLength(0);
    expect(s.guided).not.toContain("Matched and readable");
  });
  it("does not let a matched document upgrade a second user-attached document", () => {
    const s = surfaces([asset("matched", "ready", false, { id: "matched" }), asset()]);
    expect(s.investigation?.title).toBe("Property report attached by user");
    expect(s.ownership.whatWeFound).toContain("identity-matched source");
    expect(s.ownership.whatWeFound).toContain(
      "user-attached; document identity not independently matched",
    );
    expect(s.report.owners.filter((v) => v.value.includes("user-attached"))).toHaveLength(1);
    expect(s.appendix.filter((r) => r.assetId).map((r) => r.readState)).toEqual([
      "searchable_matched",
      "user_attached",
    ]);
  });
  it("recomputes labels across source removal and selected parcel changes", () => {
    const a = asset();
    expect(surfaces([a]).report.owners).toHaveLength(1);
    const other = surfaces([a], evidenceParcel({ id: "parcel-b" }));
    expect(other.report.owners).toHaveLength(0);
    expect(other.investigation).toBeUndefined();
    expect(other.guided).not.toContain("Synthetic owner");
    expect(surfaces([]).report.owners).toHaveLength(0);
    expect(surfaces([a]).ownership.headline).toContain("user-attached");
  });
});

describe("registered extent warning provenance", () => {
  const extent = (identity: string, extraction = "ready", confirmed = true) =>
    asset(identity, extraction, confirmed, {
      id: "extent-document",
      metadata: {
        extractedClaims: [
          {
            domain: "identity",
            key: "registeredExtent",
            label: "Registered extent",
            value: "600 m2",
            numericValue: 600,
            scope: "subject",
            page: 2,
          },
        ],
      },
    });
  const warningId = "official-area-vs-registered-extent";
  it.each(["ready", "partial"])(
    "keeps %s user-attached extent unverified in canonical risks and recommendations",
    (status) => {
      const assets = [extent("unverified", status)];
      const before = JSON.stringify(assets);
      const s = surfaces(assets);
      const warning = s.pack.contradictions.find((item) => item.id === warningId)!;
      expect(warning.displayedValues).toEqual([
        "Official cadastral area: 900 m2",
        "Registered extent: 600 m2",
      ]);
      expect(warning.explanation).toContain("identity has not been independently matched");
      expect(warning.explanation).not.toContain("a matched document");
      expect(warning.sourceIds.length).toBe(2);
      const claim = s.pack.claims.find((item) => item.key === "registeredExtent")!;
      expect(claim.status).toBe("supported");
      expect(claim.confidence).toBe("unverified");
      expect(warning.sourceIds).toEqual(expect.arrayContaining(claim.sourceIds));
      expect(s.risks.find((item) => item.id === warningId)?.why).toBe(warning.explanation);
      expect(s.recommendations.find((item) => item.id === `rec-${warningId}`)?.detail).toBe(
        warning.explanation,
      );
      expect(warning.nextAction).toContain("land surveyor or conveyancer");
      expect(JSON.stringify(assets)).toBe(before);
    },
  );
  it.each([false, true])(
    "does not borrow identity from an unrelated matched document, reversed=%s",
    (reverse) => {
      const assets = [asset("matched", "ready", false), extent("unverified")];
      const s = surfaces(reverse ? assets.reverse() : assets);
      expect(s.risks.find((item) => item.id === warningId)?.why).toContain(
        "identity has not been independently matched",
      );
      expect(s.recommendations.find((item) => item.id === `rec-${warningId}`)?.detail).toContain(
        "identity has not been independently matched",
      );
    },
  );
  it("keeps genuine extent identity matching distinct from other unverified documents", () => {
    const s = surfaces([asset(), extent("matched", "ready", false)]);
    expect(s.risks.find((item) => item.id === warningId)?.why).toContain(
      "extent document is identity-matched",
    );
  });
  it.each(["mismatch", "parent_lineage_match"])(
    "does not promote %s extent into a subject discrepancy",
    (identity) => {
      const s = surfaces([extent(identity)]);
      expect(s.pack.contradictions.find((item) => item.id === warningId)).toBeUndefined();
    },
  );
});

describe("expanded Ownership and context provenance in the actual report and print renderer", () => {
  const claims = [
    {
      domain: "ownership",
      key: "registeredOwner",
      label: "Owner",
      value: "Synthetic owner",
      scope: "subject",
      page: 1,
    },
    {
      domain: "deeds",
      key: "titleDeedNumber",
      label: "Deed number",
      value: "T123/2026",
      scope: "subject",
      page: 2,
    },
    {
      domain: "valuation",
      key: "municipalValue",
      label: "Municipal value",
      value: "450000",
      numericValue: 450000,
      scope: "subject",
      page: 3,
    },
    {
      domain: "infrastructure",
      key: "waterConnection",
      label: "Water",
      value: "Recorded connection",
      scope: "subject",
      page: 4,
    },
    {
      domain: "ownership",
      key: "ownerIdNumber",
      label: "ID number",
      value: "8001015009087",
      scope: "subject",
      page: 1,
    },
  ];
  const document = (identity: string, extraction = "ready", id = "report") =>
    asset(identity, extraction, identity !== "matched", {
      id,
      original_file_name: `${id}.pdf`,
      metadata: { extractedClaims: claims },
    });
  const cases = [
    { name: "ready", assets: [document("unverified")] },
    { name: "partial", assets: [document("unverified", "partial")] },
    { name: "mixed", assets: [document("matched", "ready", "matched"), document("unverified")] },
    { name: "matched", assets: [document("matched")] },
    {
      name: "deed-only",
      assets: [
        asset("unverified", "ready", true, {
          metadata: { extractedClaims: claims.filter((c) => c.domain === "deeds") },
        }),
      ],
    },
    { name: "legacy", assets: [document("matched")] },
    { name: "empty", assets: [] },
    { name: "mismatch", assets: [document("mismatch")] },
    { name: "excluded", assets: [{ ...document("matched"), status: "archived" as const }] },
  ];
  it.each(cases)(
    "keeps $name headings, body, values, context and print consistent",
    ({ name, assets }) => {
      const before = JSON.stringify(assets);
      const fetch = vi.fn(() => {
        throw new Error("No network permitted");
      });
      vi.stubGlobal("fetch", fetch);
      const parcel = evidenceParcel({ source: "csg" });
      const assembly = assembleInvestigation(
        {
          schemaVersion: 1,
          parcelId: parcel.id,
          revision: 1,
          assets,
          siteProject: null,
          userData: { normalizedParcel: parcel },
        },
        new Date("2026-09-30T10:00:00Z"),
      );
      if (name === "legacy") {
        for (const source of assembly.pack.sources)
          if (source.asset) delete source.asset.identityMatchStatus;
        assembly.report = buildReportViewModel({
          assets,
          parcel,
          workspaceState: evidenceWorkspace(),
          savedEvidence: [],
          marketAddress: null,
          chosenScenario: null,
          strategyScenarios: [],
          evidencePack: assembly.pack,
        });
        assembly.municipal = buildMunicipalServicesSectionModel({ pack: assembly.pack });
      }
      const ownership = assembly.report.ownership;
      const direct = renderToStaticMarkup(<ReportOwnershipSection ownership={ownership} />);
      const normal = renderToStaticMarkup(<SharedInvestigationReport assembly={assembly} />);
      const printable = renderToStaticMarkup(
        <SharedInvestigationReport assembly={assembly} openingControls={{ printOnly: true }} />,
      );
      const populated = !["empty", "mismatch", "excluded"].includes(name);
      for (const html of [direct, normal, printable]) {
        expect(html).toContain(
          populated
            ? "Ownership and deeds evidence; not certified by Easy Erf"
            : "Not verified by Easy Erf",
        );
        expect(html).not.toContain("Read from a matched document");
        expect(html).not.toContain("Only amounts read from an identity-matched document");
        expect(html).toContain("Easy Erf does not certify ownership");
        expect(html).not.toContain("8001015009087");
        for (const detail of [...ownership.owners, ...ownership.titleDeed]) {
          expect(html).toContain(detail.value);
          for (const source of detail.sourceIds) expect(html).toContain(source);
          expect(html).toContain(`page ${detail.pageNumbers.join(", ")}`);
        }
      }
      expect(normal).toContain(direct);
      expect(printable).toContain(direct);
      expect(printable.match(/<details open="" class="report-evidence-details/g)).toHaveLength(6);
      if (populated) {
        expect(ownership.owners.length + ownership.titleDeed.length).toBeGreaterThan(0);
        if (name === "deed-only") {
          expect(ownership.owners).toHaveLength(0);
          expect(direct).toContain("T123/2026");
        } else expect(direct).toContain("Synthetic owner");
        if (["ready", "partial", "mixed", "deed-only"].includes(name))
          expect(direct).toContain("user-attached; document identity not independently matched");
        if (["matched", "mixed"].includes(name))
          expect(direct).toContain("identity-matched source");
        if (name === "legacy") expect(direct).toContain("document identity not established");
      } else {
        expect(ownership.owners).toHaveLength(0);
        expect(ownership.titleDeed).toHaveLength(0);
        expect(direct).not.toContain("Synthetic owner");
      }
      for (const html of [normal, printable]) {
        for (const fact of assembly.municipal.facts.filter((f) => f.value !== null)) {
          expect(html).toContain(fact.value);
          expect(html).toContain(fact.provenance);
          expect(html).toContain("Recorded evidence; check source provenance");
        }
        expect(html).toContain("inclusion does not establish a document identity match");
      }
      if (!["deed-only", "empty", "mismatch", "excluded"].includes(name)) {
        expect(assembly.municipal.facts.filter((f) => f.value !== null)).toHaveLength(2);
        expect(normal).toContain("Recorded connection");
        expect(normal).toContain("page 3");
        expect(normal).toContain("page 4");
      } else
        expect(normal).toContain("No municipal roll value is recorded in the available evidence.");
      expect(JSON.stringify(assets)).toBe(before);
      expect(fetch).not.toHaveBeenCalled();
      expect(extract).not.toHaveBeenCalled();
      for (const fn of [
        vault.upload,
        vault.remove,
        vault.refresh,
        vault.confirmIdentity,
        vault.open,
      ])
        expect(fn).not.toHaveBeenCalled();
      // Optional local-only browser fixture: the actual renderer, no app or provider requests.
      if (process.env.EE_RENDER_EVIDENCE_DIR) {
        mkdirSync(process.env.EE_RENDER_EVIDENCE_DIR, { recursive: true });
        for (const [mode, html] of [
          ["normal", normal],
          ["print", printable],
        ])
          writeFileSync(
            `${process.env.EE_RENDER_EVIDENCE_DIR}/${name}-${mode}.html`,
            `<!doctype html><meta charset="utf-8"><title>Synthetic provenance regression</title>${html}`,
          );
      }
    },
  );
});
