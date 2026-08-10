import { describe, expect, it } from "vitest";
import {
  readLocalMarketEvidenceUserData,
  writeLocalMarketEvidenceUserData,
} from "@/features/marketEvidence/hooks/useSavedMarketEvidence";
import {
  readStoredPlanningZone,
  writeStoredPlanningZone,
} from "@/lib/planning/storedPlanningZone";
import {
  readReportDecisionMode,
  writeReportDecisionMode,
} from "@/lib/reports/reportDecisionMode";
import {
  readStoredBuildEnvelopeInputs,
  writeStoredBuildEnvelopeInputs,
} from "@/lib/sitePotential/buildEnvelopeStore";
import {
  readSitePotentialStrategyDraft,
  sitePotentialStrategyDraftStorageKey,
} from "@/lib/sitePotential/sitePotentialStrategyDraftStore";
import {
  readStoredStreetFrontageDetection,
  writeStoredStreetFrontageDetection,
} from "@/lib/sitePotential/streetFrontageStore";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("browser parcel state account isolation", () => {
  it("keeps market evidence private to the signed-in account and restores it for its owner", () => {
    const storage = memoryStorage();
    writeLocalMarketEvidenceUserData("erf-1570", { savedMarketEvidence: [{ id: "a-comp" }] }, "user-a", storage);

    expect(readLocalMarketEvidenceUserData("erf-1570", "user-b", storage)).toEqual({});
    expect(readLocalMarketEvidenceUserData("erf-1570", "user-a", storage)).toEqual({
      savedMarketEvidence: [{ id: "a-comp" }],
    });
  });

  it("does not let planning, envelope, or frontage overrides cross accounts", () => {
    const storage = memoryStorage();
    writeStoredPlanningZone("erf-1570", "Residential Zone I", "user-a", storage);
    writeStoredBuildEnvelopeInputs("erf-1570", { maxCoveragePercent: 50 }, "user-a", storage);
    writeStoredStreetFrontageDetection(
      "erf-1570",
      { edgeIndex: 2, roadName: "Harbour Road", confidence: 0.92, method: "map_road_match" },
      storage,
      "user-a",
    );

    expect(readStoredPlanningZone("erf-1570", "user-b", storage)).toBeNull();
    expect(readStoredBuildEnvelopeInputs("erf-1570", "user-b", storage)).toBeNull();
    expect(readStoredStreetFrontageDetection("erf-1570", storage, "user-b")).toBeNull();
    expect(readStoredPlanningZone("erf-1570", "user-a", storage)).toBe("Residential Zone I");
    expect(readStoredBuildEnvelopeInputs("erf-1570", "user-a", storage)).toEqual({
      maxCoveragePercent: 50,
    });
    expect(readStoredStreetFrontageDetection("erf-1570", storage, "user-a")).toMatchObject({
      edgeIndex: 2,
      roadName: "Harbour Road",
    });
  });

  it("does not silently claim anonymous records after sign-in", () => {
    const storage = memoryStorage();
    writeStoredPlanningZone("erf-1570", "Anonymous zone", null, storage);
    storage.setItem(
      sitePotentialStrategyDraftStorageKey("erf-1570", null),
      JSON.stringify({ source: "site-potential", conceptTitle: "Anonymous concept" }),
    );

    expect(readStoredPlanningZone("erf-1570", "user-a", storage)).toBeNull();
    expect(readSitePotentialStrategyDraft("erf-1570", "user-a", storage)).toBeNull();
    expect(readStoredPlanningZone("erf-1570", null, storage)).toBe("Anonymous zone");
  });

  it("keeps the Site Potential strategy draft and report decision preference account-scoped", () => {
    const storage = memoryStorage();
    storage.setItem(
      sitePotentialStrategyDraftStorageKey("erf-1570", "user-a"),
      JSON.stringify({ source: "site-potential", conceptTitle: "User A concept" }),
    );
    writeReportDecisionMode("erf-1570", "investor", storage, "user-a");

    expect(readSitePotentialStrategyDraft("erf-1570", "user-b", storage)).toBeNull();
    expect(readReportDecisionMode("erf-1570", storage, "user-b")).toBe("standard");
    expect(readSitePotentialStrategyDraft("erf-1570", "user-a", storage)).toMatchObject({
      conceptTitle: "User A concept",
    });
    expect(readReportDecisionMode("erf-1570", storage, "user-a")).toBe("investor");
  });
});
