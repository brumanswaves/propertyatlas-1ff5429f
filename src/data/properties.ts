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
  sellerProbability: number; // 0-100; >70 = High
  lifestyle: number;
}

export interface PropertyDistances {
  beachM: number;
  harbourM: number;
  golfM: number;
  villageM: number;
  restaurantsM: number;
}

export interface SaleRecord {
  date: string;
  price: number;
}

export type HistoryKind = "sold" | "listed" | "rented" | "withdrawn" | "valuation" | "renovation";

export interface HistoryRecord {
  date: string;
  kind: HistoryKind;
  price?: number;
  note?: string;
  party?: string;
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
  distances: PropertyDistances;
  ownership: OwnershipRecord;
  sales: SaleRecord[];
  history: HistoryRecord[];
  timeline: TimelineEvent[];
  features: {
    beachfront: boolean;
    oceanView: boolean;
    walkingDistanceToBeach: boolean;
    cornerLot: boolean;
    largeErf: boolean;
    vacantLand: boolean;
  };
  geometry: [number, number][];
  centroid: [number, number];
}

const AREAS: { name: AreaName; center: [number, number]; spread: number; density: number }[] = [
  { name: "Santareme",       center: [24.838, -34.155], spread: 0.0042, density: 55 },
  { name: "St Francis Bay",  center: [24.830, -34.168], spread: 0.0065, density: 95 },
  { name: "Port St Francis", center: [24.847, -34.185], spread: 0.0040, density: 50 },
  { name: "Cape St Francis", center: [24.838, -34.203], spread: 0.0062, density: 70 },
  { name: "Oyster Bay",      center: [24.667, -34.172], spread: 0.0055, density: 45 },
];

// Local St Francis landmarks for distance computation (mock)
const LANDMARKS = {
  beachLng: 24.8475,             // approx coast line (N-S)
  oysterBayBeachLng: 24.6655,
  harbour: [24.8470, -34.1855] as [number, number],     // Port St Francis
  golf:    [24.8125, -34.1790] as [number, number],     // St Francis Links
  village: [24.8360, -34.1685] as [number, number],     // St Francis village centre
  restaurants: [24.8390, -34.1672] as [number, number], // ~Anchorage / Harbour
};

const TYPES: PropertyType[] = [
  "Residential", "Residential", "Residential", "Residential",
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

function metersBetween(a: [number, number], b: [number, number]): number {
  const dx = (a[0] - b[0]) * M_PER_DEG_LNG_AT_34;
  const dy = (a[1] - b[1]) * M_PER_DEG_LAT;
  return Math.sqrt(dx * dx + dy * dy);
}

function rectPolygon(cx: number, cy: number, wMeters: number, hMeters: number, rotateRad: number): [number, number][] {
  const dx = wMeters / M_PER_DEG_LNG_AT_34 / 2;
  const dy = hMeters / M_PER_DEG_LAT / 2;
  const cos = Math.cos(rotateRad), sin = Math.sin(rotateRad);
  const corners: [number, number][] = [[-dx, -dy], [dx, -dy], [dx, dy], [-dx, dy]];
  const rotated = corners.map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos] as [number, number]);
  return [...rotated, rotated[0]];
}

export function formatZAR(n: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(n);
}

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 80)); // ~4.8 km/h
}

export function driveMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 500)); // ~30 km/h local
}

const AGENCIES = ["Pam Golding", "Seeff", "Chas Everitt", "RE/MAX Coastal", "Harcourts"];
const TENANTS = ["Family relocation", "Holiday let", "Long-let tenant", "Corporate let"];

function buildHistory(idx: number, lastSaleYear: number, lastSalePrice: number, est: number, vacant: boolean): HistoryRecord[] {
  const records: HistoryRecord[] = [];
  const now = 2026;
  const cutoff = now - 10;

  records.push({ date: `${lastSaleYear}-06-14`, kind: "sold", price: lastSalePrice, party: AGENCIES[idx % AGENCIES.length] });
  records.push({ date: `${lastSaleYear}-02-03`, kind: "listed", price: Math.round(lastSalePrice * 1.08), party: AGENCIES[idx % AGENCIES.length] });

  if (!vacant) {
    const monthlyRent = Math.round((est * 0.0055) / 100) * 100;
    for (let y = lastSaleYear + 1; y <= now && y - lastSaleYear <= 8; y += 2) {
      if (y < cutoff) continue;
      records.push({
        date: `${y}-${String(1 + ((idx + y) % 11)).padStart(2, "0")}-05`,
        kind: "rented",
        price: Math.round(monthlyRent * (0.92 + seeded(idx + y) * 0.25)),
        party: TENANTS[(idx + y) % TENANTS.length],
        note: "12-month lease",
      });
    }
  }

  const prevSaleYear = lastSaleYear - 6;
  if (prevSaleYear >= cutoff) {
    records.push({ date: `${prevSaleYear}-03-22`, kind: "sold", price: Math.round(lastSalePrice * 0.62), party: AGENCIES[(idx + 2) % AGENCIES.length] });
    records.push({ date: `${prevSaleYear - 1}-10-11`, kind: "withdrawn", note: "Listing withdrawn", party: AGENCIES[(idx + 1) % AGENCIES.length] });
  }

  records.push({ date: `${lastSaleYear - 2}-09-01`, kind: "valuation", price: Math.round(est * 0.82), note: "Municipal revaluation" });
  if (lastSaleYear - 5 >= cutoff) {
    records.push({ date: `${lastSaleYear - 5}-09-01`, kind: "valuation", price: Math.round(est * 0.55), note: "Municipal revaluation" });
  }

  if (!vacant && seeded(idx + 77) > 0.55 && lastSaleYear - 4 >= cutoff) {
    records.push({ date: `${lastSaleYear - 4}-02-18`, kind: "renovation", note: "Renovation permit issued" });
  }

  return records
    .filter((r) => Number(r.date.slice(0, 4)) >= cutoff)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function generateProperties(): Property[] {
  const out: Property[] = [];
  let idx = 0;
  for (const { name: area, center, spread, density } of AREAS) {
    for (let i = 0; i < density; i++) {
      idx++;
      const r = Math.sqrt(seeded(idx + 1)) * spread;
      const theta = seeded(idx + 2) * Math.PI * 2;
      const cx = center[0] + r * Math.cos(theta) * (M_PER_DEG_LAT / M_PER_DEG_LNG_AT_34);
      const cy = center[1] + r * Math.sin(theta);

      const type = TYPES[Math.floor(seeded(idx + 3) * TYPES.length)];
      const sizeSqm = type === "Agricultural"
        ? Math.round(8_000 + seeded(idx + 4) * 30_000)
        : type === "Vacant Land"
          ? Math.round(1_400 + seeded(idx + 4) * 2_400)
          : Math.round(900 + seeded(idx + 4) * 2_200);
      const side = Math.sqrt(sizeSqm);
      const wM = side * (0.85 + seeded(idx + 5) * 0.3);
      const hM = sizeSqm / wM;
      const rot = (seeded(idx + 6) - 0.5) * 0.6;
      const geometry = rectPolygon(cx, cy, wM, hM, rot);

      const coastLng = area === "Oyster Bay" ? LANDMARKS.oysterBayBeachLng : LANDMARKS.beachLng;
      const distToCoastDeg = Math.abs(cx - coastLng);
      const beachfront = distToCoastDeg < 0.0009 && seeded(idx + 7) > 0.35;
      const oceanView = beachfront || (distToCoastDeg < 0.0022 && seeded(idx + 8) > 0.45);
      const walkToBeach = distToCoastDeg < 0.0045;
      const largeErf = sizeSqm > 1500;
      const cornerLot = seeded(idx + 9) > 0.82;
      const vacant = type === "Vacant Land";

      // Distances (m) to local landmarks
      const beachM = Math.round(distToCoastDeg * M_PER_DEG_LNG_AT_34);
      const harbourM = Math.round(metersBetween([cx, cy], LANDMARKS.harbour));
      const golfM = Math.round(metersBetween([cx, cy], LANDMARKS.golf));
      const villageM = Math.round(metersBetween([cx, cy], LANDMARKS.village));
      const restaurantsM = Math.round(metersBetween([cx, cy], LANDMARKS.restaurants));

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

      // Lifestyle: weighted blend of nearby amenities (walking-distance)
      const beachLifestyle = beachM < 500 ? 95 : beachM < 1200 ? 75 : beachM < 2500 ? 55 : 30;
      const golfLifestyle = golfM < 2000 ? 85 : golfM < 5000 ? 60 : 35;
      const villageLifestyle = villageM < 800 ? 90 : villageM < 2000 ? 65 : 40;
      const lifestyle = Math.round(beachLifestyle * 0.45 + golfLifestyle * 0.2 + villageLifestyle * 0.35);

      // Seller probability — modelled from ownership tenure, appreciation, market cycle
      // Long-held (>12y) + strong appreciation + Individual owner = higher probability
      const tenureSignal = heldYears >= 14 ? 35 : heldYears >= 9 ? 22 : heldYears >= 5 ? 10 : 4;
      const apprSignal = appreciation >= 75 ? 22 : appreciation >= 60 ? 14 : 6;
      const ownerSignal = owner === "Individual" ? 18 : owner === "Trust" ? 8 : 12;
      const marketSignal = 8 + seeded(idx + 33) * 16; // mock current market temperature
      const sellerProbability = Math.round(Math.min(96, Math.max(8, tenureSignal + apprSignal + ownerSignal + marketSignal)));

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
        scores: { investor, development, liquidity, coastal, walkability, oceanView: oceanViewScore, appreciation, rental, sellerProbability, lifestyle },
        distances: { beachM, harbourM, golfM, villageM, restaurantsM },
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
        history: buildHistory(idx, lastSaleYear, lastSalePrice, est, vacant),
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
        appreciation: p.scores.appreciation,
        rental: p.scores.rental,
        sellerProbability: p.scores.sellerProbability,
        heldYears: 2026 - new Date(p.ownership.since).getFullYear(),
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
        development: p.scores.development,
        oceanView: p.scores.oceanView,
        appreciation: p.scores.appreciation,
        rental: p.scores.rental,
        sellerProbability: p.scores.sellerProbability,
        salesRecency: 2026 - new Date(p.sales[0].date).getFullYear(),
        heldYears: 2026 - new Date(p.ownership.since).getFullYear(),
      },
    })),
  };
}

export const ST_FRANCIS_CENTER: [number, number] = [24.830, -34.168];
