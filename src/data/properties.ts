// Mock property data for the St Francis Bay pilot region.
// Geometries are real-world GeoJSON polygons in WGS84 [lng, lat].
// Designed so future Lightstone / cadastral GeoJSON imports can be swapped in.

export type PropertyType =
  | "Residential"
  | "Commercial"
  | "Industrial"
  | "Agricultural"
  | "Vacant Land";

export type OwnershipType = "Individual" | "Trust" | "Company";

export type AreaName =
  | "St Francis Bay"
  | "Cape St Francis"
  | "Santareme"
  | "Port St Francis"
  | "Oyster Bay";

export interface PropertyScores {
  investor: number;
  development: number;
  liquidity: number;
  coastal: number;
  walkability: number;
  oceanView: number;
  appreciation: number;
  rental: number;
}

export interface SaleRecord {
  date: string;
  price: number;
}

export interface OwnershipRecord {
  type: OwnershipType;
  ownerLabel: string;
  since: string;
}

export interface TimelineEvent {
  date: string;
  title: string;
  kind: "transfer" | "renovation" | "rezoning" | "listing" | "valuation";
}

export interface Property {
  id: string;
  erf: string;
  area: AreaName;
  street: string;
  type: PropertyType;
  zoning: string;
  status: "Off-market" | "Recently sold" | "Held long-term" | "Recently listed";
  sizeSqm: number;
  estimatedValue: number;
  municipalValue: number;
  confidence: number;
  scores: PropertyScores;
  ownership: OwnershipRecord;
  sales: SaleRecord[];
  timeline: TimelineEvent[];
  features: {
    beachfront: boolean;
    oceanView: boolean;
    walkingDistanceToBeach: boolean;
    cornerLot: boolean;
    largeErf: boolean;
    vacantLand: boolean;
  };
  // GeoJSON polygon ring in [lng, lat]
  geometry: [number, number][];
  centroid: [number, number]; // [lng, lat]
}

const AREAS: { name: AreaName; center: [number, number]; spread: number }[] = [
  { name: "Santareme", center: [24.838, -34.155], spread: 0.0045 },
  { name: "St Francis Bay", center: [24.834, -34.169], spread: 0.0065 },
  { name: "Port St Francis", center: [24.847, -34.185], spread: 0.0035 },
  { name: "Cape St Francis", center: [24.838, -34.203], spread: 0.0055 },
  { name: "Oyster Bay", center: [24.667, -34.172], spread: 0.005 },
];

const TYPES: PropertyType[] = [
  "Residential", "Residential", "Residential",
  "Vacant Land", "Vacant Land",
  "Commercial", "Agricultural",
];

const STREETS = [
  "Lyme Rd", "Da Gama Rd", "Marina Dr", "Anchorage Rd", "Pelican St",
  "Otter Way", "Sea Vista", "Beach Rd", "Sunset Cl", "Harbour Ln",
  "St Francis Dr", "Lighthouse Rd", "Shearwater Way", "Coral Cres", "Dune Rd",
];

const ZONINGS = ["Single Residential 1", "Single Residential 2", "General Residential", "Business 1", "Agricultural", "Resort"];

function seeded(i: number): number {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const M_PER_DEG_LAT = 111_000;
const M_PER_DEG_LNG_AT_34 = 92_000;

function rectPolygon(cx: number, cy: number, wMeters: number, hMeters: number, rotateRad: number): [number, number][] {
  const dx = wMeters / M_PER_DEG_LNG_AT_34 / 2;
  const dy = hMeters / M_PER_DEG_LAT / 2;
  const cos = Math.cos(rotateRad), sin = Math.sin(rotateRad);
  const corners: [number, number][] = [
    [-dx, -dy], [dx, -dy], [dx, dy], [-dx, dy],
  ];
  return corners.map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos] as [number, number])
    .concat([[0, 0]]) // placeholder, replaced below
    .slice(0, 4)
    .concat([[cx + corners[0][0] * cos - corners[0][1] * sin, cy + corners[0][0] * sin + corners[0][1] * cos]]); // close ring
}

export function formatZAR(n: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(n);
}

function generateProperties(): Property[] {
  const out: Property[] = [];
  let idx = 0;
  for (const { name: area, center, spread } of AREAS) {
    const count = 9 + Math.floor(seeded(area.length) * 4);
    for (let i = 0; i < count; i++) {
      idx++;
      const r = Math.sqrt(seeded(idx + 1)) * spread;
      const theta = seeded(idx + 2) * Math.PI * 2;
      const cx = center[0] + r * Math.cos(theta) * (M_PER_DEG_LAT / M_PER_DEG_LNG_AT_34);
      const cy = center[1] + r * Math.sin(theta);

      const type = TYPES[Math.floor(seeded(idx + 3) * TYPES.length)];
      const sizeSqm = type === "Agricultural"
        ? Math.round(5_000 + seeded(idx + 4) * 25_000)
        : type === "Vacant Land"
          ? Math.round(700 + seeded(idx + 4) * 1_800)
          : Math.round(450 + seeded(idx + 4) * 1_400);
      const side = Math.sqrt(sizeSqm);
      const wM = side * (0.85 + seeded(idx + 5) * 0.3);
      const hM = sizeSqm / wM;
      const rot = (seeded(idx + 6) - 0.5) * 0.6;
      const geometry = rectPolygon(cx, cy, wM, hM, rot);

      // Distance from coast (rough: coast runs roughly N-S near lng 24.85 in St Francis)
      // Treat parcels with lng > 24.844 (for SFB cluster) or close to area boundary as beachfront candidates.
      const distToCoastDeg = Math.abs(cx - (area === "Oyster Bay" ? 24.665 : 24.847));
      const beachfront = distToCoastDeg < 0.0008 && seeded(idx + 7) > 0.35;
      const oceanView = beachfront || (distToCoastDeg < 0.002 && seeded(idx + 8) > 0.45);
      const walkToBeach = distToCoastDeg < 0.004;
      const largeErf = sizeSqm > 1500;
      const cornerLot = seeded(idx + 9) > 0.82;
      const vacant = type === "Vacant Land";

      const baseRand = seeded(idx + 10);
      const baseValue =
        type === "Vacant Land" ? 900_000 + baseRand * 2_400_000
        : type === "Commercial" ? 4_800_000 + baseRand * 9_000_000
        : type === "Agricultural" ? 2_400_000 + baseRand * 5_000_000
        : 2_300_000 + baseRand * 6_200_000;
      const valueAdj = (beachfront ? 2.1 : 1) * (oceanView ? 1.28 : 1) * (largeErf ? 1.15 : 1);
      const est = Math.round(baseValue * valueAdj);
      const muni = Math.round(est * (0.55 + seeded(idx + 11) * 0.25));
      const lastSaleYear = 2014 + Math.floor(seeded(idx + 12) * 11);
      const lastSalePrice = Math.round(est * (0.55 + seeded(idx + 13) * 0.35));
      const heldYears = 2026 - lastSaleYear;
      const owner: OwnershipType = seeded(idx + 14) > 0.75 ? "Trust" : seeded(idx + 14) > 0.45 ? "Company" : "Individual";

      const oceanViewScore = beachfront ? 96 : oceanView ? 78 : walkToBeach ? 54 : Math.round(15 + seeded(idx + 15) * 35);
      const investor = Math.round(Math.min(98, 38 + seeded(idx + 16) * 35 + (oceanView ? 14 : 0) + (largeErf ? 8 : 0)));
      const development = Math.round(Math.min(98, (vacant ? 70 : 35) + seeded(idx + 17) * 25 + (largeErf ? 10 : 0) + (cornerLot ? 6 : 0)));
      const liquidity = Math.round(35 + seeded(idx + 18) * 55 + (oceanView ? 8 : 0));
      const walkability = Math.round(30 + seeded(idx + 19) * 60 + (walkToBeach ? 12 : 0));
      const appreciation = Math.round(45 + seeded(idx + 20) * 40 + (beachfront ? 12 : 0));
      const rental = Math.round(40 + seeded(idx + 21) * 45 + (oceanView ? 10 : 0));
      const coastal = beachfront ? 98 : oceanView ? 82 : walkToBeach ? 60 : Math.round(20 + seeded(idx + 22) * 40);

      const status: Property["status"] = heldYears > 10 ? "Held long-term" : heldYears <= 1 ? "Recently sold" : "Off-market";

      out.push({
        id: `parcel-${idx}`,
        erf: `${1200 + idx}`,
        area,
        street: `${10 + (idx % 90)} ${STREETS[idx % STREETS.length]}`,
        type,
        zoning: vacant ? "Single Residential 1" : ZONINGS[Math.floor(seeded(idx + 23) * ZONINGS.length)],
        status,
        sizeSqm,
        estimatedValue: est,
        municipalValue: muni,
        confidence: 0.72 + seeded(idx + 24) * 0.25,
        scores: { investor, development, liquidity, coastal, walkability, oceanView: oceanViewScore, appreciation, rental },
        ownership: {
          type: owner,
          ownerLabel:
            owner === "Trust" ? `The ${["Marina", "Atlantic", "Cape", "Pelican", "Dune"][idx % 5]} Family Trust`
            : owner === "Company" ? `${["Coastal", "Atlas", "Horizon", "Anchor", "Tideline"][idx % 5]} Holdings (Pty) Ltd`
            : `${["J", "M", "R", "S", "T"][idx % 5]}. ${["Bekker", "Naidoo", "Mokoena", "van der Merwe", "Patel"][idx % 5]}`,
          since: `${2008 + Math.floor(seeded(idx + 25) * 14)}-${String(1 + Math.floor(seeded(idx + 26) * 12)).padStart(2, "0")}-12`,
        },
        sales: [
          { date: `${lastSaleYear}-06-14`, price: lastSalePrice },
          { date: `${lastSaleYear - 6}-03-22`, price: Math.round(lastSalePrice * 0.62) },
          { date: `${lastSaleYear - 11}-08-09`, price: Math.round(lastSalePrice * 0.38) },
        ],
        timeline: [
          { date: `${lastSaleYear}-06-14`, title: "Transferred to current owner", kind: "transfer" },
          { date: `${lastSaleYear - 2}-09-01`, title: "Municipal revaluation", kind: "valuation" },
          { date: `${lastSaleYear - 4}-02-18`, title: "Renovation permit issued", kind: "renovation" },
          { date: `${lastSaleYear - 6}-03-22`, title: "Previous transfer", kind: "transfer" },
        ],
        features: {
          beachfront, oceanView, walkingDistanceToBeach: walkToBeach, cornerLot, largeErf, vacantLand: vacant,
        },
        geometry,
        centroid: [cx, cy],
      });
    }
  }
  return out;
}

export const PROPERTIES: Property[] = generateProperties();

export function getProperty(id: string): Property | undefined {
  return PROPERTIES.find((p) => p.id === id);
}

// Convert filtered properties into a GeoJSON FeatureCollection for Mapbox.
export function propertiesToGeoJSON(props: Property[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: props.map((p) => ({
      type: "Feature",
      id: p.id,
      geometry: { type: "Polygon", coordinates: [p.geometry] },
      properties: {
        id: p.id,
        erf: p.erf,
        area: p.area,
        street: p.street,
        type: p.type,
        zoning: p.zoning,
        sizeSqm: p.sizeSqm,
        estimatedValue: p.estimatedValue,
        investor: p.scores.investor,
        development: p.scores.development,
        oceanView: p.scores.oceanView,
        beachfront: p.features.beachfront,
        vacantLand: p.features.vacantLand,
        largeErf: p.features.largeErf,
      },
    })),
  };
}

export function propertiesToCentroidGeoJSON(props: Property[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: props.map((p) => ({
      type: "Feature",
      id: p.id,
      geometry: { type: "Point", coordinates: p.centroid },
      properties: {
        id: p.id,
        estimatedValue: p.estimatedValue,
        investor: p.scores.investor,
        salesRecency: 2026 - new Date(p.sales[0].date).getFullYear(),
      },
    })),
  };
}

export const ST_FRANCIS_CENTER: [number, number] = [24.829, -34.157];
