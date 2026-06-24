import type { MarketEvidencePortalAction, MarketEvidenceRelationship } from "./types";

export const RELATIONSHIP_OPTIONS: MarketEvidenceRelationship[] = [
  "target_asset",
  "possible_target_asset",
  "same_street_comp",
  "same_node_comp",
  "same_suburb_comp",
  "vacant_land_comp",
  "broader_market_comp",
  "inverse_comp",
  "weak_comp",
  "not_related",
];

export const SAFE_PORTALS: Array<
  Pick<MarketEvidencePortalAction, "portal" | "url" | "group"> & { id: string }
> = [
  {
    id: "property24",
    portal: "Property24",
    url: "https://www.property24.com/",
    group: "major_portals",
  },
  {
    id: "private-property",
    portal: "Private Property",
    url: "https://www.privateproperty.co.za/",
    group: "major_portals",
  },
  {
    id: "pam-golding",
    portal: "Pam Golding",
    url: "https://www.pamgolding.co.za/",
    group: "agency_portals",
  },
  { id: "seeff", portal: "Seeff", url: "https://www.seeff.com/", group: "agency_portals" },
  { id: "remax", portal: "RE/MAX", url: "https://www.remax.co.za/", group: "agency_portals" },
  { id: "rawson", portal: "Rawson", url: "https://www.rawson.co.za/", group: "agency_portals" },
  {
    id: "chas-everitt",
    portal: "Chas Everitt",
    url: "https://www.chaseveritt.co.za/",
    group: "agency_portals",
  },
];

export const KOUGA_LOCAL_PHRASES = [
  "Cape St Francis property for sale",
  "Cape St Francis vacant land for sale",
  "St Francis On Sea property for sale",
  "Santareme property for sale",
  "St Francis Bay property for sale",
  "St Francis Bay vacant land for sale",
  "Port St Francis property for sale",
  "St Francis Links property for sale",
  "Kouga vacant land for sale",
  "Eastern Cape coastal property for sale",
];

export const VACANT_LAND_TERMS = [
  "plot",
  "stand",
  "vacant land",
  "undeveloped",
  "building plot",
  "erf",
];
