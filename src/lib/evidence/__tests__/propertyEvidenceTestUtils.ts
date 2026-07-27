import { buildPropertyEvidencePack } from "../buildPropertyEvidencePack";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type {
  MarketAddressIntelligence,
  SavedMarketEvidence,
} from "@/features/marketEvidence/types";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import {
  createEmptyErfWorkspaceState,
  createEmptyStrategyWorkspace,
  type ErfStrategyScenario,
} from "@/lib/workbench/erfWorkspaceState";
import type { PropertyNotes } from "@/lib/workbench/propertyNotes";

export const EVIDENCE_TEST_NOW = new Date("2026-07-23T10:00:00Z");

export function evidenceParcel(
  overrides: Partial<NormalizedOfficialParcel> = {},
): NormalizedOfficialParcel {
  return {
    id: "parcel-a",
    source: "kouga-sg",
    sourceLabel: "Kouga SG Properties",
    layer: "csg-parcels",
    erfNumber: 1021,
    portion: 0,
    lpi: "C03400140000102100000",
    parcelKey: "E108C034001400001021000000",
    objectId: 1021,
    municipality: "Kouga Local Municipality",
    province: "Eastern Cape",
    suburbOrArea: "Sea Vista",
    town: "St Francis Bay",
    coordinates: { lng: 24.831, lat: -34.151 },
    knownFields: [{ label: "Erf", value: "1021", source: "Kouga SG Properties" }],
    missingFields: [],
    rawProperties: {
      SHAPE_Area: 900,
      AREA_M2: 900,
      ZONING: "Residential 1",
      COVERAGE: "50%",
      FAR: "0.8",
    },
    ...overrides,
  } as NormalizedOfficialParcel;
}

export function evidenceWorkspace(
  overrides: Partial<ReturnType<typeof createEmptyErfWorkspaceState>> = {},
) {
  return {
    ...createEmptyErfWorkspaceState(),
    updatedAt: "2026-07-20T08:00:00Z",
    ...overrides,
  };
}

export function evidenceAsset(overrides: Partial<ErfAsset> = {}): ErfAsset {
  return {
    id: "asset-sg",
    user_id: "user-1",
    parcel_id: "parcel-a",
    asset_category: "sg_diagram",
    asset_type: "pdf",
    source_label: "SG diagram",
    storage_bucket: "erf-files",
    storage_path: "erf-files/parcel-a/sg.pdf",
    original_file_name: "sg-diagram.pdf",
    mime_type: "application/pdf",
    size_bytes: 1200,
    checksum_sha256: "abc",
    status: "ready",
    metadata: {
      extractionStatus: "ready",
      identityMatchStatus: "matched",
      extractedText: "SG diagram shows erf 1021 boundary and survey information.",
      pageNumber: 2,
      signedUrl: "https://signed.example/volatile",
    },
    local_migration_fingerprint: null,
    created_at: "2026-07-19T08:00:00Z",
    updated_at: "2026-07-19T09:00:00Z",
    ...overrides,
  };
}

export function evidenceMarket(
  overrides: Partial<SavedMarketEvidence> = {},
): SavedMarketEvidence {
  return {
    id: "market-1",
    parcelId: "parcel-a",
    sourceUrl: "https://www.property24.com/listing/1",
    sourcePortal: "Property24",
    title: "Comparable listing",
    askingPrice: 1_200_000,
    propertyType: "Vacant land",
    beds: null,
    baths: null,
    garages: 0,
    parkingSpaces: 2,
    landSizeM2: 910,
    buildingSizeM2: null,
    relationship: "same_suburb_comp",
    confidence: "medium",
    includeInSummary: true,
    listingRole: "comparable_evidence",
    importedListing: {
      listingId: "117377049",
      canonicalUrl: "https://www.property24.com/for-sale/st-francis-bay/117377049",
      importedAt: "2026-07-21T08:00:00Z",
      fetchedAt: "2026-07-21T07:59:00Z",
      contentHash: "content-hash",
      listingDate: "2026-07-01",
      warnings: ["Address hidden by portal"],
      missingFields: ["erfNumber"],
      matchStatus: "user_review_required",
      matchReasons: ["Suburb alone is not enough to match an erf"],
      userConfirmedAttachment: false,
    },
    notes: "Good local comparable.",
    savedAt: "2026-07-21T08:00:00Z",
    updatedAt: "2026-07-21T08:10:00Z",
    ...overrides,
  };
}

export function evidenceScenario(
  overrides: Partial<ErfStrategyScenario> = {},
): ErfStrategyScenario {
  return {
    id: "scenario-a",
    parcelId: "parcel-a",
    label: "Development to sell",
    strategy: "development_sell",
    inputs: { landCost: "1200000", buildCost: "2500000" },
    summary: [{ label: "Projected profit", value: "R 300 000" }],
    selected: true,
    savedAt: "2026-07-22T08:00:00Z",
    updatedAt: "2026-07-22T09:00:00Z",
    ...overrides,
  };
}

export function evidenceNotes(overrides: Partial<PropertyNotes> = {}): PropertyNotes {
  return {
    parcelId: "parcel-a",
    personal: "Inspect access road.",
    pros: "Near amenities.",
    cons: "Slope unknown.",
    questions: "Confirm building line?",
    agentContact: "Agent Name",
    municipality: "Need planning desk check.",
    renovation: "",
    checklist: { visited: true },
    createdAt: "2026-07-18T08:00:00Z",
    updatedAt: "2026-07-18T09:00:00Z",
    ...overrides,
  };
}

export function evidenceAddress(
  overrides: Partial<MarketAddressIntelligence> = {},
): MarketAddressIntelligence {
  return {
    selectedAddressId: "addr-1",
    candidates: [
      {
        id: "addr-1",
        formattedAddress: "8 Harbour Road, St Francis Bay",
        municipality: "Kouga Local Municipality",
        province: "Eastern Cape",
        lat: -34.151,
        lng: 24.831,
        source: "user_entered",
        confidence: "high",
        reason: "User confirmed the working market address.",
        createdAt: "2026-07-20T09:00:00Z",
        updatedAt: "2026-07-20T10:00:00Z",
      },
      {
        id: "addr-2",
        formattedAddress: "Approximate St Francis Bay address",
        municipality: "Kouga Local Municipality",
        province: "Eastern Cape",
        lat: -34.15,
        lng: 24.83,
        source: "google_reverse_geocode",
        confidence: "low",
        reason: "Approximate reverse geocode candidate.",
        createdAt: "2026-07-20T09:05:00Z",
      },
    ],
    userConfirmedAddress: {
      id: "addr-1",
      formattedAddress: "8 Harbour Road, St Francis Bay",
      municipality: "Kouga Local Municipality",
      province: "Eastern Cape",
      lat: -34.151,
      lng: 24.831,
      source: "user_entered",
      confidence: "high",
      reason: "User confirmed the working market address.",
      createdAt: "2026-07-20T09:00:00Z",
      updatedAt: "2026-07-20T10:00:00Z",
    },
    lastResolvedAt: "2026-07-20T10:00:00Z",
    ...overrides,
  };
}

export function buildEvidencePackFixture(
  overrides: Partial<Parameters<typeof buildPropertyEvidencePack>[0]> = {},
) {
  const scenario = evidenceScenario();
  const selectedDesign = evidenceAsset({
    id: "asset-design",
    asset_category: "generated_design",
    original_file_name: "concept.png",
    mime_type: "image/png",
    metadata: { conceptName: "Courtyard duplex", rationale: "Uses access and north light." },
  });
  const strategyWorkspace = {
    ...createEmptyStrategyWorkspace("parcel-a"),
    activeStrategy: "development_sell",
    draftInputs: { landCost: "1200000" },
    draftUpdatedAt: "2026-07-22T07:00:00Z",
    scenarios: [scenario],
    chosenScenarioId: scenario.id,
    chosenScenarioUpdatedAt: scenario.updatedAt ?? scenario.savedAt,
  };
  return buildPropertyEvidencePack({
    parcel: evidenceParcel(),
    workspaceState: evidenceWorkspace({ identityStatus: "checked" }),
    researchSources: [],
    savedMarketEvidence: [evidenceMarket()],
    marketAddressIntelligence: evidenceAddress(),
    assets: [evidenceAsset(), selectedDesign],
    propertyNotes: evidenceNotes(),
    strategyWorkspace,
    strategyScenarios: [scenario],
    chosenScenario: scenario,
    selectedSiteDesign: selectedDesign,
    now: EVIDENCE_TEST_NOW,
    ...overrides,
  });
}
