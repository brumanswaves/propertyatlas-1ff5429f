import { KOUGA_PLANNING_REGISTRY as BASE_KOUGA_PLANNING_REGISTRY } from "./kougaPlanningRegistry";
import type {
  MunicipalityPlanningRegistryEntry,
  MunicipalityPlanningSource,
  ZoneDefinition,
  ZoningRule,
} from "./municipalityPlanningTypes";

const VERIFIED_AT = "2026-08-20";
const KOUGA_SCHEME_CITATION = "Chapter 7, clause 24, p. 20";

const KOUGA_LAND_USE_SCHEME_2021: MunicipalityPlanningSource = {
  id: "kouga-land-use-scheme-2021",
  municipality: BASE_KOUGA_PLANNING_REGISTRY.municipality,
  title: "Kouga Land Use Scheme 2021",
  sourceType: "land_use_scheme",
  url: "https://www.kouga.gov.za/download/4539",
  jurisdiction: "municipal",
  status: "active",
  version: "February 2021",
  effectiveDate: null,
  publishedDate: "2021-01-01",
  lastVerifiedAt: VERIFIED_AT,
  planningAreas: [],
  notes:
    "Official Kouga Land Use Scheme retrieved and read on 2026-08-20. Chapter 7 clause 24 publishes Residential Zone 1 primary/consent uses and development parameters. These are general scheme rules only; they do not prove that a specific erf is zoned RES1 or override title conditions, servitudes, departures, overlays or approved plans.",
};

const ST_FRANCIS_BAY_TOWN_ZONING_PLAN: MunicipalityPlanningSource = {
  id: "kouga-st-francis-bay-town-zoning-plan-2020-12",
  municipality: BASE_KOUGA_PLANNING_REGISTRY.municipality,
  title: "Kouga ILUS Town Zoning Plan 6 - St Francis Bay",
  sourceType: "zoning_map",
  url: "https://www.kouga.gov.za/document-library",
  jurisdiction: "municipal",
  status: "active",
  version: "2020-12",
  effectiveDate: null,
  publishedDate: null,
  lastVerifiedAt: VERIFIED_AT,
  planningAreas: ["Sea Vista"],
  notes:
    "Official Kouga document library lists PDF '202 - Kouga ILUS 2020-12 - Town Zoning Plan_6 St Francis Bay.pdf'. Presence re-verified 2026-08-20. Easy Erf has not yet correlated that map to a parcel reliably, so this source must not be used alone to assert a parcel zoning.",
};

const OVER_400_M2 = {
  minExclusiveM2: 400,
} as const;

const UNDER_400_M2 = {
  maxExclusiveM2: 400,
} as const;

const VERIFIED_RES1_RULES: ZoningRule[] = [
  {
    id: "kouga-res1-street-building-line-under-400",
    ruleType: "street_building_line",
    label: "Street building line (< 400 m²)",
    value: 1,
    unit: "m",
    statement: "Residential Zone 1 street building line: 1 m for erven smaller than 400 m².",
    conditions: ["Applies where erf area is less than 400 m²."],
    erfAreaCondition: UNDER_400_M2,
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: KOUGA_SCHEME_CITATION,
    status: "active",
    interpretation:
      "This is a published general scheme parameter for the RES1 size band, not proof that the subject erf is RES1 or that no stricter property-specific restriction applies.",
  },
  {
    id: "kouga-res1-side-building-line-under-400",
    ruleType: "side_building_line",
    label: "Lateral building line (< 400 m²)",
    value: 1,
    unit: "m",
    statement: "Residential Zone 1 lateral building line: 1 m on one boundary for erven smaller than 400 m².",
    conditions: ["Applies where erf area is less than 400 m².", "The scheme table states 1 m on one boundary."],
    erfAreaCondition: UNDER_400_M2,
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: KOUGA_SCHEME_CITATION,
    status: "active",
    interpretation:
      "The published table uses an asymmetric lateral-boundary condition. Easy Erf does not infer which side boundary carries it.",
  },
  {
    id: "kouga-res1-rear-building-line-under-400",
    ruleType: "rear_building_line",
    label: "Rear building line (< 400 m²)",
    value: 1,
    unit: "m",
    statement: "Residential Zone 1 rear building line: 1 m for erven smaller than 400 m².",
    conditions: ["Applies where erf area is less than 400 m²."],
    erfAreaCondition: UNDER_400_M2,
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: KOUGA_SCHEME_CITATION,
    status: "active",
    interpretation:
      "Published general rule only. Confirm survey geometry, title conditions, servitudes and departures before relying on the setback.",
  },
  {
    id: "kouga-res1-coverage-under-400",
    ruleType: "coverage",
    label: "Maximum coverage (< 400 m²)",
    value: 70,
    unit: "percent",
    statement: "Residential Zone 1 maximum coverage: 70% for erven smaller than 400 m².",
    conditions: ["Applies where erf area is less than 400 m²."],
    erfAreaCondition: UNDER_400_M2,
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: KOUGA_SCHEME_CITATION,
    status: "active",
    interpretation:
      "Coverage is a published general maximum for the RES1 size band. Property-specific constraints can reduce the practical buildable footprint.",
  },
  {
    id: "kouga-res1-street-building-line-over-400",
    ruleType: "street_building_line",
    label: "Street building line (> 400 m²)",
    value: 3,
    unit: "m",
    statement: "Residential Zone 1 street building line: 3 m for erven larger than 400 m².",
    conditions: ["Applies where erf area is greater than 400 m²."],
    erfAreaCondition: OVER_400_M2,
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: KOUGA_SCHEME_CITATION,
    status: "active",
    interpretation:
      "Published general rule only. Confirm the actual street edge, survey geometry and property-specific restrictions before applying it spatially.",
  },
  {
    id: "kouga-res1-side-building-line-over-400",
    ruleType: "side_building_line",
    label: "Lateral building lines (> 400 m²)",
    value: 1.5,
    unit: "m",
    statement: "Residential Zone 1 lateral building lines: 1.5 m for erven larger than 400 m².",
    conditions: ["Applies where erf area is greater than 400 m²."],
    erfAreaCondition: OVER_400_M2,
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: KOUGA_SCHEME_CITATION,
    status: "active",
    interpretation:
      "Published general rule only. Title conditions, servitudes, departures or approved plans may change what applies to a specific erf.",
  },
  {
    id: "kouga-res1-rear-building-line-over-400",
    ruleType: "rear_building_line",
    label: "Rear building line (> 400 m²)",
    value: 1.5,
    unit: "m",
    statement: "Residential Zone 1 rear building line: 1.5 m for erven larger than 400 m².",
    conditions: ["Applies where erf area is greater than 400 m²."],
    erfAreaCondition: OVER_400_M2,
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: KOUGA_SCHEME_CITATION,
    status: "active",
    interpretation:
      "Published general rule only. Confirm the rear boundary and property-specific restrictions before relying on it.",
  },
  {
    id: "kouga-res1-coverage-over-400",
    ruleType: "coverage",
    label: "Maximum coverage (> 400 m²)",
    value: 50,
    unit: "percent",
    statement: "Residential Zone 1 maximum coverage: 50% for erven larger than 400 m².",
    conditions: ["Applies where erf area is greater than 400 m²."],
    erfAreaCondition: OVER_400_M2,
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: KOUGA_SCHEME_CITATION,
    status: "active",
    interpretation:
      "Coverage is a published general maximum for the RES1 size band. The resulting footprint is theoretical until property-specific constraints are checked.",
  },
  {
    id: "kouga-res1-height",
    ruleType: "height",
    label: "Maximum height",
    value: 8.5,
    unit: "m",
    statement: "Residential Zone 1 maximum height: 8.5 m.",
    conditions: [],
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: KOUGA_SCHEME_CITATION,
    status: "active",
    interpretation:
      "Published general maximum only. Property-specific departures, title conditions, overlays and approved plans remain separate evidence questions.",
  },
  {
    id: "kouga-res1-dwellings",
    ruleType: "dwelling_units",
    label: "Primary and additional dwelling use",
    value: 1,
    unit: "units",
    statement: "Residential Zone 1 lists a Dwelling Unit as primary use and an Additional Dwelling Unit as a consent use.",
    conditions: ["An Additional Dwelling Unit is listed as a consent use and requires the applicable municipal consent process."],
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: KOUGA_SCHEME_CITATION,
    status: "active",
    interpretation:
      "The scheme supports one primary dwelling use and treats an additional dwelling as consent use. This does not mean consent will be granted for a particular erf.",
  },
];

const VERIFIED_RES1_ZONE: ZoneDefinition = {
  code: "RES1",
  name: "Residential Zone 1",
  municipality: BASE_KOUGA_PLANNING_REGISTRY.municipality,
  permittedUses: ["Dwelling Unit"],
  consentUses: [
    "Additional Dwelling Unit",
    "House Shop",
    "Child Care Facility",
    "Medical Use",
    "Commune",
    "Social Facility",
    "Guest Lodging Facility",
    "Tavern",
    "Home Occupation",
  ],
  rules: VERIFIED_RES1_RULES,
  sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
  status: "active",
  summary:
    "Official Kouga Land Use Scheme 2021 Residential Zone 1 definition. The scheme definition and development parameters are verified general rules; a separate parcel-specific source is still required to prove that an erf is zoned RES1.",
};

/**
 * Adds verified official source artifacts and verified general RES1 scheme
 * rules without upgrading parcel-specific zoning. Automatic zoning detection
 * remains disabled until a dependable official zoning source can be correlated
 * to a parcel reliably.
 */
export const KOUGA_PLANNING_REGISTRY: MunicipalityPlanningRegistryEntry = {
  ...BASE_KOUGA_PLANNING_REGISTRY,
  sources: [
    ...BASE_KOUGA_PLANNING_REGISTRY.sources.filter(
      (source) =>
        source.id !== KOUGA_LAND_USE_SCHEME_2021.id &&
        source.id !== ST_FRANCIS_BAY_TOWN_ZONING_PLAN.id,
    ),
    KOUGA_LAND_USE_SCHEME_2021,
    ST_FRANCIS_BAY_TOWN_ZONING_PLAN,
  ],
  zones: [
    ...BASE_KOUGA_PLANNING_REGISTRY.zones.filter((zone) => zone.code !== VERIFIED_RES1_ZONE.code),
    VERIFIED_RES1_ZONE,
  ],
};
