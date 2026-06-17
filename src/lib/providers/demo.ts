// Demo provider — wraps the existing in-memory PROPERTIES dataset behind the
// PropertyProvider interface so the frontend can be migrated to the abstraction
// without changing behaviour.

import { PROPERTIES, getProperty as getDemoProperty, type Property } from "@/data/properties";
import type { PropertyProvider, SearchInput } from "./PropertyProvider";
import {
  field,
  naField,
  type NormalizedProperty,
  type NormalizedOwnership,
  type NormalizedValuation,
  type NormalizedTransfer,
  type NormalizedGeometry,
  type ProviderMeta,
  type ProviderHealth,
} from "./types";

const SOURCE = "demo" as const;
const NOW = () => new Date().toISOString();

export function normalizeDemoProperty(p: Property): NormalizedProperty {
  const last = p.sales[0];
  const polygon = {
    type: "Polygon" as const,
    coordinates: [p.geometry],
  };
  return {
    id: p.id,
    erf: field(p.erf, SOURCE),
    portion: field("0", SOURCE),
    streetAddress: field(p.street, SOURCE),
    suburb: field(p.area, SOURCE),
    town: field("St Francis Bay", SOURCE),
    municipality: field("Kouga Local Municipality", SOURCE),
    province: field("Eastern Cape", SOURCE),
    coordinates: field(p.centroid, SOURCE),
    landSizeSqm: field(p.sizeSqm, SOURCE),
    propertyType: field(p.type, SOURCE),
    zoning: field(p.zoning, SOURCE),
    municipalValuation: field(p.municipalValue, SOURCE),
    lastSaleDate: field(last?.date ?? null, SOURCE),
    lastSalePrice: field(last?.price ?? null, SOURCE),
    ownershipStatus: field(p.status, SOURCE),
    geometry: { polygon, centroid: p.centroid, source: SOURCE },
    images: field([], SOURCE),
    amenities: field(
      [
        p.features.beachfront ? "Beachfront" : null,
        p.features.oceanView ? "Ocean view" : null,
        p.features.cornerLot ? "Corner lot" : null,
        p.features.largeErf ? "Large erf" : null,
      ].filter(Boolean) as string[],
      SOURCE,
    ),
    reportsAvailable: ["property", "ownership", "valuation", "comparables", "transfers"],
    providerSources: {},
  };
}

export const demoProvider: PropertyProvider = {
  meta: {
    id: SOURCE,
    name: "Demo Dataset",
    description: "PropertyAtlas pilot — St Francis Bay synthetic cadastre.",
    status: "active",
    capabilities: { search: true, ownership: true, valuation: true, transfers: true, geometry: true, reports: true },
  },
  async searchProperties({ query, limit = 8 }: SearchInput) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return PROPERTIES
      .filter((p) =>
        p.street.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q) ||
        p.erf.toLowerCase().includes(q),
      )
      .slice(0, limit)
      .map(normalizeDemoProperty);
  },
  async getProperty(id) {
    const p = getDemoProperty(id);
    return p ? normalizeDemoProperty(p) : null;
  },
  async getGeometry(id): Promise<NormalizedGeometry | null> {
    const p = getDemoProperty(id);
    if (!p) return null;
    return {
      polygon: { type: "Polygon", coordinates: [p.geometry] },
      centroid: p.centroid,
      source: SOURCE,
    };
  },
  async getOwnership(id): Promise<NormalizedOwnership | null> {
    const p = getDemoProperty(id);
    if (!p) return null;
    return {
      ownerLabel: field(p.ownership.ownerLabel, SOURCE),
      ownershipType: field(p.ownership.type, SOURCE),
      since: field(p.ownership.since, SOURCE),
      idNumber: naField(SOURCE),
    };
  },
  async getValuation(id): Promise<NormalizedValuation | null> {
    const p = getDemoProperty(id);
    if (!p) return null;
    return {
      marketEstimate: field(p.estimatedValue, SOURCE),
      municipalValue: field(p.municipalValue, SOURCE),
      confidence: field(p.confidence, SOURCE),
      asOf: field(new Date().toISOString().slice(0, 10), SOURCE),
    };
  },
  async getTransfers(id): Promise<NormalizedTransfer[]> {
    const p = getDemoProperty(id);
    if (!p) return [];
    return p.sales.map((s) => ({
      date: s.date,
      price: s.price,
      buyer: null,
      seller: null,
      deedRef: null,
    }));
  },
  async getReports(id) {
    const p = getDemoProperty(id);
    return p ? ["property", "ownership", "valuation", "comparables", "transfers"] : [];
  },
  async health(): Promise<ProviderHealth> {
    return { status: "active", latencyMs: 12, checkedAt: NOW(), message: "Local dataset" };
  },
};
