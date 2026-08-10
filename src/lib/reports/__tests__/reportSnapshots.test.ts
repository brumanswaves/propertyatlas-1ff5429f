import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildReportSnapshot,
  clearReportSnapshots,
  compareReportSnapshots,
  readReportSnapshots,
  reportSnapshotStorageKey,
  saveReportSnapshot,
  snapshotFingerprint,
  snapshotsForActiveParcel,
  type ReportSnapshotState,
  type ReportSnapshot,
} from "../reportSnapshots";
import type { DecisionIntelligence } from "../buildDecisionIntelligence";
import type { ReportViewModel } from "../buildReportViewModel";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import type { ErfStrategyScenario } from "@/lib/workbench/erfWorkspaceState";
import { writeReportDecisionMode } from "../reportDecisionMode";

function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

type SnapshotOverrides = Partial<
  Omit<
    ReportSnapshot,
    "identity" | "decision" | "market" | "documents" | "sitePotential" | "strategy"
  >
> & {
  identity?: Partial<ReportSnapshot["identity"]>;
  decision?: Partial<ReportSnapshot["decision"]>;
  market?: Partial<ReportSnapshot["market"]>;
  documents?: Partial<ReportSnapshot["documents"]>;
  sitePotential?: Partial<ReportSnapshot["sitePotential"]>;
  strategy?: Partial<ReportSnapshot["strategy"]>;
};

function snapshot(overrides: SnapshotOverrides = {}): ReportSnapshot {
  const base: ReportSnapshot = {
    schemaVersion: 1,
    parcelId: "parcel-1",
    reportGeneratedAt: "2026-07-17T10:00:00Z",
    savedAt: "2026-07-17T10:01:00Z",
    identity: {
      parcelId: "parcel-1",
      erfNumber: "1021",
      portion: "0",
      lpi: "LPI-1021",
      parcelKey: "KEY-1021",
      municipality: "Kouga",
      province: "Eastern Cape",
      marketAddressLine: "8 Harbour Road",
      areaM2: 721,
    },
    decision: {
      verdict: "investigate_further",
      confidencePercent: 52,
      categories: [
        { id: "identity", label: "Identity", score: 100, state: "confirmed" },
        { id: "market", label: "Market", score: 60, state: "partial" },
      ],
      contradictions: [{ id: "address-mismatch", severity: "high" }],
      risks: [{ id: "market-weak", severity: "medium" }],
      missingInformation: ["Confirm ownership", "Add comps"],
    },
    market: {
      evidenceCount: 2,
      includedCount: 1,
      evidence: [
        {
          id: "evidence-1",
          confidence: "medium",
          includeInSummary: true,
          listingRole: "comparable_evidence",
        },
        {
          id: "subject-1",
          confidence: "high",
          includeInSummary: false,
          listingRole: "subject_active_listing",
        },
      ],
      evidenceIds: ["evidence-1", "subject-1"],
      evidenceConfidence: [
        { id: "evidence-1", confidence: "medium" },
        { id: "subject-1", confidence: "high" },
      ],
      subjectListingId: "subject-1",
      strongestComparableIds: ["evidence-1"],
      indicativeMedianAskingPrice: null,
      latestMarketEvidenceAt: "2026-07-17T09:00:00Z",
    },
    documents: {
      assetCount: 2,
      uploadedReportCount: 1,
      sgDiagramCount: 1,
      assets: [
        { id: "asset-lightstone", category: "paid_report" },
        { id: "asset-sg", category: "sg_diagram" },
      ],
    },
    sitePotential: {
      selectedConceptAssetId: null,
      conceptCount: 0,
      skipped: false,
    },
    strategy: {
      chosenScenarioId: null,
      scenarioCount: 0,
    },
  };
  return {
    ...base,
    ...overrides,
    identity: { ...base.identity, ...overrides.identity },
    decision: { ...base.decision, ...overrides.decision },
    market: { ...base.market, ...overrides.market },
    documents: { ...base.documents, ...overrides.documents },
    sitePotential: { ...base.sitePotential, ...overrides.sitePotential },
    strategy: { ...base.strategy, ...overrides.strategy },
  };
}

function changedTypes(previous: ReportSnapshot, current: ReportSnapshot) {
  return compareReportSnapshots(previous, current).changes.map((change) => ({
    type: change.type,
    label: change.label,
  }));
}

function evidence(overrides: Partial<SavedMarketEvidence> = {}): SavedMarketEvidence {
  return {
    id: "evidence-1",
    parcelId: "parcel-1",
    sourceUrl: "https://example.test/listing",
    sourcePortal: "Property24",
    title: "Saved comp",
    askingPrice: 1_000_000,
    propertyType: "House",
    relationship: "same_suburb_comp",
    confidence: "medium",
    includeInSummary: true,
    listingRole: "comparable_evidence",
    notes: "Short note",
    savedAt: "2026-07-17T08:00:00Z",
    updatedAt: "2026-07-17T09:00:00Z",
    ...overrides,
  };
}

function scenario(overrides: Partial<ErfStrategyScenario> = {}): ErfStrategyScenario {
  return {
    id: "scenario-1",
    parcelId: "parcel-1",
    label: "Buy and hold",
    strategy: "buy_hold",
    inputs: {},
    summary: [{ label: "Yield", value: "8%" }],
    selected: true,
    savedAt: "2026-07-17T09:00:00Z",
    ...overrides,
  };
}

function report(overrides: Partial<ReportViewModel> = {}): ReportViewModel {
  return {
    parcelId: "parcel-1",
    generatedAt: "2026-07-17T10:00:00Z",
    identity: {
      displayName: "Erf 1021",
      officialLine: "Erf 1021 / Kouga",
      marketAddressLine: "8 Harbour Road",
      addressAndOfficialMismatch: false,
      municipality: "Kouga",
      province: "Eastern Cape",
      erfNumber: "1021",
      portion: "0",
      lpi: "LPI-1021",
      parcelKey: "KEY-1021",
      sourceLabel: "Kouga SG Properties",
      coordinates: { lng: 24.8, lat: -34.1 },
      areaM2: 721,
      registeredExtent: null,
      cadastral: [],
    },
    ownership: {
      hasUploadedReport: false,
      uploadedReportNames: [],
      isVerified: false,
      owners: [],
      titleDeed: [],
      state: "missing",
      message: "Not verified",
    },
    planning: [],
    market: {
      evidenceCount: 0,
      includedCount: 0,
      subjectListing: null,
      strongest: [],
      summary: {
        totalEvidence: 0,
        includedEvidence: 0,
        relationshipMix: {},
        confidenceMix: {},
        hasUsablePriceData: false,
      },
      canShowIndicativeValue: false,
      askingCount: 0,
      soldCount: 0,
      latestUpdatedAt: null,
    },
    site: {
      selectedDesign: null,
      conceptCount: 0,
      skipped: false,
      hasBrief: false,
      disclaimer: "Not an architectural plan.",
    },
    strategy: {
      chosen: scenario(),
      scenarioCount: 1,
      hasSaved: true,
    },
    documents: {
      assetCount: 0,
      savedEvidenceCount: 0,
      sgDiagramCount: 0,
      uploadedReportCount: 0,
      completenessPercent: 0,
    },
    risks: [],
    recommendations: [],
    brief: {
      positives: [],
      attention: [],
      nextActions: [],
      readinessPercent: 0,
      categories: [],
    },
    heroImage: null,
    ...overrides,
  };
}

const decision: DecisionIntelligence = {
  verdict: "investigate_further",
  verdictLabel: "Investigate further",
  confidencePercent: 52,
  summary: "Summary",
  confidenceCategories: [
    { id: "identity", label: "Identity", score: 100, state: "confirmed", explanation: "Known" },
  ],
  known: [],
  stillNeeded: ["Add comps"],
  contradictions: [],
  immediateActions: [],
  matrix: [],
  timeline: [],
};

const assets: ErfAsset[] = [];

describe("Easy Erf report snapshots", () => {
  it("supports the first snapshot state and explicit baseline save", () => {
    const panel = readFileSync(
      resolve(__dirname, "../../../components/property/ErfResearchDossier.tsx"),
      "utf8",
    );
    expect(panel).toContain("No previous report snapshot has been saved for this property.");
    expect(panel).toContain("Save current report snapshot");

    const s = storage();
    expect(readReportSnapshots("parcel-1", s)).toEqual([]);
    const saved = saveReportSnapshot(snapshot(), s);
    expect(saved.saved).toBe(true);
    expect(saved.snapshots).toHaveLength(1);
    expect(readReportSnapshots("parcel-1", s)[0].parcelId).toBe("parcel-1");
  });

  it("does not store identical consecutive snapshots and caps history at 10", () => {
    const s = storage();
    const first = snapshot();
    saveReportSnapshot(first, s);
    const duplicate = saveReportSnapshot({ ...first, savedAt: "2026-07-17T10:02:00Z" }, s);
    expect(duplicate.saved).toBe(false);
    expect(readReportSnapshots("parcel-1", s)).toHaveLength(1);

    for (let i = 0; i < 12; i += 1) {
      const result = saveReportSnapshot(
        snapshot({
          savedAt: `2026-07-17T11:${String(i).padStart(2, "0")}:00Z`,
          decision: { confidencePercent: 40 + i },
        }),
        s,
      );
      if (i === 11) expect(result.saved).toBe(true);
    }
    const history = readReportSnapshots("parcel-1", s);
    expect(history).toHaveLength(10);
    expect(history[0].decision.confidencePercent).toBe(51);
    expect(history.at(-1)?.decision.confidencePercent).toBe(42);
  });

  it("isolates snapshot history per parcel and handles malformed or unsupported data safely", () => {
    const s = storage();
    saveReportSnapshot(snapshot(), s);
    saveReportSnapshot(snapshot({ parcelId: "parcel-2", identity: { parcelId: "parcel-2" } }), s);
    expect(readReportSnapshots("parcel-1", s)).toHaveLength(1);
    expect(readReportSnapshots("parcel-2", s)).toHaveLength(1);

    s.setItem(reportSnapshotStorageKey("bad"), "{not-json");
    expect(readReportSnapshots("bad", s)).toEqual([]);
    s.setItem(reportSnapshotStorageKey("parcel-1"), JSON.stringify([{ ...snapshot(), schemaVersion: 999 }]));
    expect(readReportSnapshots("parcel-1", s)).toEqual([]);
  });

  it("keeps report snapshots scoped to the signed-in account and restores the owner's history", () => {
    const s = storage();
    saveReportSnapshot(snapshot(), s, "user-a");

    expect(readReportSnapshots("parcel-1", s, "user-b")).toEqual([]);
    expect(readReportSnapshots("parcel-1", s, "user-a")).toHaveLength(1);
    expect(readReportSnapshots("parcel-1", s, null)).toEqual([]);
  });

  it("detects market address additions and changes", () => {
    expect(
      changedTypes(snapshot({ identity: { marketAddressLine: null } }), snapshot()),
    ).toContainEqual({ type: "added", label: "Market address" });
    expect(
      changedTypes(snapshot(), snapshot({ identity: { marketAddressLine: "10 Main Road" } })),
    ).toContainEqual({ type: "changed", label: "Market address" });
  });

  it("detects evidence additions, removals, and confidence changes", () => {
    expect(
      changedTypes(
        snapshot({
          market: {
            evidence: [
              {
                id: "evidence-1",
                confidence: "low",
                includeInSummary: true,
                listingRole: "comparable_evidence",
              },
            ],
            evidenceIds: ["evidence-1"],
            evidenceConfidence: [{ id: "evidence-1", confidence: "low" }],
          },
        }),
        snapshot(),
      ),
    ).toEqual(
      expect.arrayContaining([
        { type: "added", label: "Market evidence added" },
        { type: "changed", label: "Evidence confidence changed" },
      ]),
    );
    expect(
      changedTypes(
        snapshot(),
        snapshot({
          market: {
            evidence: [
              {
                id: "subject-1",
                confidence: "high",
                includeInSummary: false,
                listingRole: "subject_active_listing",
              },
            ],
            evidenceIds: ["subject-1"],
            evidenceConfidence: [{ id: "subject-1", confidence: "high" }],
          },
        }),
      ),
    ).toContainEqual({ type: "removed", label: "Market evidence removed" });
  });

  it("detects non-strongest evidence changes, inclusion changes, role changes, and replacements", () => {
    const weakEvidence = {
      id: "weak-1",
      confidence: "low" as const,
      includeInSummary: false,
      listingRole: "comparable_evidence" as const,
    };
    expect(
      changedTypes(
        snapshot(),
        snapshot({
          market: {
            evidence: [...snapshot().market.evidence, weakEvidence],
            evidenceIds: [...snapshot().market.evidenceIds, "weak-1"],
            evidenceConfidence: [
              ...snapshot().market.evidenceConfidence,
              { id: "weak-1", confidence: "low" },
            ],
            evidenceCount: 3,
          },
        }),
      ),
    ).toContainEqual({ type: "added", label: "Market evidence added" });

    expect(
      changedTypes(
        snapshot(),
        snapshot({
          market: {
            evidence: snapshot().market.evidence.map((item) =>
              item.id === "evidence-1" ? { ...item, includeInSummary: false } : item,
            ),
            includedCount: 0,
          },
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        { type: "changed", label: "Evidence inclusion changed" },
        { type: "changed", label: "Included market evidence count" },
      ]),
    );

    expect(
      changedTypes(
        snapshot(),
        snapshot({
          market: {
            evidence: snapshot().market.evidence.map((item) =>
              item.id === "evidence-1" ? { ...item, listingRole: "market_note" } : item,
            ),
          },
        }),
      ),
    ).toContainEqual({ type: "changed", label: "Evidence role changed" });

    expect(
      changedTypes(
        snapshot({
          market: {
            evidence: [weakEvidence],
            evidenceIds: ["weak-1"],
            evidenceConfidence: [{ id: "weak-1", confidence: "low" }],
            evidenceCount: 1,
          },
        }),
        snapshot({
          market: {
            evidence: [{ ...weakEvidence, id: "weak-2" }],
            evidenceIds: ["weak-2"],
            evidenceConfidence: [{ id: "weak-2", confidence: "low" }],
            evidenceCount: 1,
          },
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        { type: "removed", label: "Market evidence removed" },
        { type: "added", label: "Market evidence added" },
      ]),
    );
  });

  it("builds market snapshots from all current-parcel evidence and excludes other parcels", () => {
    const current = evidence({ id: "current-weak", confidence: "low", includeInSummary: false });
    const subject = evidence({
      id: "subject-current",
      confidence: "high",
      listingRole: "subject_active_listing",
      includeInSummary: false,
    });
    const other = evidence({ id: "other-parcel", parcelId: "parcel-2", confidence: "high" });
    const built = buildReportSnapshot({
      report: report(),
      decision,
      assets,
      savedEvidence: [current, subject, other],
      strategyScenarios: [scenario()],
      savedAt: "2026-07-17T10:01:00Z",
    });

    expect(built.market.evidence.map((item) => item.id)).toEqual([
      "current-weak",
      "subject-current",
    ]);
    expect(built.market.evidence).toContainEqual({
      id: "current-weak",
      confidence: "low",
      includeInSummary: false,
      listingRole: "comparable_evidence",
    });
    expect(built.market.subjectListingId).toBe("subject-current");
    expect(JSON.stringify(built)).not.toContain("other-parcel");
    expect(JSON.stringify(built)).not.toContain("https://example.test/listing");
    expect(JSON.stringify(built)).not.toContain("Short note");
  });

  it("builds strategy state only from current-parcel scenarios", () => {
    const built = buildReportSnapshot({
      report: report({
        strategy: {
          chosen: scenario({ id: "other-chosen", parcelId: "parcel-2", selected: true }),
          scenarioCount: 99,
          hasSaved: true,
        },
      }),
      decision,
      assets,
      savedEvidence: [],
      strategyScenarios: [
        scenario({ id: "current-selected", selected: true }),
        scenario({ id: "other-selected", parcelId: "parcel-2", selected: true }),
      ],
      savedAt: "2026-07-17T10:01:00Z",
    });

    expect(built.strategy.chosenScenarioId).toBe("current-selected");
    expect(built.strategy.scenarioCount).toBe(1);
  });

  it("detects risk and contradiction additions, removals, and severity changes", () => {
    expect(
      changedTypes(snapshot({ decision: { risks: [] } }), snapshot()),
    ).toContainEqual({ type: "added", label: "Risk added" });
    expect(
      changedTypes(snapshot(), snapshot({ decision: { risks: [] } })),
    ).toContainEqual({ type: "resolved", label: "Risk removed" });
    expect(
      changedTypes(snapshot(), snapshot({ decision: { risks: [{ id: "market-weak", severity: "high" }] } })),
    ).toContainEqual({ type: "changed", label: "Risk severity changed" });

    expect(
      changedTypes(snapshot({ decision: { contradictions: [] } }), snapshot()),
    ).toContainEqual({ type: "added", label: "Contradiction added" });
    expect(
      changedTypes(snapshot(), snapshot({ decision: { contradictions: [] } })),
    ).toContainEqual({ type: "resolved", label: "Contradiction removed" });
    expect(
      changedTypes(snapshot(), snapshot({ decision: { contradictions: [{ id: "address-mismatch", severity: "low" }] } })),
    ).toContainEqual({ type: "changed", label: "Contradiction severity changed" });
  });

  it("detects missing-information resolution, verdict, confidence, and category score changes", () => {
    expect(
      changedTypes(snapshot(), snapshot({ decision: { missingInformation: ["Add comps"] } })),
    ).toContainEqual({ type: "resolved", label: "Missing information resolved" });
    expect(
      changedTypes(snapshot(), snapshot({ decision: { verdict: "proceed", confidencePercent: 72 } })),
    ).toEqual(
      expect.arrayContaining([
        { type: "changed", label: "Decision verdict" },
        { type: "changed", label: "Decision confidence" },
      ]),
    );
    expect(
      changedTypes(
        snapshot(),
        snapshot({
          decision: {
            categories: [
              { id: "identity", label: "Identity", score: 80, state: "partial" },
              { id: "market", label: "Market", score: 60, state: "partial" },
            ],
          },
        }),
      ),
    ).toContainEqual({ type: "changed", label: "Identity confidence changed" });
  });

  it("detects document, Site Potential, and Strategy changes", () => {
    expect(
      changedTypes(snapshot({ documents: { assets: [] } }), snapshot()),
    ).toContainEqual({ type: "added", label: "Document or file added" });
    expect(
      changedTypes(snapshot(), snapshot({ documents: { assets: [] } })),
    ).toContainEqual({ type: "removed", label: "Document or file removed" });
    expect(
      changedTypes(snapshot(), snapshot({ sitePotential: { selectedConceptAssetId: "concept-1", conceptCount: 1 } })),
    ).toEqual(
      expect.arrayContaining([
        { type: "added", label: "Selected Site Potential concept" },
        { type: "changed", label: "Site Potential concept count" },
      ]),
    );
    expect(
      changedTypes(snapshot(), snapshot({ strategy: { chosenScenarioId: "scenario-1", scenarioCount: 1 } })),
    ).toEqual(
      expect.arrayContaining([
        { type: "added", label: "Selected strategy" },
        { type: "changed", label: "Saved strategy scenario count" },
      ]),
    );
  });

  it("ignores timestamp-only changes and set-like ordering", () => {
    const previous = snapshot();
    const current = snapshot({
      reportGeneratedAt: "2026-07-18T10:00:00Z",
      savedAt: "2026-07-18T10:01:00Z",
      market: { latestMarketEvidenceAt: "2026-07-18T09:00:00Z" },
      decision: { missingInformation: [...previous.decision.missingInformation].reverse() },
      documents: { assets: [...previous.documents.assets].reverse() },
    });
    expect(compareReportSnapshots(previous, current).changes).toEqual([]);
    expect(snapshotFingerprint(previous)).toBe(snapshotFingerprint(snapshot()));
  });

  it("ignores deeply malformed stored snapshots safely", () => {
    const s = storage();
    s.setItem(
      reportSnapshotStorageKey("parcel-1"),
      JSON.stringify([
        { ...snapshot(), decision: { ...snapshot().decision, risks: { id: "bad" } } },
        { ...snapshot(), market: { ...snapshot().market, evidence: "bad" } },
        { ...snapshot(), documents: { ...snapshot().documents, assets: undefined } },
        { ...snapshot(), decision: { ...snapshot().decision, confidencePercent: Number.NaN } },
        { ...snapshot(), market: { ...snapshot().market, evidenceCount: "many" } },
        { ...snapshot(), identity: { ...snapshot().identity, parcelId: "other-parcel" } },
        {
          ...snapshot({ savedAt: "2026-07-17T11:00:00Z" }),
          market: {
            ...snapshot().market,
            evidence: [
              "bad",
              { id: "bad-confidence", confidence: "certain", includeInSummary: true },
              {
                id: "good-evidence",
                confidence: "medium",
                includeInSummary: true,
                listingRole: "comparable_evidence",
              },
            ],
          },
          documents: {
            ...snapshot().documents,
            assets: ["bad", { id: "good-asset", category: "paid_report" }],
          },
        },
      ]),
    );

    const read = readReportSnapshots("parcel-1", s);
    expect(read).toHaveLength(1);
    expect(read[0].market.evidence).toEqual([
      {
        id: "good-evidence",
        confidence: "medium",
        includeInSummary: true,
        listingRole: "comparable_evidence",
      },
    ]);
    expect(read[0].documents.assets).toEqual([{ id: "good-asset", category: "paid_report" }]);
    expect(compareReportSnapshots(read[0], snapshot()).changes.length).toBeGreaterThan(0);
  });

  it("keeps old parcel snapshot state out of a new parcel render", () => {
    const state: ReportSnapshotState = { parcelId: "parcel-1", snapshots: [snapshot()] };
    expect(snapshotsForActiveParcel("parcel-1", state)).toHaveLength(1);
    expect(snapshotsForActiveParcel("parcel-2", state)).toEqual([]);
  });

  it("does not persist Ask Easy Erf questions, answers, or cross-parcel assets and does not add migrations", () => {
    const source = readFileSync(resolve(__dirname, "../reportSnapshots.ts"), "utf8");
    expect(JSON.stringify(snapshot())).not.toMatch(/question|answer|Ask Easy Erf/i);
    expect(source).toContain(".filter((asset) => asset.parcel_id === parcelId)");
    expect(source).toContain("report.site.selectedDesign?.parcel_id === parcelId");
    const migrationNames = readdirSync(resolve(__dirname, "../../../../supabase/migrations"));
    expect(migrationNames.filter((name) => /report[-_]?snapshot|change[-_]?tracking/i.test(name))).toEqual([]);
  });

  it("keeps decision lens preference out of snapshot fingerprints", () => {
    const s = storage();
    const before = snapshotFingerprint(snapshot());
    writeReportDecisionMode("parcel-1", "investor", s as unknown as Storage);
    const after = snapshotFingerprint(snapshot());

    expect(after).toBe(before);
    expect(JSON.stringify(snapshot())).not.toMatch(/decisionLens|investor|standard/i);
  });

  it("renders print-safe controls and explicit clear confirmation copy", () => {
    const panel = readFileSync(
      resolve(__dirname, "../../../components/property/ErfResearchDossier.tsx"),
      "utf8",
    );
    const styles = readFileSync(resolve(__dirname, "../../../styles.css"), "utf8");
    expect(panel).toContain("report-no-print flex flex-wrap gap-2");
    expect(panel).toContain("Clear saved report snapshots for this property?");
    expect(panel).toContain("Yes, clear history");
    expect(panel).not.toContain("window.confirm");
    expect(styles).toContain(".report-change-card");
    expect(styles).toContain(".report-no-print { display: none !important; }");
  });
});
