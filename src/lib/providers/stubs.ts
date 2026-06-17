// Stub providers for Surveyor General, Municipal GIS, WinDeed, Lightstone.
// They implement the full contract but return empty / Not Available data
// until real integrations are wired up. Switching the active provider in the
// admin panel should never break the frontend.

import type { PropertyProvider } from "./PropertyProvider";
import type { ProviderHealth, ProviderId, ProviderMeta } from "./types";

function notConnectedProvider(meta: ProviderMeta): PropertyProvider {
  const notConnected = async (): Promise<ProviderHealth> => ({
    status: "not_connected",
    checkedAt: new Date().toISOString(),
    message: `${meta.name} integration is not configured.`,
  });
  return {
    meta,
    async searchProperties() { return []; },
    async getProperty() { return null; },
    async getGeometry() { return null; },
    async getOwnership() { return null; },
    async getValuation() { return null; },
    async getTransfers() { return []; },
    async getReports() { return []; },
    health: notConnected,
  };
}

const def = (id: ProviderId, name: string, description: string): ProviderMeta => ({
  id, name, description, status: "not_connected",
  capabilities: { search: true, ownership: true, valuation: true, transfers: true, geometry: true, reports: true },
});

export const surveyorGeneralProvider: PropertyProvider = notConnectedProvider(
  def("surveyor-general", "Surveyor General", "Official SA Surveyor General cadastral data."),
);

export const municipalGisProvider: PropertyProvider = notConnectedProvider(
  def("municipal-gis", "Municipal GIS", "Local municipality GIS feeds — zoning, valuation roll, services."),
);

export const winDeedProvider: PropertyProvider = notConnectedProvider(
  def("windeed", "WinDeed", "Deeds Office search — ownership, transfers, microfilm."),
);

export const lightstoneProvider: PropertyProvider = notConnectedProvider(
  def("lightstone", "Lightstone", "Market valuations, comparable sales, AVM intelligence."),
);
