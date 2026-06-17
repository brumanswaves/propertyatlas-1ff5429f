// Per-provider integration readiness checklist. Pure data so it can be
// rendered on the admin page and also imported by tests / dashboards.

import type { ProviderId } from "./types";

export type ReadinessStatus = "done" | "partial" | "todo" | "blocked";

export interface ReadinessItem {
  id: string;
  label: string;
  status: ReadinessStatus;
  /** Optional pointer to a schema table or code module. */
  ref?: string;
  note?: string;
}

export interface ProviderReadiness {
  provider: ProviderId;
  name: string;
  legal: string;
  items: ReadinessItem[];
}

const adapterShared = (provider: ProviderId, name: string): ReadinessItem[] => [
  {
    id: "adapter",
    label: "API adapter implements PropertyProvider contract",
    status: provider === "demo" ? "done" : "todo",
    ref: `src/lib/providers/${provider === "demo" ? "demo.ts" : "stubs.ts"}`,
  },
  {
    id: "server-side",
    label: "Adapter runs server-side (createServerFn, no browser credentials)",
    status: "todo",
    ref: "src/lib/providers/server.functions.ts (planned)",
  },
  {
    id: "error-shape",
    label: "Throws ProviderError with retryable flag",
    status: "done",
    ref: "src/lib/providers/errors.ts",
  },
  {
    id: "audit",
    label: "Writes provider_audit_log row per lookup",
    status: "todo",
    ref: "table: provider_audit_log",
  },
  {
    id: "cache",
    label: "Writes provider_cache with vendor-mandated TTL",
    status: "todo",
    ref: "table: provider_cache",
  },
  {
    id: "health",
    label: "health() returns active in staging (p95 < 1500ms)",
    status: provider === "demo" ? "done" : "todo",
  },
  {
    id: "settings",
    label: "Enabled via provider_settings (admin-only)",
    status: provider === "demo" ? "done" : "todo",
    ref: "table: provider_settings",
  },
  {
    id: "contract-tests",
    label: "Passes adapter contract test suite",
    status: "done",
    ref: "src/lib/providers/__tests__/contract.test.ts",
  },
  {
    id: "legal",
    label: "Signed contract / license / DPA on file",
    status: provider === "demo" ? "done" : "blocked",
    note: name,
  },
];

export const PROVIDER_READINESS: ProviderReadiness[] = [
  {
    provider: "demo",
    name: "Demo dataset",
    legal: "Internal — synthetic data only",
    items: [
      ...adapterShared("demo", "Demo"),
      { id: "data", label: "Source dataset bundled", status: "done", ref: "src/data/properties.ts" },
    ],
  },
  {
    provider: "surveyor-general",
    name: "Surveyor General (CSG)",
    legal: "DRDLR data-use agreement required for storage; public viewer used live",
    items: [
      ...adapterShared("surveyor-general", "CSG"),
      {
        id: "live-proxy",
        label: "Server-side ArcGIS proxy with allow-list",
        status: "done",
        ref: "src/lib/providers/arcgis.functions.ts",
      },
      {
        id: "map-toggle",
        label: "CSG Parcels layer toggle on the map",
        status: "done",
        ref: "MapLayers.csgParcels",
      },
      {
        id: "multipolygon",
        label: "NormalizedGeometry supports MultiPolygon (portions)",
        status: "done",
        ref: "src/lib/providers/types.ts → GeoJSONShape",
      },
      {
        id: "reprojection",
        label: "Hartebeesthoek94 LO → WGS84 reprojection helper",
        status: "done",
        ref: "src/lib/geo/reproject.ts",
      },
      {
        id: "cadastral-id",
        label: "Cadastral key (province + LPI) mapping to internal id",
        status: "todo",
      },
    ],
  },
  {
    provider: "municipal-gis",
    name: "Kouga Municipal GIS",
    legal: "Per-municipality data licence; public Hub used live in pilot",
    items: [
      ...adapterShared("municipal-gis", "Kouga"),
      {
        id: "live-proxy",
        label: "Server-side ArcGIS proxy with allow-list",
        status: "done",
        ref: "src/lib/providers/arcgis.functions.ts",
      },
      {
        id: "kouga-endpoint",
        label: "Confirmed Kouga ArcGIS feature service URL",
        status: "todo",
        note: "Awaiting confirmation from municipality",
      },
      {
        id: "submunis",
        label: "Per-municipality sub-adapter registry",
        status: "todo",
      },
      { id: "valroll", label: "Valuation roll ingest + refresh cadence", status: "todo" },
      { id: "zoning", label: "Zoning scheme normalization", status: "todo" },
    ],
  },
  {
    provider: "windeed",
    name: "WinDeed",
    legal: "Commercial subscription + POPIA purpose-of-use",
    items: [
      ...adapterShared("windeed", "WinDeed"),
      { id: "purpose", label: "Purpose-of-use prompt before every lookup", status: "todo" },
      { id: "id-masking", label: "ID number masking respected in UI", status: "partial", ref: "Field.compliance.displayAllowed" },
      { id: "billing", label: "Per-query billing capture", status: "todo" },
    ],
  },
  {
    provider: "lightstone",
    name: "Lightstone",
    legal: "Commercial contract + AVM display rules",
    items: [
      ...adapterShared("lightstone", "Lightstone"),
      { id: "comparables", label: "getComparables(id) extension on contract", status: "todo" },
      { id: "avm-version", label: "Persist AVM model_version with cached valuations", status: "todo" },
      { id: "report-webhook", label: "Webhook → mark report_orders complete + attach PDF", status: "todo", ref: "/api/public/webhooks/lightstone" },
    ],
  },
];
