import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";

export type LocalPropertyState = "vacant_land" | "existing_home" | "unknown";
export type LocalServiceGroupId =
  | "plan-build"
  | "protect-maintain"
  | "connect-property"
  | "buy-sell-manage";

export interface LocalServiceCategory {
  id: string;
  groupId: LocalServiceGroupId;
  label: string;
  searchQuery: string;
  reason: Record<LocalPropertyState, string>;
  appliesTo: LocalPropertyState[];
}

export interface LocalServiceGroup {
  id: LocalServiceGroupId;
  label: string;
  description: string;
}

export interface LocalProviderAttribution {
  provider: string;
  providerUri: string | null;
}

export interface LocalProvider {
  placeId: string;
  name: string;
  categoryId: string;
  address: string | null;
  coordinates: { lat: number; lng: number } | null;
  rating: number | null;
  reviewCount: number | null;
  userRatingCount: number | null;
  phone: string | null;
  websiteUrl: string | null;
  website: string | null;
  googleMapsUrl: string;
  businessStatus: string | null;
  openNow: boolean | null;
  distanceKm: number | null;
  source: "google";
  isSponsored: boolean;
  sponsorshipLabel: string | null;
  isEasyErfVerified: boolean;
  verificationStatus: string | null;
  verificationDate: string | null;
  serviceAreas: string[];
  categories: string[];
  attributions?: LocalProviderAttribution[];
  leadTrackingId: string | null;
}

export const LOCAL_SERVICE_GROUPS: LocalServiceGroup[] = [
  {
    id: "plan-build",
    label: "Plan and Build",
    description: "Confirm the site, design the project, price it, approve it, and build it.",
  },
  {
    id: "protect-maintain",
    label: "Protect and Maintain",
    description: "Inspect, insure, secure, repair, and maintain an existing property.",
  },
  {
    id: "connect-property",
    label: "Connect the Property",
    description: "Internet, power, water, waste, and practical service connections.",
  },
  {
    id: "buy-sell-manage",
    label: "Buy, Sell or Manage",
    description: "Transaction, finance, valuation, rental, moving, and management support.",
  },
];

const states: LocalPropertyState[] = ["vacant_land", "existing_home", "unknown"];

export const LOCAL_SERVICE_CATEGORIES: LocalServiceCategory[] = [
  {
    id: "land-surveyors",
    groupId: "plan-build",
    label: "Land surveyors",
    searchQuery: "professional land surveyor",
    appliesTo: states,
    reason: {
      vacant_land:
        "The cadastral parcel has been identified, but physical boundaries and beacons have not been independently confirmed.",
      existing_home:
        "A surveyor may be needed before additions, boundary work, subdivisions, or resolving beacon questions.",
      unknown:
        "A surveyor can confirm physical boundaries, beacons, and survey requirements before property work begins.",
    },
  },
  {
    id: "architects-draughtspersons",
    groupId: "plan-build",
    label: "Architects and draughtspersons",
    searchQuery: "residential architect draughtsperson",
    appliesTo: states,
    reason: {
      vacant_land:
        "This appears to be a development opportunity. A local designer can test the brief against the site and municipal submission requirements.",
      existing_home:
        "A local designer can help assess alterations, additions, plans, and municipal submission requirements.",
      unknown:
        "A local designer can translate the property brief into plans and identify information still needed before design work.",
    },
  },
  {
    id: "builders-contractors",
    groupId: "plan-build",
    label: "Builders and contractors",
    searchQuery: "residential builder building contractor",
    appliesTo: states,
    reason: {
      vacant_land:
        "This appears to be vacant land or a development opportunity. Local builders may help with early feasibility pricing.",
      existing_home:
        "Local builders may help price repairs, renovations, additions, or a larger redevelopment concept.",
      unknown:
        "A local builder can help test practical scope, sequencing, and early cost assumptions.",
    },
  },
  {
    id: "town-planners",
    groupId: "plan-build",
    label: "Town planners",
    searchQuery: "town planner land use planning",
    appliesTo: states,
    reason: {
      vacant_land:
        "Planning and zoning information should be confirmed before relying on development rights.",
      existing_home:
        "A town planner may be needed where additions, consent use, departures, subdivisions, or land-use rights are involved.",
      unknown:
        "A town planner can confirm which land-use rights and municipal processes apply to the erf.",
    },
  },
  {
    id: "engineers",
    groupId: "plan-build",
    label: "Engineers",
    searchQuery: "structural civil engineer residential",
    appliesTo: states,
    reason: {
      vacant_land:
        "Slope, foundations, drainage, access, retaining structures, and services may require engineering input.",
      existing_home:
        "Structural changes, cracking, drainage, retaining walls, or additions may require engineering input.",
      unknown:
        "An engineer can assess structural, civil, drainage, and site constraints that are not confirmed by public parcel data.",
    },
  },
  {
    id: "quantity-surveyors",
    groupId: "plan-build",
    label: "Quantity surveyors",
    searchQuery: "quantity surveyor construction cost consultant",
    appliesTo: ["vacant_land", "existing_home"],
    reason: {
      vacant_land:
        "A quantity surveyor can turn a concept and site scope into a more disciplined build-cost estimate.",
      existing_home:
        "A quantity surveyor can help price a substantial renovation or addition and track cost risk.",
      unknown:
        "A quantity surveyor can help structure early construction cost assumptions.",
    },
  },
  {
    id: "insurance-brokers",
    groupId: "protect-maintain",
    label: "Insurance brokers",
    searchQuery: "property insurance broker",
    appliesTo: ["existing_home", "unknown"],
    reason: {
      vacant_land:
        "Vacant-land, construction, liability, or future-building cover may need specialist advice.",
      existing_home:
        "Building, contents, liability, coastal, and renovation risks should be discussed with an insurer or broker.",
      unknown:
        "A local broker can explain which property, liability, vacancy, or construction risks may need cover.",
    },
  },
  {
    id: "property-inspectors",
    groupId: "protect-maintain",
    label: "Property inspectors",
    searchQuery: "home property inspector",
    appliesTo: ["existing_home", "unknown"],
    reason: {
      vacant_land:
        "A site specialist may still help identify access, drainage, retaining, and visible site concerns.",
      existing_home:
        "An independent inspection can identify visible condition, maintenance, moisture, roof, electrical, or structural concerns.",
      unknown:
        "An inspection can establish what is physically present and what needs specialist follow-up.",
    },
  },
  {
    id: "security-companies",
    groupId: "protect-maintain",
    label: "Security companies",
    searchQuery: "home security armed response",
    appliesTo: ["existing_home", "unknown"],
    reason: {
      vacant_land:
        "Site security may become relevant during construction or while materials are stored on the erf.",
      existing_home:
        "Local providers can confirm alarms, monitoring, armed response, cameras, and access-control coverage.",
      unknown:
        "Local security providers can explain service coverage and practical property-protection options.",
    },
  },
  {
    id: "electricians",
    groupId: "protect-maintain",
    label: "Electricians",
    searchQuery: "registered electrician electrical contractor",
    appliesTo: ["existing_home", "unknown"],
    reason: {
      vacant_land:
        "An electrician may help plan temporary power, future connections, distribution, solar, and backup systems.",
      existing_home:
        "Electrical condition, compliance, repairs, additions, and backup-power requirements may need a registered electrician.",
      unknown:
        "A local electrician can assess electrical scope and compliance questions not shown in public records.",
    },
  },
  {
    id: "plumbers",
    groupId: "protect-maintain",
    label: "Plumbers",
    searchQuery: "registered plumber plumbing contractor",
    appliesTo: ["existing_home", "unknown"],
    reason: {
      vacant_land:
        "A plumber may help plan water, sewer, tanks, stormwater, and future building connections.",
      existing_home:
        "Leaks, water pressure, drainage, geysers, sewer connections, and renovation scope may need a plumber.",
      unknown:
        "A local plumber can assess water and drainage scope that is not confirmed by parcel records.",
    },
  },
  {
    id: "solar-backup-power",
    groupId: "protect-maintain",
    label: "Solar and backup power",
    searchQuery: "solar installer backup power inverter",
    appliesTo: states,
    reason: {
      vacant_land:
        "Early planning can coordinate roof orientation, electrical capacity, battery space, and backup-power requirements.",
      existing_home:
        "A local installer can assess solar, inverter, battery, generator, and existing electrical-system compatibility.",
      unknown:
        "A local energy provider can assess solar and backup-power options for the property context.",
    },
  },
  {
    id: "garden-maintenance",
    groupId: "protect-maintain",
    label: "Garden and property maintenance",
    searchQuery: "garden property maintenance service",
    appliesTo: ["existing_home", "unknown"],
    reason: {
      vacant_land:
        "Clearing, invasive vegetation, erosion, and basic site upkeep may require local maintenance support.",
      existing_home:
        "Garden, exterior, pool, and general maintenance may be part of ongoing ownership or rental planning.",
      unknown:
        "Local maintenance providers can help establish the practical upkeep needs of the property.",
    },
  },
  {
    id: "fibre-internet",
    groupId: "connect-property",
    label: "Fibre and internet",
    searchQuery: "internet service provider",
    appliesTo: states,
    reason: {
      vacant_land:
        "Connectivity availability should be checked before relying on future work-from-home, rental, or development assumptions.",
      existing_home:
        "Easy Erf found local connectivity providers serving the wider property area.",
      unknown:
        "Local providers can confirm fibre, fixed wireless, LTE, and installation options for the area.",
    },
  },
  {
    id: "tv-dstv",
    groupId: "connect-property",
    label: "TV and DStv installers",
    searchQuery: "DStv television satellite installer",
    appliesTo: ["existing_home", "unknown"],
    reason: {
      vacant_land:
        "Television and cabling can be coordinated later with the building design and service plan.",
      existing_home:
        "Local installers can assess satellite, television, cabling, mounting, and signal requirements.",
      unknown:
        "Local installers can confirm television and satellite service options for the property.",
    },
  },
  {
    id: "water-tanks-pumps-boreholes",
    groupId: "connect-property",
    label: "Water tanks, pumps, and boreholes",
    searchQuery: "water tank pump borehole installer",
    appliesTo: states,
    reason: {
      vacant_land:
        "Water storage, pressure, borehole feasibility, stormwater, and backup supply may affect the site plan.",
      existing_home:
        "A local specialist can assess storage, pumps, rainwater, boreholes, and backup-water integration.",
      unknown:
        "A local water specialist can assess storage and supply options not confirmed by public records.",
    },
  },
  {
    id: "electricity-connections",
    groupId: "connect-property",
    label: "Electricity and solar connections",
    searchQuery: "electricity connection solar electrical contractor",
    appliesTo: states,
    reason: {
      vacant_land:
        "New-build feasibility should confirm electricity availability, connection process, capacity, and alternative-energy options.",
      existing_home:
        "Connection capacity, upgrades, solar integration, and backup systems may need local electrical input.",
      unknown:
        "Local providers can help investigate electrical connection and alternative-energy requirements.",
    },
  },
  {
    id: "municipal-water-electricity",
    groupId: "connect-property",
    label: "Municipal water and electricity information",
    searchQuery: "Kouga municipality water electricity customer care",
    appliesTo: states,
    reason: {
      vacant_land:
        "Municipal service availability and connection charges should be confirmed before relying on development feasibility.",
      existing_home:
        "Municipal account, metering, service, and connection information may be needed during purchase or occupation.",
      unknown:
        "Municipal service availability and account requirements should be confirmed directly with the authority.",
    },
  },
  {
    id: "waste-refuse",
    groupId: "connect-property",
    label: "Waste and refuse information",
    searchQuery: "Kouga municipality waste refuse collection",
    appliesTo: states,
    reason: {
      vacant_land:
        "Construction waste, future refuse collection, and disposal arrangements should be planned early.",
      existing_home:
        "Local refuse collection, garden waste, recycling, and disposal options may affect occupation and maintenance.",
      unknown:
        "Municipal or local providers can clarify refuse and disposal arrangements for the area.",
    },
  },
  {
    id: "estate-agents",
    groupId: "buy-sell-manage",
    label: "Estate agents",
    searchQuery: "estate agent property sales",
    appliesTo: states,
    reason: {
      vacant_land:
        "Local agents may help test land demand, competing stock, likely buyers, and resale assumptions.",
      existing_home:
        "Local agents may help with pricing context, buyer demand, listings, selling, or acquisition support.",
      unknown:
        "A local agent can provide market context, but claims should be checked against evidence and competing listings.",
    },
  },
  {
    id: "conveyancers-attorneys",
    groupId: "buy-sell-manage",
    label: "Conveyancers and property attorneys",
    searchQuery: "conveyancing attorney property transfer",
    appliesTo: states,
    reason: {
      vacant_land:
        "Offers, title conditions, servitudes, transfer, VAT, and development-related legal questions may need a property attorney.",
      existing_home:
        "Offers, transfer, title, servitudes, contracts, and property-law questions may need a conveyancer or attorney.",
      unknown:
        "A property attorney can advise on transaction and title questions that public research does not resolve.",
    },
  },
  {
    id: "bond-finance",
    groupId: "buy-sell-manage",
    label: "Bond originators or property finance",
    searchQuery: "bond originator property finance",
    appliesTo: states,
    reason: {
      vacant_land:
        "Vacant-land and construction finance can differ from normal home loans and should be checked early.",
      existing_home:
        "A bond originator or lender can test affordability, loan options, deposits, and renovation-finance questions.",
      unknown:
        "A finance provider can explain lending options and required supporting information.",
    },
  },
  {
    id: "rental-property-managers",
    groupId: "buy-sell-manage",
    label: "Rental property managers",
    searchQuery: "rental property manager letting agent",
    appliesTo: ["existing_home", "unknown"],
    reason: {
      vacant_land:
        "Property management becomes relevant only if the development strategy includes a completed rental property.",
      existing_home:
        "A local manager can advise on achievable rent, tenant demand, inspections, maintenance, and management fees.",
      unknown:
        "A local manager can assess whether the property is suitable for rental and what management would involve.",
    },
  },
  {
    id: "movers-storage",
    groupId: "buy-sell-manage",
    label: "Movers and storage",
    searchQuery: "moving company furniture removals storage",
    appliesTo: ["existing_home", "unknown"],
    reason: {
      vacant_land:
        "Moving and storage usually become relevant once a completed building is ready for occupation.",
      existing_home:
        "Local movers and storage providers may help with occupation, renovation clearance, or relocation.",
      unknown:
        "Local movers and storage providers can help plan occupation or property clearance.",
    },
  },
  {
    id: "property-valuers",
    groupId: "buy-sell-manage",
    label: "Property valuers",
    searchQuery: "professional property valuer",
    appliesTo: states,
    reason: {
      vacant_land:
        "An independent valuer may help test land value where listings and agent opinions are insufficient.",
      existing_home:
        "An independent valuer may help with lending, estates, disputes, insurance, or a formal market opinion.",
      unknown:
        "A professional valuer can provide a formal opinion where public and listing evidence is incomplete.",
    },
  },
];

const SERVICE_AREA_CATEGORY_IDS = new Set([
  "builders-contractors",
  "electricians",
  "plumbers",
  "security-companies",
  "solar-backup-power",
  "garden-maintenance",
  "fibre-internet",
  "tv-dstv",
  "water-tanks-pumps-boreholes",
]);

const SEARCH_QUERY_VARIANTS: Partial<Record<string, string[]>> = {
  "fibre-internet": [
    "internet service provider",
    "fibre internet provider",
    "wireless internet provider",
  ],
  "builders-contractors": [
    "residential builder",
    "building contractor",
    "home renovation contractor",
  ],
  electricians: [
    "registered electrician",
    "electrical contractor",
    "solar electrician",
  ],
  plumbers: ["registered plumber", "plumbing contractor", "geyser plumber"],
};

export function localServiceSearchQueries(category: LocalServiceCategory): string[] {
  const queries = [category.searchQuery, ...(SEARCH_QUERY_VARIANTS[category.id] ?? [])];
  return Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean)));
}

export function includePureServiceAreaBusinesses(category: LocalServiceCategory): boolean {
  return SERVICE_AREA_CATEGORY_IDS.has(category.id);
}

export function inferLocalPropertyState(
  parcel: NormalizedOfficialParcel,
  siteMode?: string | null,
): LocalPropertyState {
  if (siteMode === "vacant_land") return "vacant_land";
  if (siteMode === "renovation" || siteMode === "existing_home") return "existing_home";
  const text = [
    ...parcel.knownFields.flatMap((field) => [field.label, field.value, field.source]),
    ...Object.entries(parcel.rawProperties ?? {}).flatMap(([key, value]) => [key, String(value)]),
  ]
    .join(" ")
    .toLowerCase();
  if (/vacant|undeveloped|empty stand|residential land|land only|plot/.test(text)) {
    return "vacant_land";
  }
  if (/house|dwelling|residential building|improvement|structure/.test(text)) {
    return "existing_home";
  }
  return "unknown";
}

export function orderedLocalServiceGroups(state: LocalPropertyState): LocalServiceGroup[] {
  const priority: Record<LocalPropertyState, LocalServiceGroupId[]> = {
    vacant_land: ["plan-build", "connect-property", "buy-sell-manage", "protect-maintain"],
    existing_home: ["protect-maintain", "buy-sell-manage", "connect-property", "plan-build"],
    unknown: ["buy-sell-manage", "plan-build", "protect-maintain", "connect-property"],
  };
  return priority[state]
    .map((id) => LOCAL_SERVICE_GROUPS.find((group) => group.id === id))
    .filter((group): group is LocalServiceGroup => Boolean(group));
}

export function categoriesForGroup(
  groupId: LocalServiceGroupId,
  state: LocalPropertyState,
): LocalServiceCategory[] {
  return LOCAL_SERVICE_CATEGORIES.filter(
    (category) => category.groupId === groupId && category.appliesTo.includes(state),
  );
}

export function localServiceLocationLabel(parcel: NormalizedOfficialParcel): string {
  return [parcel.suburbOrArea, parcel.town, parcel.municipality, parcel.province, "South Africa"]
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(", ");
}

export function buildGoogleMapsFallbackUrl(
  category: Pick<LocalServiceCategory, "searchQuery">,
  parcel: NormalizedOfficialParcel,
): string {
  const location = localServiceLocationLabel(parcel);
  const query = [category.searchQuery, location ? `near ${location}` : null].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function canShowSponsored(provider: LocalProvider): boolean {
  return provider.isSponsored === true && Boolean(provider.sponsorshipLabel?.trim());
}

export function canShowEasyErfVerified(provider: LocalProvider): boolean {
  return (
    provider.isEasyErfVerified === true &&
    provider.verificationStatus === "verified" &&
    Boolean(provider.verificationDate)
  );
}
