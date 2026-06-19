import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ResearchSourceDefinition } from "@/lib/research/sourceTypes";

export const ERF_962_IDENTITY = {
  address: "8 Harbour Road",
  area: "Santareme / St Francis Bay / Sea Vista",
  municipality: "Kouga",
  province: "Eastern Cape",
  erfNumber: "962",
  portion: "0",
  lpi: "C03400140000096200000",
  parcelKey: "E108C034001400000962000000",
};

export const ERF_962_GENERATED_QUERIES = [
  `"8 Harbour Road" "St Francis Bay"`,
  `"8 Harbour Road" "Santareme"`,
  `"8 Harbour Road" "Saint Francis Bay"`,
  `"Erf 962" "St Francis Bay"`,
  `"Erf 962" "Santareme"`,
  `"962" "Harbour Road" "St Francis"`,
  `"C03400140000096200000"`,
  `"E108C034001400000962000000"`,
  `"SEA VISTA" "00000962"`,
  `"SEA VISTA" "8 HARBOUR ROAD"`,
  `site:kouga.gov.za "00000962"`,
  `site:kouga.gov.za "8 HARBOUR ROAD"`,
  `site:property24.com "8 Harbour Road" "Santareme"`,
  `site:airbnb.com "8 Harbour Road" "Saint Francis Bay"`,
];

const ERF_962_LOCATION_CONTEXT = [
  "kouga",
  "eastern cape",
  "st francis bay",
  "saint francis bay",
  "santareme",
  "sea vista",
  "harbour road",
  "8 harbour road",
];

export function matchesErf962HarbourRoad(parcel: NormalizedOfficialParcel): boolean {
  const haystack = [
    parcel.id,
    parcel.erfNumber,
    parcel.portion,
    parcel.lpi,
    parcel.parcelKey,
    parcel.suburbOrArea,
    parcel.town,
    parcel.municipality,
    parcel.province,
    ...(parcel.knownFields ?? []).map((field) => field.value),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (String(parcel.lpi ?? "").toUpperCase() === ERF_962_IDENTITY.lpi) return true;
  if (String(parcel.parcelKey ?? "").toUpperCase() === ERF_962_IDENTITY.parcelKey) return true;
  if (
    String(parcel.erfNumber ?? "").trim() === "962" &&
    String(parcel.portion ?? "0").trim() === "0" &&
    ERF_962_LOCATION_CONTEXT.some((context) => haystack.includes(context))
  ) {
    return true;
  }
  return haystack.includes("8 harbour road");
}

export const ERF_962_EVIDENCE_SOURCES: ResearchSourceDefinition[] = [
  {
    id: "erf-962-kouga-valuation-roll-2014",
    category: "municipal",
    name: "Kouga Municipality Final Valuation Roll, Sea Vista 2014",
    sourceType: "municipal",
    defaultStatus: "available",
    reveals:
      "Sea Vista Erf 00000962, Portion 00000, 8 Harbour Road, RES IMP, 0.0800 ha, historic municipal value R1,700,000.",
    description: "Confirmed public municipal roll evidence for this erf.",
    helpsWith: "Historical municipal valuation and parcel identity cross-check.",
    fieldsFound: [
      "Sea Vista Erf 00000962",
      "Portion 00000",
      "8 Harbour Road",
      "Category: RES IMP",
      "Extent: 0.0800 ha",
      "Historic municipal value: R1,700,000",
    ],
    requiredFields: [],
    actionLabel: "Open Kouga roll",
    complianceNote: "Historical municipal valuation, not current market value.",
    confidence: "confirmed_for_parcel",
    parcelSpecific: true,
    dossierGroup: "municipal-evidence",
    buildUrl: () => "https://www.kouga.gov.za/download/1401",
  },
  {
    id: "erf-962-property24-values",
    category: "market",
    name: "Property24 exact address property-values page",
    sourceType: "public-web",
    defaultStatus: "available",
    reveals:
      "Property value page, sale-history entry point, deeds-office field entry point, township/erf discovery, and market research clue.",
    requiredFields: [],
    actionLabel: "Open Property24",
    complianceNote: "Useful external source, not verified official data.",
    confidence: "external_relevant",
    parcelSpecific: true,
    dossierGroup: "market-intelligence",
    buildUrl: () =>
      "https://www.property24.com/property-values/8-harbour-road/santareme/st-francis-bay/eastern-cape/dfxvbayabzmevkyhgp4bw6ubrfciws3rp66ixfscdpyyvoe6ujik6ve3qds5n6ee7hzdspk6tvhha",
  },
  {
    id: "erf-962-property24-street-values",
    category: "market",
    name: "Property24 Harbour Road street values page",
    sourceType: "public-web",
    defaultStatus: "available",
    reveals: "Nearby street-level comps and property-value discovery.",
    requiredFields: [],
    actionLabel: "Open street values",
    complianceNote: "External market clue only. Verify any records manually.",
    confidence: "external_relevant",
    parcelSpecific: true,
    dossierGroup: "market-intelligence",
    buildUrl: () =>
      "https://www.property24.com/property-values/harbour-road/santareme/st-francis-bay/eastern-cape/7309",
  },
  {
    id: "erf-962-kouga-land-use-scheme",
    category: "municipal",
    name: "Kouga Integrated Land Use Scheme, St Francis Bay",
    sourceType: "municipal",
    defaultStatus: "available",
    reveals: "Planning and zoning context for St Francis Bay.",
    requiredFields: [],
    actionLabel: "Open scheme",
    complianceNote: "Do not treat as verified parcel zoning unless parsed and confirmed.",
    confidence: "official_relevant",
    parcelSpecific: true,
    dossierGroup: "planning-zoning",
    buildUrl: () => "https://www.kouga.gov.za/download/4531",
  },
  {
    id: "erf-962-project-k-trace",
    category: "market",
    name: "Project K construction/project-management trace",
    sourceType: "public-web",
    defaultStatus: "available",
    reveals: "Public web construction trace referencing 962 8 Harbour Road.",
    fieldsFound: ["962 8 Harbour Road"],
    requiredFields: [],
    actionLabel: "Open Project K",
    complianceNote: "Public web construction trace, not official proof.",
    confidence: "external_relevant",
    parcelSpecific: true,
    dossierGroup: "building-improvement",
    buildUrl: () => "https://www.goprojectk.co.za/",
  },
  {
    id: "erf-962-airbnb-trace",
    category: "rental",
    name: "Airbnb public listing trace",
    sourceType: "public-web",
    defaultStatus: "available",
    reveals: "Rental and STR intelligence clue: 8 Harbour Road surf spot with unbeatable views.",
    requiredFields: [],
    actionLabel: "Open Airbnb",
    complianceNote:
      "Use only basic public metadata and link out. Do not copy photos, reviews, or protected listing content.",
    confidence: "external_relevant",
    parcelSpecific: true,
    dossierGroup: "rental-tourism",
    buildUrl: () => "https://www.airbnb.com.au/rooms/31578665",
  },
  {
    id: "erf-962-trip101-trace",
    category: "rental",
    name: "Trip101 rental article trace",
    sourceType: "public-web",
    defaultStatus: "available",
    reveals: "Secondary public rental trace for St Francis Bay long-term rental research.",
    requiredFields: [],
    actionLabel: "Open article",
    complianceNote: "Secondary external source. Verify manually before relying on it.",
    confidence: "external_relevant",
    parcelSpecific: true,
    dossierGroup: "rental-tourism",
    buildUrl: () => "https://trip101.com/article/long-term-rentals-st-francis-bay",
  },
];
