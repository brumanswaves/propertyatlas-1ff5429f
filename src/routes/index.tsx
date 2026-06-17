import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MousePointerClick, Plus, X, ShieldCheck, FlaskConical } from "lucide-react";
import { MapCanvas, type MapLayers, type MapStyleId, type OfficialFeatureSelection, type OfficialLayerStatus } from "@/components/map/MapCanvas";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PropertyAtlas — South Africa Property Intelligence" },
      {
        name: "description",
        content:
          "Map-based property intelligence for South Africa. Official public cadastral and zoning data from Chief Surveyor-General and Kouga Municipality.",
      },
      { property: "og:title", content: "PropertyAtlas — Property Intelligence for South Africa" },
      { property: "og:description", content: "Official public cadastral and zoning layers, plus saved research." },
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
  const [hintDismissed, setHintDismissed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setHintDismissed(window.localStorage.getItem("pa.hintDismissed") === "1");
    setDemoMode(window.localStorage.getItem("pa.demoMode") === "1");
    const parcel = new URLSearchParams(window.location.search).get("parcel");
    if (parcel && getProperty(parcel)) setSelectedId(parcel);
  }, []);
  function dismissHint() {
    setHintDismissed(true);
    try { window.localStorage.setItem("pa.hintDismissed", "1"); } catch {}
  }
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [mapStyle, setMapStyle] = useState<MapStyleId>("satellite");

  function toggleDemoMode() {
    setDemoMode((d) => {
      const next = !d;
      try { window.localStorage.setItem("pa.demoMode", next ? "1" : "0"); } catch {}
      setLayers(next ? DEMO_LAYERS : DEFAULT_LAYERS);
      if (!next) setSelectedId(null);
      else setSelectedOfficial(null);
      return next;
    });
  }

  const selected = selectedId ? getProperty(selectedId) ?? null : null;

  const filterFn = useMemo(() => {
    return (p: Property) => {
      if (filters.types.length && !filters.types.includes(p.type)) return false;
      if (filters.beachfrontOnly && !p.features.beachfront) return false;
      if (filters.oceanViewOnly && !p.features.oceanView) return false;
      if (filters.largeErfOnly && !p.features.largeErf) return false;
      if (filters.cornerLotOnly && !p.features.cornerLot) return false;
      if (filters.minInvestorScore && p.scores.investor < filters.minInvestorScore) return false;
      if (filters.minDevelopmentScore && p.scores.development < filters.minDevelopmentScore) return false;
      if (filters.ownership.length && !filters.ownership.includes(p.ownership.type)) return false;
      const lastYear = new Date(p.sales[0].date).getFullYear();
      if (filters.recentSalesOnly && 2026 - lastYear > 1) return false;
      if (filters.longHeldOnly && 2026 - lastYear < 10) return false;
      return true;
    };
  }, [filters]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <h1 className="sr-only">PropertyAtlas — Map-based property intelligence for South Africa</h1>
      <MapCanvas
        selectedId={selectedId}
        onSelect={(id) => { setSelectedId(id); if (id) setSelectedOfficial(null); }}
        filterFn={filterFn}
        layers={layers}
        mapStyle={mapStyle}
        onSelectOfficial={(sel) => { setSelectedOfficial(sel); if (sel) setSelectedId(null); }}
      />
      <MapLegend layers={layers} />
      <TopNav />

      <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex flex-col items-center gap-2 px-4 md:top-24">
        <div className="pointer-events-auto relative z-10 w-full max-w-xl">
          <SearchBar onPick={(p) => setSelectedId(p.id)} />
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
          <FilterPanel value={filters} onChange={setFilters} />
          <LayerSwitcher layers={layers} onLayersChange={setLayers} style={mapStyle} onStyleChange={setMapStyle} />
          <button
            onClick={toggleDemoMode}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold shadow-soft backdrop-blur transition",
              demoMode
                ? "bg-amber-500 text-amber-950 hover:bg-amber-400"
                : "bg-emerald-600 text-white hover:bg-emerald-500",
            )}
            title={demoMode ? "Switch back to Official Public Data Mode" : "Enable Demo Mode"}
          >
            {demoMode ? <FlaskConical className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {demoMode ? "Demo Data" : "Official Public Data Mode"}
          </button>
        </div>

        <div className="pointer-events-none mt-1 hidden max-w-2xl text-center md:block">
          <p className="rounded-full bg-card/90 px-4 py-1.5 text-[12px] font-medium text-foreground shadow-soft backdrop-blur">
            One place to research a South African property before you buy, sell, or invest.
          </p>
          <p className="mt-1.5 text-[11px] text-foreground/70 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
            {demoMode
              ? "Demo Mode · mock parcels and scores for demonstration."
              : "Official Public Data Mode · CSG cadastral parcels and Kouga zoning. Pilot — St Francis Bay."}
          </p>
        </div>
      </div>

      {!selected && !selectedOfficial && !hintDismissed && (
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
          <button onClick={dismissHint} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-10 left-4 z-20 hidden max-w-md rounded-2xl bg-card/95 px-3 py-1.5 text-[10px] font-medium text-muted-foreground shadow-soft backdrop-blur md:block">
        {demoMode ? (
          <>
            <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Demo Data</span>
            Pilot region · St Francis Bay. Mock property information shown for demonstration.
          </>
        ) : (
          <>
            <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Official Public Data</span>
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
        <OfficialParcelPanel selection={selectedOfficial} onClose={() => setSelectedOfficial(null)} />
      ) : (
        <PropertyPanel property={selected} onClose={() => setSelectedId(null)} />
      )}
      {addOpen && <AddPropertyDialog onClose={() => setAddOpen(false)} />}
      <Toaster position="top-center" />
    </div>
  );
}
