import { useState } from "react";
import { Layers, Map as MapIcon, Mountain, Satellite, Moon, X, ExternalLink, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MapLayers, MapStyleId, OfficialLayerStatus } from "./MapCanvas";

interface Props {
  layers: MapLayers;
  onLayersChange: (l: MapLayers) => void;
  style: MapStyleId;
  onStyleChange: (s: MapStyleId) => void;
  officialStatus?: OfficialLayerStatus;
}

const STYLES: { id: MapStyleId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "satellite", label: "Satellite", icon: Satellite },
  { id: "streets", label: "Streets", icon: MapIcon },
  { id: "terrain", label: "Terrain", icon: Mountain },
  { id: "dark", label: "Dark", icon: Moon },
];

const LAYER_GROUPS: { title: string; items: { key: keyof MapLayers; label: string; hint?: string }[] }[] = [
  {
    title: "Official public data",
    items: [
      { key: "csgParcels", label: "CSG Parcels", hint: "Chief Surveyor-General — live cadastral" },
      { key: "kougaZoning", label: "Kouga Zoning", hint: "Kouga Municipality GIS — live" },
    ],
  },
  {
    title: "Demo",
    items: [
      { key: "parcels", label: "Demo Parcels", hint: "PropertyAtlas pilot dataset" },
      { key: "zoning", label: "Demo Zoning", hint: "Colored by use type" },
    ],
  },
  {
    title: "Opportunity Heatmaps (demo)",
    items: [
      { key: "investorHeat", label: "Investor Opportunity", hint: "Composite investor score" },
      { key: "developmentHeat", label: "Development Opportunity", hint: "Bulk, zoning, lot size" },
      { key: "sellerHeat", label: "Seller Probability", hint: "Likely-to-sell signal" },
    ],
  },
  {
    title: "Lifestyle Heatmaps (demo)",
    items: [
      { key: "oceanViewHeat", label: "Ocean View", hint: "Coastal line-of-sight" },
      { key: "appreciationHeat", label: "Appreciation Potential", hint: "5-year growth model" },
      { key: "rentalHeat", label: "Rental Yield", hint: "Short-let demand" },
      { key: "longHeldHeat", label: "Long-Term Ownership", hint: "Tenure-rich pockets" },
    ],
  },
];

export function LayerSwitcher({ layers, onLayersChange, style, onStyleChange }: Props) {
  const [open, setOpen] = useState(false);
  const activeLayers = Object.values(layers).filter(Boolean).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-card/95 px-3.5 py-2.5 text-xs font-medium shadow-soft backdrop-blur transition hover:bg-card hover:shadow-glow"
      >
        <Layers className="h-3.5 w-3.5" />
        Layers
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
          {activeLayers}
        </span>
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm md:hidden"
          />
          <div className="pa-fade-up fixed inset-x-2 bottom-2 z-40 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-panel md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 md:w-80 md:max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="h-4 w-4" /> Map Layers
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto overscroll-contain p-4">
              <div className="mb-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Base map</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {STYLES.map((s) => {
                    const Icon = s.icon;
                    const active = style === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => onStyleChange(s.id)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2.5 text-[10px] font-medium transition",
                          active ? "border-primary bg-primary text-primary-foreground shadow-soft" : "border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="truncate">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {LAYER_GROUPS.map((g) => (
                <div key={g.title} className="mb-4 last:mb-0">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</div>
                  <div className="space-y-1">
                    {g.items.map((it) => {
                      const checked = layers[it.key];
                      return (
                        <label
                          key={it.key}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition",
                            checked ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{it.label}</div>
                            {it.hint && <div className="truncate text-[11px] text-muted-foreground">{it.hint}</div>}
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={checked}
                            onClick={(e) => {
                              e.preventDefault();
                              onLayersChange({ ...layers, [it.key]: !checked });
                            }}
                            className={cn(
                              "relative h-5 w-9 shrink-0 rounded-full transition",
                              checked ? "bg-primary" : "bg-muted",
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                                checked ? "left-[18px]" : "left-0.5",
                              )}
                            />
                          </button>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Default = Official Public Data Mode. Demo parcels are off by default
// and only re-enabled when the user explicitly opts into Demo Mode.
export const DEFAULT_LAYERS: MapLayers = {
  parcels: false,
  zoning: false,
  csgParcels: true,
  kougaZoning: true,
  investorHeat: false,
  developmentHeat: false,
  oceanViewHeat: false,
  appreciationHeat: false,
  rentalHeat: false,
  longHeldHeat: false,
  sellerHeat: false,
};

export const DEMO_LAYERS: MapLayers = {
  parcels: true,
  zoning: false,
  csgParcels: false,
  kougaZoning: false,
  investorHeat: false,
  developmentHeat: false,
  oceanViewHeat: false,
  appreciationHeat: false,
  rentalHeat: false,
  longHeldHeat: false,
  sellerHeat: false,
};
