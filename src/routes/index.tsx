import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { Geometry } from "geojson";
import { LocateFixed, MousePointerClick, Plus, X } from "lucide-react";
import {
  MapCanvas,
  type MapDebugStatus,
  type MapLayers,
  type MapStyleId,
  type OfficialFeatureSelection,
  type OfficialLayerStatus,
  type OfficialReopenResolutionStatus,
  type SearchHighlightOfficialParcel,
  type SearchHighlightStatus,
} from "@/components/map/MapCanvas";
import { SearchBar } from "@/components/map/SearchBar";
import { FilterPanel, DEFAULT_FILTERS, type Filters } from "@/components/map/FilterPanel";
import { LayerSwitcher, DEFAULT_LAYERS, DEMO_LAYERS } from "@/components/map/LayerSwitcher";
import { MapLegend } from "@/components/map/MapLegend";
import { PropertyPanel } from "@/components/property/PropertyPanel";
import { OfficialParcelPanel } from "@/components/property/OfficialParcelPanel";
import { AddPropertyDialog } from "@/components/property/AddPropertyDialog";
import { TopNav } from "@/components/layout/TopNav";
import { FooterMini } from "@/components/layout/Footer";
import { getProperty, type Property } from "@/data/properties";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  clearSavedOfficialReopenSearch,
  parseOfficialParcelReopenSearch,
  type OfficialParcelReopenRequest,
} from "@/lib/parcels/officialParcelId";
import { BRAND } from "@/lib/brand";
import {
  buildOfficialParcelIndex,
  type OfficialParcelFeature,
  type IndexedOfficialParcel,
} from "@/lib/search/officialParcelIndex";
import type { PropertySearchResult } from "@/lib/search/propertySearch";
import type { AddressMapTarget } from "@/components/map/SearchBar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND.site} - ${BRAND.tagline}` },
      {
        name: "description",
        content: `${BRAND.copy.shortPitch} Click an erf, understand public facts, compare the market, save evidence, and follow due diligence steps.`,
      },
      { property: "og:title", content: `${BRAND.site} - ${BRAND.tagline}` },
      {
        property: "og:description",
        content:
          "South Africa's property intelligence platform. Search, research, compare, save evidence.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: AtlasHome,
});

function selectionPointForParcel(parcel: IndexedOfficialParcel): [number, number] | null {
  if (parcel.centroid) return [parcel.centroid.lng, parcel.centroid.lat];
  const lng = Number(
    parcel.properties.TAG_X ?? parcel.properties.LONGITUDE ?? parcel.properties.lng,
  );
  const lat = Number(
    parcel.properties.TAG_Y ?? parcel.properties.LATITUDE ?? parcel.properties.lat,
  );
  if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  return null;
}

function geometryBounds(geometry: Geometry | null): [number, number, number, number] | undefined {
  if (!geometry) return undefined;
  const positions: Array<[number, number]> = [];
  const collect = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number" &&
      Number.isFinite(value[0]) &&
      Number.isFinite(value[1])
    ) {
      positions.push([value[0], value[1]]);
      return;
    }
    for (const item of value) collect(item);
  };
  collect((geometry as { coordinates?: unknown }).coordinates);
  if (!positions.length) return undefined;
  let west = positions[0][0];
  let south = positions[0][1];
  let east = positions[0][0];
  let north = positions[0][1];
  for (const [lng, lat] of positions) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [west, south, east, north];
}

function AtlasHome() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOfficial, setSelectedOfficial] = useState<OfficialFeatureSelection | null>(null);
  const [requestedOfficialParcel, setRequestedOfficialParcel] =
    useState<OfficialParcelReopenRequest | null>(null);
  const [officialReopenStatus, setOfficialReopenStatus] =
    useState<OfficialReopenResolutionStatus>("idle");
  const [hintDismissed, setHintDismissed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [showTestGeometry, setShowTestGeometry] = useState(false);
  const [debugReopenEnabled, setDebugReopenEnabled] = useState(false);
  const [debugSearchParams, setDebugSearchParams] = useState<Record<string, string | null>>({});
  const [mapDebugStatus, setMapDebugStatus] = useState<MapDebugStatus | null>(null);
  const [locateRequestId, setLocateRequestId] = useState(0);
  const [locateMessage, setLocateMessage] = useState<string | null>(null);
  const [officialFeatures, setOfficialFeatures] = useState<OfficialParcelFeature[]>([]);
  const [addressSearchTarget, setAddressSearchTarget] = useState<AddressMapTarget | null>(null);
  const [searchHighlight, setSearchHighlight] = useState<SearchHighlightOfficialParcel | null>(
    null,
  );
  const [searchHighlightStatus, setSearchHighlightStatus] = useState<SearchHighlightStatus>("idle");
  const [officialStatus, setOfficialStatus] = useState<OfficialLayerStatus>({
    csg: { state: "loading", count: 0 },
    kouga: { state: "loading", count: 0 },
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    setHintDismissed(window.localStorage.getItem("pa.hintDismissed") === "1");
    const savedDemoMode = window.localStorage.getItem("pa.demoMode") === "1";
    setDemoMode(savedDemoMode);
    if (savedDemoMode) setLayers(DEMO_LAYERS);
    // Test geometry is only togglable from /admin/public-data-debug. Never on by default.
    setShowTestGeometry(window.localStorage.getItem("pa.testGeometry") === "1");
    const search = window.location.search;
    const params = new URLSearchParams(search);
    setDebugReopenEnabled(params.get("debugReopen") === "1");
    setDebugSearchParams({
      officialParcel: params.get("officialParcel"),
      fromSaved: params.get("fromSaved"),
      lat: params.get("lat"),
      lng: params.get("lng"),
      zoom: params.get("zoom"),
      debugReopen: params.get("debugReopen"),
    });
    const parcel = new URLSearchParams(search).get("parcel");
    if (parcel && getProperty(parcel)) setSelectedId(parcel);
    const officialRequest = parseOfficialParcelReopenSearch(search);
    setRequestedOfficialParcel(officialRequest);
    setOfficialReopenStatus(officialRequest ? "searching" : "idle");
  }, []);
  function dismissHint() {
    setHintDismissed(true);
    try {
      window.localStorage.setItem("pa.hintDismissed", "1");
    } catch {
      // Ignore storage failures; the hint can safely remain dismissible in memory.
    }
  }
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [mapStyle, setMapStyle] = useState<MapStyleId>("satellite");

  // Demo Mode is no longer exposed in the public map UI. It remains available via
  // /admin/public-data-debug and is restored from localStorage for admins who set it.
  void setDemoMode;

  const clearSavedReopenUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    const nextSearch = clearSavedOfficialReopenSearch(window.location.search);
    const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, []);

  const clearSavedReopenState = useCallback(() => {
    setRequestedOfficialParcel(null);
    setOfficialReopenStatus("idle");
    clearSavedReopenUrl();
  }, [clearSavedReopenUrl]);

  const handleMapSelect = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id) {
        setSelectedOfficial(null);
        setSearchHighlight(null);
        setSearchHighlightStatus("idle");
        clearSavedReopenState();
      }
    },
    [clearSavedReopenState],
  );

  const handleOfficialSelect = useCallback(
    (sel: OfficialFeatureSelection | null) => {
      setSelectedOfficial(sel);
      if (sel) {
        setSelectedId(null);
        setSearchHighlight(null);
        setSearchHighlightStatus("idle");
        setRequestedOfficialParcel(null);
        setOfficialReopenStatus("resolved");
        clearSavedReopenUrl();
      }
    },
    [clearSavedReopenUrl],
  );

  const selected = selectedId ? (getProperty(selectedId) ?? null) : null;
  const officialParcelIndex = useMemo(
    () => buildOfficialParcelIndex(officialFeatures),
    [officialFeatures],
  );
  const showOfficialReopenCard = Boolean(requestedOfficialParcel && !selectedOfficial);
  const officialReopenTarget = useMemo(() => {
    if (requestedOfficialParcel?.lng === undefined || requestedOfficialParcel.lat === undefined) {
      return null;
    }
    return {
      lng: requestedOfficialParcel.lng,
      lat: requestedOfficialParcel.lat,
      zoom: requestedOfficialParcel.zoom ?? 17,
    };
  }, [requestedOfficialParcel]);

  const filterFn = useMemo(() => {
    return (p: Property) => {
      if (filters.types.length && !filters.types.includes(p.type)) return false;
      if (filters.beachfrontOnly && !p.features.beachfront) return false;
      if (filters.oceanViewOnly && !p.features.oceanView) return false;
      if (filters.largeErfOnly && !p.features.largeErf) return false;
      if (filters.cornerLotOnly && !p.features.cornerLot) return false;
      if (filters.minInvestorScore && p.scores.investor < filters.minInvestorScore) return false;
      if (filters.minDevelopmentScore && p.scores.development < filters.minDevelopmentScore)
        return false;
      if (filters.ownership.length && !filters.ownership.includes(p.ownership.type)) return false;
      const lastYear = new Date(p.sales[0].date).getFullYear();
      if (filters.recentSalesOnly && 2026 - lastYear > 1) return false;
      if (filters.longHeldOnly && 2026 - lastYear < 10) return false;
      return true;
    };
  }, [filters]);

  const handleOfficialSearchPick = useCallback(
    (result: PropertySearchResult) => {
      const parcel = result.parcel;
      if (!parcel) return;
      const lngLat = selectionPointForParcel(parcel);
      if (!lngLat) return;
      setSelectedId(null);
      setSelectedOfficial({
        source: parcel.sourceLabel as OfficialFeatureSelection["source"],
        layer: parcel.layer as OfficialFeatureSelection["layer"],

        properties: parcel.properties,
        lngLat,
      });
      setRequestedOfficialParcel(null);
      setOfficialReopenStatus("resolved");
      clearSavedReopenUrl();
    },
    [clearSavedReopenUrl],
  );

  const handleOfficialSearchHighlight = useCallback((result: PropertySearchResult) => {
    const parcel = result.parcel;
    if (!parcel) return;
    const lngLat = selectionPointForParcel(parcel);
    if (!lngLat) return;
    setSelectedId(null);
    setSelectedOfficial(null);
    setRequestedOfficialParcel(null);
    setOfficialReopenStatus("idle");
    setSearchHighlightStatus("searching");
    setSearchHighlight({
      id: parcel.id,
      title: result.title,
      layer: parcel.layer,
      properties: parcel.properties,
      lngLat,
      lpi: parcel.lpi,
      parcelKey: parcel.parcelKey,
      erf: parcel.erf,
      portion: parcel.portion,
      town: parcel.town,
      municipality: parcel.municipality,
      province: parcel.province,
      bounds: geometryBounds(parcel.geometry),
    });
  }, []);

  const handleLogoHomeClick = useCallback(() => {
    setSelectedId(null);
    setSelectedOfficial(null);
    setRequestedOfficialParcel(null);
    setOfficialReopenStatus("idle");
    setSearchHighlight(null);
    setSearchHighlightStatus("idle");
    setAddressSearchTarget(null);
    setAddOpen(false);
    clearSavedReopenUrl();
  }, [clearSavedReopenUrl]);

  const headerSubtitle = (
    <span className="inline-flex items-center gap-2 tracking-tight">
      <span className="font-semibold text-white">Every erf. All the facts.</span>
      <span className="text-white/55">Research any South African erf.</span>
    </span>
  );

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <h1 className="sr-only">{BRAND.site} - Map-based property intelligence for South Africa</h1>
      <MapCanvas
        selectedId={selectedId}
        onSelect={handleMapSelect}
        filterFn={filterFn}
        layers={layers}
        mapStyle={mapStyle}
        showTestGeometry={showTestGeometry}
        onSelectOfficial={handleOfficialSelect}
        onOfficialStatus={setOfficialStatus}
        officialReopenTarget={officialReopenTarget}
        officialReopenRequest={requestedOfficialParcel}
        onOfficialReopenStatus={setOfficialReopenStatus}
        onDebugStatus={debugReopenEnabled ? setMapDebugStatus : undefined}
        locateRequestId={locateRequestId}
        onLocateResult={setLocateMessage}
        onOfficialFeaturesChange={setOfficialFeatures}
        addressSearchTarget={addressSearchTarget}
        searchHighlightOfficialParcel={searchHighlight}
        onSearchHighlightStatus={setSearchHighlightStatus}
      />
      <MapLegend layers={layers} />
      <TopNav
        onLogoClick={handleLogoHomeClick}
        center={
          <SearchBar
            officialParcels={officialParcelIndex}
            onOpenOfficialWorkbench={handleOfficialSearchPick}
            onHighlightOfficialFromSearch={handleOfficialSearchHighlight}
            onLocateAddress={setAddressSearchTarget}
          />
        }
        mobileCenter={
          <SearchBar
            officialParcels={officialParcelIndex}
            onOpenOfficialWorkbench={handleOfficialSearchPick}
            onHighlightOfficialFromSearch={handleOfficialSearchHighlight}
            onLocateAddress={setAddressSearchTarget}
          />
        }
        subtitle={headerSubtitle}
      />

      {debugReopenEnabled && (
        <DebugReopenPanel
          searchParams={debugSearchParams}
          mapStatus={mapDebugStatus}
          reopenStatus={officialReopenStatus}
        />
      )}

      {searchHighlight && !selectedOfficial && (
        <div className="pointer-events-auto absolute left-1/2 top-[13.5rem] z-20 w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-[#FF6A00]/25 bg-white/95 p-4 text-center shadow-panel backdrop-blur md:top-[6rem]">
          <p className="text-sm font-bold text-[#0D1B2A]">
            {searchHighlightStatus === "highlighted"
              ? `${searchHighlight.title} highlighted.`
              : searchHighlightStatus === "fallback"
                ? "Official parcel found."
                : `Finding ${searchHighlight.title} on the map.`}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/64">
            {searchHighlightStatus === "highlighted"
              ? "Click the highlighted erf to open the Workbench."
              : searchHighlightStatus === "fallback"
                ? "Boundary highlight unavailable until the layer loads. Click the nearby official parcel outline to open the Workbench."
                : "Easy Erf is matching the result to the rendered official parcel outline. If the boundary is still loading, the map will keep a marker at the official parcel context."}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchHighlight(null);
              setSearchHighlightStatus("idle");
            }}
            className="mt-3 rounded-full border border-[#0D1B2A]/10 px-3 py-1.5 text-xs font-bold text-[#0D1B2A] hover:bg-[#fbf8f1]"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+8.75rem)] z-20 flex flex-col items-center gap-2 px-3 sm:top-[calc(env(safe-area-inset-top)+10.5rem)] md:top-[6.25rem] md:px-4">
        <div className="pointer-events-auto flex w-full max-w-[23rem] items-center justify-center gap-2 overflow-x-auto sm:w-auto sm:max-w-none">
          <button
            type="button"
            onClick={() => {
              setLocateMessage(null);
              setLocateRequestId((value) => value + 1);
            }}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 bg-[#0D1B2A]/75 px-4 py-2 text-[12px] font-semibold text-white shadow-[0_10px_30px_-14px_rgba(0,0,0,0.7)] backdrop-blur-xl transition hover:bg-[#0D1B2A]/90"
          >
            <LocateFixed className="h-3.5 w-3.5 text-[#FF6A00]" />
            Locate me
          </button>
          <FilterPanel value={filters} onChange={setFilters} />
          <LayerSwitcher
            layers={layers}
            onLayersChange={setLayers}
            style={mapStyle}
            onStyleChange={setMapStyle}
            officialStatus={officialStatus}
          />
        </div>

        {!demoMode && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/10 bg-[#0D1B2A]/70 px-3 py-1.5 shadow-[0_10px_30px_-16px_rgba(0,0,0,0.65)] backdrop-blur-xl">
            <OfficialPill label="CSG" status={officialStatus.csg} />
            <OfficialPill label="Kouga" status={officialStatus.kouga} />
          </div>
        )}
        {locateMessage && (
          <div className="pointer-events-auto max-w-xl rounded-2xl border border-white/10 bg-[#0D1B2A]/85 px-3 py-2 text-center text-xs font-medium text-white/80 shadow-[0_14px_34px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl">
            {locateMessage}
          </div>
        )}
      </div>

      {!demoMode &&
        officialStatus.csg.state !== "loading" &&
        officialStatus.kouga.state !== "loading" &&
        officialStatus.csg.count === 0 && (
          <div className="pointer-events-auto absolute left-1/2 top-[13.5rem] z-20 w-[min(92vw,42rem)] -translate-x-1/2 rounded-2xl border border-border bg-card/95 p-4 text-center shadow-panel backdrop-blur">
            <p className="text-sm font-semibold text-foreground">
              Official parcel data is temporarily unavailable. Try again or open source maps.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                className="rounded-full bg-foreground px-3 py-2 text-[11px] font-semibold text-background hover:opacity-90"
                onClick={() => window.location.reload()}
              >
                Retry official data
              </button>
              <a
                className="rounded-full bg-card px-3 py-2 text-[11px] font-semibold text-foreground ring-1 ring-border hover:bg-muted"
                href="https://experience.arcgis.com/experience/e498b2a5005a4d278eb7f32984676140/page/Main-Map"
                target="_blank"
                rel="noreferrer"
              >
                Open Kouga Public Map
              </a>
              <a
                className="rounded-full bg-card px-3 py-2 text-[11px] font-semibold text-foreground ring-1 ring-border hover:bg-muted"
                href="/admin/public-data-debug"
              >
                Open Public Data Debug
              </a>
            </div>
          </div>
        )}

      {showOfficialReopenCard && (
        <div className="pointer-events-auto absolute right-4 top-[13.5rem] z-20 w-[min(92vw,26rem)] rounded-xl border border-border bg-card/95 p-4 shadow-panel backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              {officialReopenStatus === "not-found"
                ? "Could not auto-open saved parcel"
                : "Finding saved official parcel…"}
            </p>
            <button
              type="button"
              onClick={clearSavedReopenState}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="Dismiss saved official parcel helper"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {officialReopenStatus === "not-found"
              ? officialReopenTarget
                ? "The map is centered near the saved parcel area. Click the official parcel outline to open the live public-data dossier."
                : "Click the official parcel outline to open the live public-data dossier."
              : "We are matching the saved parcel to the official map outline."}
          </p>
          <div className="mt-3 space-y-1 rounded-xl bg-muted/60 p-3 text-[11px]">
            {requestedOfficialParcel?.title && (
              <div className="font-semibold text-foreground">{requestedOfficialParcel.title}</div>
            )}
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground">
              {requestedOfficialParcel?.erf && <span>Erf {requestedOfficialParcel.erf}</span>}
              {requestedOfficialParcel?.portion && (
                <span>Portion {requestedOfficialParcel.portion}</span>
              )}
              {requestedOfficialParcel?.municipality && (
                <span>{requestedOfficialParcel.municipality}</span>
              )}
              {requestedOfficialParcel?.province && <span>{requestedOfficialParcel.province}</span>}
            </div>
            <div className="break-all font-mono text-[10px] text-muted-foreground">
              {requestedOfficialParcel?.id}
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
            {officialReopenStatus === "not-found"
              ? "No geometry has been fabricated."
              : "No geometry has been fabricated. The live dossier will open if a matching official feature is found."}
          </p>
        </div>
      )}

      {!requestedOfficialParcel && !selected && !selectedOfficial && !hintDismissed && (
        <div className="pointer-events-auto absolute inset-x-4 bottom-20 z-20 mx-auto flex max-w-sm items-start gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-panel backdrop-blur md:bottom-12 md:left-1/2 md:right-auto md:-translate-x-1/2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-brand text-white">
            <MousePointerClick className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold leading-tight">
              {demoMode ? "Click a demo parcel" : "Zoom in and click a CSG parcel"}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {demoMode
                ? "Open the demo property panel: valuation, last sale, ownership, scores."
                : "Open the official public cadastral record from the Chief Surveyor-General."}
            </p>
          </div>
          <button
            onClick={dismissHint}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-16 left-4 z-20 hidden max-w-md md:block">
        <div className="rounded-2xl border border-white/10 bg-[#06152A]/85 px-4 py-3 text-[11px] font-medium text-white/75 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,106,0,0.05),0_0_40px_-10px_rgba(255,106,0,0.25)] backdrop-blur-xl">
          {demoMode ? (
            <>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF8A33]">
                Demo Data
              </div>
              <div className="text-white/80">
                Pilot region · St Francis Bay. Mock property information shown for demonstration.
              </div>
            </>
          ) : (
            <>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF8A33]">
                Official Public Data
              </div>
              <div className="text-white/80">
                Chief Surveyor-General cadastral · Kouga Municipality zoning. Pilot — St Francis Bay.
              </div>
            </>
          )}
        </div>
      </div>

      <button
        onClick={() => setAddOpen(true)}
        className="pointer-events-auto absolute bottom-24 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#06152A]/90 px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8),0_0_20px_-6px_rgba(255,106,0,0.35)] backdrop-blur-xl transition hover:bg-[#0D1B2A] md:bottom-14 md:right-6"
        title="Add a property to your research"
      >
        <Plus className="h-3.5 w-3.5 text-[#FF6A00]" /> Add property
      </button>

      <FooterMini />

      {selectedOfficial ? (
        <OfficialParcelPanel
          selection={selectedOfficial}
          onClose={() => setSelectedOfficial(null)}
        />
      ) : (
        <PropertyPanel property={selected} onClose={() => setSelectedId(null)} />
      )}
      {addOpen && <AddPropertyDialog onClose={() => setAddOpen(false)} />}
      <Toaster position="top-center" />
    </div>
  );
}

function DebugReopenPanel({
  searchParams,
  mapStatus,
  reopenStatus,
}: {
  searchParams: Record<string, string | null>;
  mapStatus: MapDebugStatus | null;
  reopenStatus: OfficialReopenResolutionStatus;
}) {
  const yesNo = (value: boolean | undefined) =>
    value === undefined ? "unknown" : value ? "yes" : "no";
  const paramRows = ["officialParcel", "fromSaved", "lat", "lng", "zoom", "debugReopen"];

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-50 w-[min(94vw,28rem)] rounded-xl border-4 border-red-500 bg-black p-4 font-mono text-xs text-white shadow-2xl">
      <div className="text-base font-black uppercase tracking-wide text-red-300">
        EASY ERF DEBUG BUILD
      </div>
      <div className="mt-1 text-sm font-bold text-accent">Build label: saved-reopen-debug-v1</div>

      <div className="mt-3 font-bold text-red-200">Current URL search params:</div>
      <dl className="mt-1 grid grid-cols-[8rem_1fr] gap-x-2 gap-y-1">
        {paramRows.map((key) => (
          <Fragment key={key}>
            <dt className="text-slate-300">{key}</dt>
            <dd className="break-all text-white">{searchParams[key] ?? "(missing)"}</dd>
          </Fragment>
        ))}
      </dl>

      <div className="mt-3 font-bold text-red-200">Map status:</div>
      <dl className="mt-1 grid grid-cols-[10rem_1fr] gap-x-2 gap-y-1">
        <dt className="text-slate-300">map loaded</dt>
        <dd>{yesNo(mapStatus?.mapLoaded)}</dd>
        <dt className="text-slate-300">CSG source exists</dt>
        <dd>{yesNo(mapStatus?.csgSourceExists)}</dd>
        <dt className="text-slate-300">CSG layer exists</dt>
        <dd>{yesNo(mapStatus?.csgLayerExists)}</dd>
        <dt className="text-slate-300">Kouga source exists</dt>
        <dd>{yesNo(mapStatus?.kougaSourceExists)}</dd>
        <dt className="text-slate-300">Kouga layer exists</dt>
        <dd>{yesNo(mapStatus?.kougaLayerExists)}</dd>
      </dl>

      <div className="mt-3 font-bold text-red-200">Saved reopen status:</div>
      <div className="mt-1 text-lg font-black text-lime-300">{reopenStatus}</div>
    </div>
  );
}

function OfficialPill({
  label,
  status,
}: {
  label: string;
  status: OfficialLayerStatus["csg"] | OfficialLayerStatus["kouga"];
}) {
  if (status.state === "off") return null;
  const map: Record<string, { tone: string; text: string }> = {
    loading: {
      tone: "bg-white/5 text-white/70",
      text: `${label} loading…`,
    },
    loaded: {
      tone: "bg-emerald-500/15 text-emerald-300",
      text:
        label === "CSG"
          ? `CSG parcels loaded: ${status.count}`
          : `Kouga zoning loaded: ${status.count}`,
    },
    imported: {
      tone: "bg-sky-500/15 text-sky-300",
      text:
        label === "CSG"
          ? `CSG parcels loaded (imported): ${status.count}`
          : `Kouga zoning loaded (imported): ${status.count}`,
    },
    test: {
      tone: "bg-[#FF6A00]/20 text-[#FF8A33]",
      text: "TEST GEOMETRY ONLY — not official data",
    },
    empty: {
      tone: "bg-white/5 text-white/70",
      text:
        label === "CSG" ? "No CSG parcels in this view" : "Kouga zoning unavailable for this view",
    },
    failed: {
      tone: "bg-white/5 text-white/70",
      text: label === "CSG" ? "CSG unavailable" : "Kouga zoning unavailable",
    },
  };
  const v = map[status.state] ?? map.empty;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold",
        v.tone,
      )}
      title={status.message ?? undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {v.text}
    </span>
  );
}
