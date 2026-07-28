import { describe, expect, it } from "vitest";
import {
  buildReportActions,
  buildReportFindings,
  isPositiveFindingStatus,
  nextBestAction,
  weakestConfidence,
} from "../reportFindings";
import {
  buildEvidencePackFixture,
  evidenceAsset,
  evidenceMarket,
  evidenceParcel,
} from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";

/** A matched, ready document carrying structured extracted claims. */
function documentWithClaims(
  overrides: Partial<ErfAsset>,
  claims: Record<string, unknown>[],
  metadata: Record<string, unknown> = {},
): ErfAsset {
  return evidenceAsset({
    mime_type: "application/pdf",
    asset_type: "pdf",
    status: "ready",
    ...overrides,
    metadata: {
      extractionStatus: "ready",
      identityMatchStatus: "matched",
      extractedText: "Matched document for erf 1021.",
      extractedClaims: claims,
      ...metadata,
    },
  });
}

const LIGHTSTONE = documentWithClaims(
  {
    id: "asset-lightstone",
    asset_category: "paid_report",
    source_label: "Lightstone Property Report",
    original_file_name: "lightstone-erf-1021.pdf",
  },
  [
    {
      domain: "ownership",
      key: "registeredOwner",
      label: "Registered owner",
      value: "J A DU PLESSIS",
      page: 2,
      quote: "Registered owner: J A DU PLESSIS",
    },
    {
      domain: "ownership",
      key: "coOwners",
      label: "Co-owner",
      value: "M E DU PLESSIS",
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
);

function findingById(pack: ReturnType<typeof buildEvidencePackFixture>, id: string) {
  const finding = buildReportFindings(pack).find((item) => item.id === id);
  expect(finding, `expected finding ${id} to exist`).toBeDefined();
  return finding!;
}

describe("weakest confidence matrix", () => {
  it("returns the weakest confidence of every combination", () => {
    const c = (confidence: string) => ({ confidence }) as never;
    expect(weakestConfidence([c("high"), c("low")])).toBe("low");
    expect(weakestConfidence([c("medium"), c("unverified")])).toBe("unverified");
    expect(weakestConfidence([c("high")])).toBe("high");
    expect(weakestConfidence([])).toBe("unverified");
  });
});

describe("every finding is linked to evidence", () => {
  it("links each finding to at least one claim, source, gap or contradiction", () => {
    const pack = buildEvidencePackFixture({ assets: [LIGHTSTONE] });
    for (const finding of buildReportFindings(pack)) {
      const links =
        finding.claimIds.length +
        finding.sourceIds.length +
        finding.gapIds.length +
        finding.contradictionIds.length;
      expect(links, `finding ${finding.id} has no evidence link`).toBeGreaterThan(0);
    }
  });
});

describe("action ordering", () => {
  const pack = buildEvidencePackFixture();
  const findings = buildReportFindings(pack);
  const actions = buildReportActions(pack, findings);

  it("orders blocking-high before high before medium before low", () => {
    const priorities = actions.map((action) => action.priority);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
  });

  it("breaks priority ties deterministically by id", () => {
    for (let i = 1; i < actions.length; i += 1) {
      if (actions[i].priority === actions[i - 1].priority) {
        expect(actions[i - 1].id.localeCompare(actions[i].id)).toBeLessThanOrEqual(0);
      }
    }
    const repeat = buildReportActions(
      buildEvidencePackFixture(),
      buildReportFindings(buildEvidencePackFixture()),
    );
    expect(repeat.map((a) => a.id)).toEqual(actions.map((a) => a.id));
  });

  it("changes the next best action when the top canonical item disappears", () => {
    const first = nextBestAction(actions);
    expect(first).toBeTruthy();
    const reduced = {
      ...pack,
      contradictions: pack.contradictions.filter(
        (item) => !first!.contradictionIds.includes(item.id),
      ),
      gaps: pack.gaps.filter((item) => !first!.gapIds.includes(item.id)),
    };
    const nextActions = buildReportActions(reduced, buildReportFindings(reduced));
    expect(nextBestAction(nextActions)?.id).not.toBe(first!.id);
  });
});

describe("servitude safety", () => {
  it("does not turn Servitudes / SG positive for an unrelated title condition", () => {
    const pack = buildEvidencePackFixture({
      assets: [
        documentWithClaims(
          {
            id: "asset-deed",
            asset_category: "paid_report",
            source_label: "Deeds report",
            original_file_name: "deeds.pdf",
          },
          [
            {
              domain: "deeds",
              key: "conditionsOfTitle",
              label: "Conditions of title",
              value: "Subject to the conditions contained in Deed of Transfer T2574/2024.",
              page: 4,
            },
          ],
        ),
      ],
    });
    // A generic title condition may not even raise the category, and it may
    // certainly never make it positive.
    const finding = buildReportFindings(pack).find((item) => item.id === "finding-servitudes-sg");
    expect(finding ? isPositiveFindingStatus(finding.status) : false).toBe(false);
  });

  it("does not turn Servitudes / SG positive for a stored diagram alone", () => {
    const pack = buildEvidencePackFixture({
      assets: [evidenceAsset({ id: "asset-sg-only", asset_category: "sg_diagram" })],
    });
    expect(isPositiveFindingStatus(findingById(pack, "finding-servitudes-sg").status)).toBe(false);
  });

  it("does not accept parent General Plan context as clearance for this erf", () => {
    const pack = buildEvidencePackFixture({
      assets: [
        documentWithClaims(
          {
            id: "asset-gp",
            asset_category: "sg_diagram",
            source_label: "General Plan GP12252",
            original_file_name: "gp12252.pdf",
          },
          [
            {
              domain: "planning",
              key: "servitudes",
              label: "Servitudes",
              value: "2m municipal servitude along the eastern boundary",
              scope: "parent_plan",
              page: 1,
            },
          ],
          {
            identityMatchStatus: "parent_lineage_match",
            documentLineage: { parentErfNumber: "1496", generalPlanReference: "GP12252" },
          },
        ),
      ],
    });
    expect(isPositiveFindingStatus(findingById(pack, "finding-servitudes-sg").status)).toBe(false);
  });

  it("supports Servitudes / SG for an explicit subject servitude in a matched paid report", () => {
    const pack = buildEvidencePackFixture({
      assets: [
        documentWithClaims(
          {
            id: "asset-deed-servitude",
            asset_category: "paid_report",
            source_label: "Deeds report",
            original_file_name: "deeds.pdf",
          },
          [
            {
              domain: "deeds",
              key: "servitudes",
              label: "Servitudes",
              value: "Erf 1021 is subject to a 2m municipal sewer servitude along the east boundary.",
              page: 5,
            },
          ],
        ),
      ],
    });
    expect(findingById(pack, "finding-servitudes-sg").status).toBe("supported");
  });
});

describe("buildings and plans quality", () => {
  it("stays check-needed for an uploaded architectural plan alone", () => {
    const pack = buildEvidencePackFixture({
      assets: [
        evidenceAsset({
          id: "asset-plan",
          asset_category: "architectural_plan",
          original_file_name: "house-plans.pdf",
          metadata: {},
        }),
      ],
    });
    const finding = findingById(pack, "finding-buildings-plans");
    expect(isPositiveFindingStatus(finding.status)).toBe(false);
    expect(finding.status).toBe("not_checked");
  });

  it("cannot be turned positive by an AI Site Potential concept", () => {
    const findings = buildReportFindings(buildEvidencePackFixture());
    const buildings = findings.find((item) => item.id === "finding-buildings-plans");
    expect(buildings ? isPositiveFindingStatus(buildings.status) : false).toBe(false);
    const sitePotential = findings.find((item) => item.id === "finding-site-potential");
    expect(sitePotential).toBeDefined();
    // Site Potential stays its own finding and is never treated as approved
    // building evidence.
    expect(isPositiveFindingStatus(sitePotential!.status)).toBe(false);
    expect(sitePotential!.id).not.toBe("finding-buildings-plans");
  });

  it("is supported for a matched municipal approved-plan document", () => {
    const pack = buildEvidencePackFixture({
      assets: [
        documentWithClaims(
          {
            id: "asset-municipal",
            asset_category: "official_document",
            source_label: "Kouga Local Municipality building plan record",
            original_file_name: "approved-plans.pdf",
          },
          [
            {
              domain: "planning",
              key: "approvedBuildingPlans",
              label: "Approved building plans",
              value: "Plan 2019/431 approved 12 March 2019",
              page: 1,
            },
            {
              domain: "planning",
              key: "occupancyCertificate",
              label: "Occupancy certificate",
              value: "Issued 4 August 2019",
              page: 2,
            },
          ],
        ),
      ],
    });
    expect(findingById(pack, "finding-buildings-plans").status).toBe("supported");
  });
});

describe("canonical area discrepancy", () => {
  const extentDoc = documentWithClaims(
    {
      id: "asset-extent",
      asset_category: "paid_report",
      source_label: "Deeds report",
      original_file_name: "deeds.pdf",
    },
    [
      {
        domain: "identity",
        key: "registeredExtent",
        label: "Registered extent",
        value: "860 m²",
        numericValue: 860,
        unit: "m2",
        page: 1,
      },
    ],
  );

  it("records the discrepancy once in the canonical pack and keeps both values", () => {
    const pack = buildEvidencePackFixture({
      parcel: evidenceParcel(),
      assets: [extentDoc],
    });
    const contradiction = pack.contradictions.find(
      (item) => item.id === "official-area-vs-registered-extent",
    );
    expect(contradiction).toBeDefined();
    const official = pack.claims.find((c) => c.domain === "identity" && c.key === "areaM2");
    const extent = pack.claims.find((c) => c.domain === "identity" && c.key === "registeredExtent");
    expect(official?.normalizedValue).toBe(900);
    expect(extent?.normalizedValue).toBe(860);
    expect(official?.excluded).toBe(false);
    expect(extent?.excluded).toBe(false);
  });

  it("links the report finding to the canonical contradiction", () => {
    const pack = buildEvidencePackFixture({ assets: [extentDoc] });
    const finding = findingById(pack, "finding-area-discrepancy");
    expect(finding.contradictionIds).toContain("official-area-vs-registered-extent");
    expect(finding.status).toBe("conflicting");
  });

  it("produces a reconciliation action with surveyor or conveyancer context", () => {
    const pack = buildEvidencePackFixture({ assets: [extentDoc] });
    const actions = buildReportActions(pack, buildReportFindings(pack));
    const action = actions.find((item) =>
      item.contradictionIds.includes("official-area-vs-registered-extent"),
    );
    expect(action).toBeDefined();
    expect(action!.professionalType).toMatch(/surveyor|conveyancer/i);
    expect(action!.targetTab.length).toBeGreaterThan(0);
  });

  it("drops the action when the discrepancy disappears", () => {
    const pack = buildEvidencePackFixture({ assets: [] });
    const actions = buildReportActions(pack, buildReportFindings(pack));
    expect(
      actions.some((item) => item.contradictionIds.includes("official-area-vs-registered-extent")),
    ).toBe(false);
    expect(
      buildReportFindings(pack).some((item) => item.id === "finding-area-discrepancy"),
    ).toBe(false);
  });
});

describe("weak evidence can never become supported", () => {
  it("does not treat duplicate listing saves as market breadth", () => {
    const duplicate = (id: string) =>
      evidenceMarket({ id, sourceUrl: "https://www.property24.com/listing/1" });
    const pack = buildEvidencePackFixture({
      savedMarketEvidence: [duplicate("m1"), duplicate("m2"), duplicate("m3")],
    });
    const market = buildReportFindings(pack).find((item) => item.category === "market");
    expect(market).toBeDefined();
    expect(isPositiveFindingStatus(market!.status)).toBe(false);
  });

  it("does not let user notes establish planning controls", () => {
    const pack = buildEvidencePackFixture({ parcel: evidenceParcel({ rawProperties: {} }) });
    const planning = buildReportFindings(pack).find((item) => item.category === "planning");
    expect(planning).toBeDefined();
    expect(isPositiveFindingStatus(planning!.status)).toBe(false);
  });
});
