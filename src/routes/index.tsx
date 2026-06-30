import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { MousePointerClick, Plus, X } from "lucide-react";
import {
  MapCanvas,
  type MapDebugStatus,
  type MapLayers,
  type MapStyleId,
  type OfficialFeatureSelection,
  type OfficialLayerStatus,
  type OfficialReopenResolutionStatus,
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ErfStoep — Every erf. All the facts." },
      {
        name: "description",
        content:
          "Search any erf, understand the facts, compare the market, ask AI, save evidence, and make better property decisions. South Africa's property intelligence platform.",
      },
      { property: "og:title", content: "ErfStoep — Every erf. All the facts." },
      {
        property: "og:description",
        content: "South Africa's property intelligence platform. Search, research, compare, save evidence.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: AtlasHome,
});

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
        setRequestedOfficialParcel(null);
        setOfficialReopenStatus("resolved");
        clearSavedReopenUrl();
      }
    },
    [clearSavedReopenUrl],
  );

  const selected = selectedId ? (getProperty(selectedId) ?? null) : null;
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

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <h1 className="sr-only">ErfStoep — Map-based property intelligence for South Africa</h1>
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
      />
      <MapLegend layers={layers} />
      <TopNav />

      {debugReopenEnabled && (
        <DebugReopenPanel
          searchParams={debugSearchParams}
          mapStatus={mapDebugStatus}
          reopenStatus={officialReopenStatus}
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex flex-col items-center gap-2 px-4 md:top-24">
        <div className="pointer-events-auto relative z-10 w-full max-w-xl">
          <SearchBar
            onPick={(p) => {
              setSelectedId(p.id);
              setSelectedOfficial(null);
              clearSavedReopenState();
            }}
          />
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
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
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5">
            <OfficialPill label="CSG" status={officialStatus.csg} />
            <OfficialPill label="Kouga" status={officialStatus.kouga} />
          </div>
        )}

        <div className="pointer-events-none mt-1 hidden max-w-2xl text-center md:block">
          <p className="rounded-full bg-card/90 px-4 py-1.5 text-[12px] font-medium text-foreground shadow-soft backdrop-blur">
            One place to research a South African property before you buy, sell, or invest.
          </p>
          <p className="mt-1.5 text-[11px] text-foreground/70 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
            Official Public Data Mode · CSG cadastral parcels and Kouga zoning. Pilot — St Francis
            Bay.
          </p>
        </div>
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

      <div className="pointer-events-none absolute bottom-10 left-4 z-20 hidden max-w-md rounded-2xl bg-card/95 px-3 py-1.5 text-[10px] font-medium text-muted-foreground shadow-soft backdrop-blur md:block">
        {demoMode ? (
          <>
            <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent dark:text-accent">
              Demo Data
            </span>
            Pilot region · St Francis Bay. Mock property information shown for demonstration.
          </>
        ) : (
          <>
            <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Official Public Data
            </span>
            Chief Surveyor-General cadastral · Kouga Municipality zoning. Pilot — St Francis Bay.
          </>
        )}
      </div>

      <button
        onClick={() => setAddOpen(true)}
        className="pointer-events-auto absolute bottom-24 right-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-[11px] font-semibold text-background shadow-panel hover:opacity-90 md:bottom-6 md:right-6"
        title="Add a property to your research"
      >
        <Plus className="h-3.5 w-3.5" /> Add property
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
        PROPERTYATLAS DEBUG BUILD
      </div>
      <div className="mt-1 text-sm font-bold text-accent">
        Build label: saved-reopen-debug-v1
      </div>

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
      tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
      text: `${label} loading…`,
    },
    loaded: {
      tone: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300",
      text:
        label === "CSG"
          ? `CSG parcels loaded: ${status.count}`
          : `Kouga zoning loaded: ${status.count}`,
    },
    imported: {
      tone: "bg-sky-500/20 text-sky-800 dark:text-sky-300",
      text:
        label === "CSG"
          ? `CSG parcels loaded (imported): ${status.count}`
          : `Kouga zoning loaded (imported): ${status.count}`,
    },
    test: {
      tone: "bg-accent/20 text-accent dark:text-accent",
      text: "TEST GEOMETRY ONLY — not official data",
    },
    empty: {
      tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
      text:
        label === "CSG" ? "No CSG parcels in this view" : "Kouga zoning unavailable for this view",
    },
    failed: {
      tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
      text: label === "CSG" ? "CSG unavailable" : "Kouga zoning unavailable",
    },
  };
  const v = map[status.state] ?? map.empty;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-soft backdrop-blur",
        v.tone,
      )}
      title={status.message ?? undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {v.text}
    </span>
  );
}
