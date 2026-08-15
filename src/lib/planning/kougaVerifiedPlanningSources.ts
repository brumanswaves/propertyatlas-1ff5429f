import { KOUGA_PLANNING_REGISTRY as BASE_KOUGA_PLANNING_REGISTRY } from "./kougaPlanningRegistry";
import type {
  MunicipalityPlanningRegistryEntry,
  MunicipalityPlanningSource,
  ZoneDefinition,
} from "./municipalityPlanningTypes";
import type { ZoningRuleWithApplicability } from "./zoningRuleApplicability";

const VERIFIED_AT = "2026-08-15";
const KOUGA_SCHEME_URL = "https://www.kouga.gov.za/download/4539";
const ST_FRANCIS_ZONING_PLAN_URL = "https://www.kouga.gov.za/download/4531";
const RES1_CITATION =
  "Kouga Land Use Scheme, February 2021, section 25, printed page 23 (PDF page 26)";

const KOUGA_LAND_USE_SCHEME_2021: MunicipalityPlanningSource = {
  id: "kouga-land-use-scheme-2021",
  municipality: BASE_KOUGA_PLANNING_REGISTRY.municipality,
  title: "Kouga Land Use Scheme 2021",
  sourceType: "land_use_scheme",
  url: KOUGA_SCHEME_URL,
  jurisdiction: "municipal",
  status: "active",
  version: "February 2021",
  effectiveDate: "2021-03-18",
  publishedDate: "2021-03-16",
  lastVerifiedAt: VERIFIED_AT,
  planningAreas: [],
  notes:
    "Official municipality-wide Land Use Scheme. Easy Erf retrieved the municipal PDF and verified the Residential Zone 1 development parameters in section 25 on 2026-08-15. These are published general zone rules, not proof that a particular erf is zoned Residential Zone 1.",
};

const ST_FRANCIS_BAY_TOWN_ZONING_PLAN: MunicipalityPlanningSource = {
  id: "kouga-st-francis-bay-town-zoning-plan-2020-12",
  municipality: BASE_KOUGA_PLANNING_REGISTRY.municipality,
  title: "Kouga ILUS Town Zoning Plan 6 - St Francis Bay",
  sourceType: "zoning_map",
  url: ST_FRANCIS_ZONING_PLAN_URL,
  jurisdiction: "municipal",
  status: "active",
  version: "2020-12",
  effectiveDate: null,
  publishedDate: "2021-03-16",
  lastVerifiedAt: VERIFIED_AT,
  planningAreas: ["Sea Vista"],
  notes:
    "Official municipal zoning-plan PDF for St Francis Bay. Easy Erf verified the direct PDF download, but the map has not yet been spatially correlated to the canonical Sea Vista parcel, so it must not be used alone to assert a parcel zoning.",
};

const under400 = { erfAreaM2: { maxExclusiveM2: 400 } } as const;
const over400 = { erfAreaM2: { minExclusiveM2: 400 } } as const;

const OFFICIAL_RES1_RULES: ZoningRuleWithApplicability[] = [
  {
    id: "kouga-res1-street-building-line-under-400",
    ruleType: "street_building_line",
    label: "Street building line",
    value: 1,
    unit: "m",
    statement: "Residential Zone 1 street building line is 1 m for erven smaller than 400 m².",
    conditions: ["Applies only to erven smaller than 400 m²."],
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: RES1_CITATION,
    status: "active",
    interpretation:
      "This is a published general zone control. It does not prove the parcel's zoning or override title conditions, servitudes, departures or approved plans.",
    applicability: under400,
  },
  {
    id: "kouga-res1-street-building-line-over-400",
    ruleType: "street_building_line",
    label: "Street building line",
    value: 3,
    unit: "m",
    statement: "Residential Zone 1 street building line is 3 m for erven larger than 400 m².",
    conditions: ["Applies only to erven larger than 400 m²."],
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: RES1_CITATION,
    status: "active",
    interpretation:
      "This is a published general zone control. It does not prove the parcel's zoning or override title conditions, servitudes, departures or approved plans.",
    applicability: over400,
  },
  {
    id: "kouga-res1-side-building-line-under-400",
    ruleType: "side_building_line",
    label: "Lateral building line",
    value: 1,
    unit: "m",
    statement:
      "Residential Zone 1 lateral building line is 1 m on one boundary for erven smaller than 400 m².",
    conditions: [
      "Applies only to erven smaller than 400 m².",
      "The scheme states 1 m on one lateral boundary.",
    ],
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: RES1_CITATION,
    status: "active",
    interpretation:
      "The official scheme wording is preserved because the one-boundary condition matters. Parcel geometry and any additional restrictions still need confirmation.",
    applicability: under400,
  },
  {
    id: "kouga-res1-side-building-line-over-400",
    ruleType: "side_building_line",
    label: "Lateral building line",
    value: 1.5,
    unit: "m",
    statement: "Residential Zone 1 lateral building line is 1.5 m for erven larger than 400 m².",
    conditions: ["Applies only to erven larger than 400 m²."],
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: RES1_CITATION,
    status: "active",
    interpretation:
      "This is a published general zone control. Parcel geometry, title restrictions and departures can still change the practical buildable envelope.",
    applicability: over400,
  },
  {
    id: "kouga-res1-rear-building-line-under-400",
    ruleType: "rear_building_line",
    label: "Rear building line",
    value: 1,
    unit: "m",
    statement: "Residential Zone 1 rear building line is 1 m for erven smaller than 400 m².",
    conditions: ["Applies only to erven smaller than 400 m²."],
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: RES1_CITATION,
    status: "active",
    interpretation:
      "This is a published general zone control. Confirm which cadastral edge is the rear boundary and check other property restrictions.",
    applicability: under400,
  },
  {
    id: "kouga-res1-rear-building-line-over-400",
    ruleType: "rear_building_line",
    label: "Rear building line",
    value: 1.5,
    unit: "m",
    statement: "Residential Zone 1 rear building line is 1.5 m for erven larger than 400 m².",
    conditions: ["Applies only to erven larger than 400 m²."],
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: RES1_CITATION,
    status: "active",
    interpretation:
      "This is a published general zone control. Confirm the cadastral rear boundary and any title, servitude or departure constraints.",
    applicability: over400,
  },
  {
    id: "kouga-res1-height",
    ruleType: "height",
    label: "Maximum height",
    value: 8.5,
    unit: "m",
    statement: "Residential Zone 1 maximum height is 8.5 m.",
    conditions: [],
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: RES1_CITATION,
    status: "active",
    interpretation:
      "This is the published general zone height. Property-specific departures, overlays, title conditions and approved plans remain separate evidence.",
  },
  {
    id: "kouga-res1-coverage-under-400",
    ruleType: "coverage",
    label: "Maximum coverage",
    value: 70,
    unit: "percent",
    statement: "Residential Zone 1 maximum coverage is 70% for erven smaller than 400 m².",
    conditions: ["Applies only to erven smaller than 400 m²."],
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: RES1_CITATION,
    status: "active",
    interpretation:
      "Coverage is a published general maximum, not a guaranteed buildable footprint. Other parcel constraints can reduce practical development area.",
    applicability: under400,
  },
  {
    id: "kouga-res1-coverage-over-400",
    ruleType: "coverage",
    label: "Maximum coverage",
    value: 50,
    unit: "percent",
    statement: "Residential Zone 1 maximum coverage is 50% for erven larger than 400 m².",
    conditions: ["Applies only to erven larger than 400 m²."],
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: RES1_CITATION,
    status: "active",
    interpretation:
      "Coverage is a published general maximum, not a guaranteed buildable footprint. Other parcel constraints can reduce practical development area.",
    applicability: over400,
  },
  {
    id: "kouga-res1-dwellings",
    ruleType: "dwelling_units",
    label: "Dwelling units",
    value: 1,
    unit: "units",
    statement:
      "Residential Zone 1 allows one dwelling unit per erf, with one additional dwelling unit subject to consent.",
    conditions: ["One additional dwelling unit is subject to municipal consent."],
    sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
    citation: RES1_CITATION,
    status: "active",
    interpretation:
      "The additional dwelling is a consent use. Easy Erf does not assume consent will be granted for a specific erf.",
  },
];

const OFFICIAL_RES1_ZONE: ZoneDefinition = {
  code: "RES1",
  name: "Residential Zone 1 (single residential)",
  municipality: BASE_KOUGA_PLANNING_REGISTRY.municipality,
  permittedUses: ["Dwelling Unit"],
  consentUses: [
    "Additional Dwelling Unit",
    "Child Care Facility",
    "Commune",
    "Guest Lodging Facility",
    "Home Occupation",
    "House Shop",
    "Medical Use",
    "Social Facility",
    "Tavern",
  ],
  rules: OFFICIAL_RES1_RULES,
  sourceId: KOUGA_LAND_USE_SCHEME_2021.id,
  status: "active",
  summary:
    "Published Residential Zone 1 definition from the February 2021 Kouga Land Use Scheme. This defines general zone controls only and is not evidence that a particular erf is zoned RES1.",
};

/**
 * Verified official planning-source overlay. Published scheme controls are
 * active general rules, while parcel-specific zoning detection remains disabled
 * until an official zoning source can be correlated reliably to the parcel.
 */
export const KOUGA_PLANNING_REGISTRY: MunicipalityPlanningRegistryEntry = {
  ...BASE_KOUGA_PLANNING_REGISTRY,
  sources: [
    ...BASE_KOUGA_PLANNING_REGISTRY.sources.filter(
      (source) => source.id !== KOUGA_LAND_USE_SCHEME_2021.id,
    ),
    KOUGA_LAND_USE_SCHEME_2021,
    ST_FRANCIS_BAY_TOWN_ZONING_PLAN,
  ],
  zones: [
    ...BASE_KOUGA_PLANNING_REGISTRY.zones.filter((zone) => zone.code !== OFFICIAL_RES1_ZONE.code),
    OFFICIAL_RES1_ZONE,
  ],
};
