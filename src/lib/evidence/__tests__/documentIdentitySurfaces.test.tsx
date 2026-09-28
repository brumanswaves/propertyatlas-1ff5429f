import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
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
