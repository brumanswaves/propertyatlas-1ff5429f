import { KOUGA_PLANNING_REGISTRY as BASE_KOUGA_PLANNING_REGISTRY } from "./kougaPlanningRegistry";
import type {
  MunicipalityPlanningRegistryEntry,
  MunicipalityPlanningSource,
} from "./municipalityPlanningTypes";

const VERIFIED_AT = "2026-08-15";

const KOUGA_LAND_USE_SCHEME_2021: MunicipalityPlanningSource = {
  id: "kouga-land-use-scheme-2021",
  municipality: BASE_KOUGA_PLANNING_REGISTRY.municipality,
  title: "Kouga Land Use Scheme 2021",
  sourceType: "land_use_scheme",
  url: "https://www.kouga.gov.za/document-library",
  jurisdiction: "municipal",
  status: "active",
  version: "2021",
  effectiveDate: null,
  publishedDate: "2021-01-01",
  lastVerifiedAt: VERIFIED_AT,
  planningAreas: [],
  notes:
    "Municipality-wide Land Use Scheme listed in the official Kouga document library. Source presence is verified, but Easy Erf must still retrieve and cite the scheme text before promoting numeric zone controls from manual_candidate status.",
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
    "Official Kouga document library lists PDF '202 - Kouga ILUS 2020-12 - Town Zoning Plan_6 St Francis Bay.pdf'. Presence verified 2026-08-15. Easy Erf has not yet fetched or parsed the PDF in-product, so this source must not be used alone to assert a parcel zoning.",
};

/**
 * Adds newly verified official source artifacts without changing the underlying
 * planning conclusions. In particular, RES1 rules remain manual_candidate and
 * automatic zoning detection remains disabled until a zoning source is
 * retrieved, parsed and correlated to a parcel reliably.
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
};
