import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MousePointerClick, Plus, Sparkles, X } from "lucide-react";
import { MapCanvas, type MapLayers, type MapStyleId } from "@/components/map/MapCanvas";
import { SearchBar } from "@/components/map/SearchBar";
import { FilterPanel, DEFAULT_FILTERS, type Filters } from "@/components/map/FilterPanel";
import { LayerSwitcher, DEFAULT_LAYERS } from "@/components/map/LayerSwitcher";
import { PropertyPanel } from "@/components/property/PropertyPanel";
import { AddPropertyDialog } from "@/components/property/AddPropertyDialog";
import { TopNav } from "@/components/layout/TopNav";
import { FooterMini } from "@/components/layout/Footer";
import { getProperty, PROPERTIES, type Property } from "@/data/properties";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PropertyAtlas — South Africa Property Intelligence" },
      {
        name: "description",
        content:
          "Map-based property intelligence for South Africa. Explore parcels, valuations, ownership, and investment scores across St Francis Bay.",
      },
      { property: "og:title", content: "PropertyAtlas — Property Intelligence for South Africa" },
      { property: "og:description", content: "Premium investor-grade property analytics on a beautiful map." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: AtlasHome,
});

function AtlasHome() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setHintDismissed(window.localStorage.getItem("pa.hintDismissed") === "1");
    // Deep-link: /?parcel=<id> opens the property panel directly
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

  const selected = selectedId ? getProperty(selectedId) ?? null : null;

  // Curated "Try one of these" featured properties: top investor scores, distinct streets
  const featured = useMemo(() => {
    const sorted = [...PROPERTIES].sort((a, b) => b.scores.investor - a.scores.investor);
    const picks: Property[] = [];
    const seenAreas = new Set<string>();
    const seenStreets = new Set<string>();
    for (const p of sorted) {
      const streetKey = p.street.split(",")[0].trim().toLowerCase();
      if (seenAreas.has(p.area) || seenStreets.has(streetKey)) continue;
      picks.push(p);
      seenAreas.add(p.area);
      seenStreets.add(streetKey);
      if (picks.length >= 3) break;
    }
    return picks;
  }, []);

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
        onSelect={setSelectedId}
        filterFn={filterFn}
        layers={layers}
        mapStyle={mapStyle}
      />
      <TopNav />

      <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex flex-col items-center gap-2 px-4 md:top-24">
        <div className="pointer-events-auto relative z-10 w-full max-w-xl">
          <SearchBar onPick={(p) => setSelectedId(p.id)} />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <FilterPanel value={filters} onChange={setFilters} />
          <LayerSwitcher layers={layers} onLayersChange={setLayers} style={mapStyle} onStyleChange={setMapStyle} />
        </div>

        {/* Tagline — repositioned as a public research hub */}
        <div className="pointer-events-none mt-1 hidden max-w-2xl text-center md:block">
          <p className="rounded-full bg-card/90 px-4 py-1.5 text-[12px] font-medium text-foreground shadow-soft backdrop-blur">
            One place to research a South African property before you buy, sell, or invest.
          </p>
          <p className="mt-1.5 text-[11px] text-foreground/70 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
            Save every property, link, report, and note in one place. Pilot region — St Francis Bay.
          </p>
        </div>

        {/* Featured properties quick-launch — desktop only to keep mobile clean */}
        {!selected && (
          <div className="pointer-events-auto mt-1 hidden max-w-full flex-wrap items-center justify-center gap-1.5 px-2 md:flex">
            <span className="inline-flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shadow-soft backdrop-blur">
              <Sparkles className="h-3 w-3 text-accent" /> Try one of these
            </span>
            {featured.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1 text-[11px] font-medium text-foreground shadow-soft backdrop-blur transition hover:bg-card hover:shadow-glow"
              >
                <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-brand text-[9px] font-semibold text-white">
                  {p.scores.investor}
                </span>
                <span className="truncate">{p.street.split(",")[0]}</span>
                <span className="hidden text-muted-foreground sm:inline">· {p.area}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Onboarding hint */}
      {!selected && !hintDismissed && (
        <div className="pointer-events-auto absolute inset-x-4 bottom-20 z-20 mx-auto flex max-w-sm items-start gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-panel backdrop-blur md:bottom-12 md:left-1/2 md:right-auto md:-translate-x-1/2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-brand text-white">
            <MousePointerClick className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold leading-tight">Click a parcel to begin</div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Open the property intelligence panel: valuation, last sale, ownership, scores, and 10-year history.
            </p>
          </div>
          <button onClick={dismissHint} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-10 left-4 z-20 hidden max-w-md rounded-2xl bg-card/95 px-3 py-1.5 text-[10px] font-medium text-muted-foreground shadow-soft backdrop-blur md:block">
        <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Demo Data</span>
        Pilot region · St Francis Bay. Mock property information shown for demonstration. Estimates are not certified valuations.
      </div>

      <FooterMini />

      <PropertyPanel property={selected} onClose={() => setSelectedId(null)} />
      <Toaster position="top-center" />
    </div>
  );
}
