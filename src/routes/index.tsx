import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapCanvas, type MapLayers, type MapStyleId } from "@/components/map/MapCanvas";
import { SearchBar } from "@/components/map/SearchBar";
import { FilterPanel, DEFAULT_FILTERS, type Filters } from "@/components/map/FilterPanel";
import { LayerSwitcher, DEFAULT_LAYERS } from "@/components/map/LayerSwitcher";
import { PropertyPanel } from "@/components/property/PropertyPanel";
import { TopNav } from "@/components/layout/TopNav";
import { getProperty, type Property } from "@/data/properties";
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
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [mapStyle, setMapStyle] = useState<MapStyleId>("satellite");

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
        onSelect={setSelectedId}
        filterFn={filterFn}
        layers={layers}
        mapStyle={mapStyle}
      />
      <TopNav />

      <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex flex-col items-center gap-2 px-4 md:top-24">
        <div className="pointer-events-auto w-full max-w-xl">
          <SearchBar onPick={(p) => setSelectedId(p.id)} />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <FilterPanel value={filters} onChange={setFilters} />
          <LayerSwitcher layers={layers} onLayersChange={setLayers} style={mapStyle} onStyleChange={setMapStyle} />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-20 hidden rounded-full bg-card/95 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-soft backdrop-blur md:block">
        Pilot region · St Francis Bay, Eastern Cape · Mock data
      </div>

      <PropertyPanel property={selected} onClose={() => setSelectedId(null)} />
      <Toaster position="top-center" />
    </div>
  );
}
