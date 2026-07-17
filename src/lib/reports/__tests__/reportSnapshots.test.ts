import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clearReportSnapshots,
  compareReportSnapshots,
  readReportSnapshots,
  reportSnapshotStorageKey,
  saveReportSnapshot,
  snapshotFingerprint,
  type ReportSnapshot,
} from "../reportSnapshots";

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
    expect(saved).toHaveLength(1);
    expect(readReportSnapshots("parcel-1", s)[0].parcelId).toBe("parcel-1");
  });

  it("does not store identical consecutive snapshots and caps history at 10", () => {
    const s = storage();
    const first = snapshot();
    saveReportSnapshot(first, s);
    saveReportSnapshot({ ...first, savedAt: "2026-07-17T10:02:00Z" }, s);
    expect(readReportSnapshots("parcel-1", s)).toHaveLength(1);

    for (let i = 0; i < 12; i += 1) {
      saveReportSnapshot(
        snapshot({
          savedAt: `2026-07-17T11:${String(i).padStart(2, "0")}:00Z`,
          decision: { confidencePercent: 40 + i },
        }),
        s,
      );
    }
    expect(readReportSnapshots("parcel-1", s)).toHaveLength(10);
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
        snapshot({ market: { evidenceIds: ["evidence-1"], evidenceConfidence: [{ id: "evidence-1", confidence: "low" }] } }),
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
        snapshot({ market: { evidenceIds: ["subject-1"], evidenceConfidence: [{ id: "subject-1", confidence: "high" }] } }),
      ),
    ).toContainEqual({ type: "removed", label: "Market evidence removed" });
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
      decision: { missingInformation: [...previous.decision.missingInformation].reverse() },
      documents: { assets: [...previous.documents.assets].reverse() },
    });
    expect(compareReportSnapshots(previous, current).changes).toEqual([]);
    expect(snapshotFingerprint(previous)).toBe(snapshotFingerprint(snapshot()));
  });

  it("does not persist Ask Easy Erf questions, answers, or cross-parcel assets and does not add migrations", () => {
    const source = readFileSync(resolve(__dirname, "../reportSnapshots.ts"), "utf8");
    expect(JSON.stringify(snapshot())).not.toMatch(/question|answer|Ask Easy Erf/i);
    expect(source).toContain(".filter((asset) => asset.parcel_id === parcelId)");
    expect(source).toContain("report.site.selectedDesign?.parcel_id === parcelId");
    const migrationNames = readdirSync(resolve(__dirname, "../../../../supabase/migrations"));
    expect(migrationNames.filter((name) => /report[-_]?snapshot|change[-_]?tracking/i.test(name))).toEqual([]);
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
