import { useState } from "react";
import { Layers, Map as MapIcon, Mountain, Satellite, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MapLayers, MapStyleId } from "./MapCanvas";

interface Props {
  layers: MapLayers;
  onLayersChange: (l: MapLayers) => void;
  style: MapStyleId;
  onStyleChange: (s: MapStyleId) => void;
}

const STYLES: { id: MapStyleId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "satellite", label: "Satellite", icon: Satellite },
  { id: "streets", label: "Streets", icon: MapIcon },
  { id: "terrain", label: "Terrain", icon: Mountain },
  { id: "dark", label: "Dark", icon: Moon },
];

const LAYER_GROUPS: { title: string; items: { key: keyof MapLayers; label: string; hint?: string }[] }[] = [
  {
    title: "Parcels",
    items: [
      { key: "parcels", label: "Property Parcels" },
      { key: "zoning", label: "Zoning", hint: "Colored by type" },
    ],
  },
  {
    title: "Heatmaps",
    items: [
      { key: "valueHeat", label: "Property Value" },
      { key: "salesHeat", label: "Sales Activity" },
      { key: "investorHeat", label: "Investor Opportunity" },
    ],
  },
  {
    title: "Intelligence Overlays",
    items: [
      { key: "oceanView", label: "Ocean View" },
      { key: "development", label: "Development Opportunity" },
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
        className="flex items-center gap-2 rounded-full bg-card/95 px-3.5 py-2.5 text-xs font-medium shadow-soft backdrop-blur hover:bg-card"
      >
        <Layers className="h-3.5 w-3.5" />
        Layers
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
          {activeLayers}
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-2xl border border-border bg-card p-4 shadow-panel">
          <div className="mb-3">
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
                      "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-medium transition",
                      active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {LAYER_GROUPS.map((g) => (
            <div key={g.title} className="mb-3">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</div>
              <div className="space-y-1">
                {g.items.map((it) => (
                  <label
                    key={it.key}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-muted"
                  >
                    <div>
                      <div className="font-medium">{it.label}</div>
                      {it.hint && <div className="text-[10px] text-muted-foreground">{it.hint}</div>}
                    </div>
                    <input
                      type="checkbox"
                      checked={layers[it.key]}
                      onChange={(e) => onLayersChange({ ...layers, [it.key]: e.target.checked })}
                      className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const DEFAULT_LAYERS: MapLayers = {
  parcels: true,
  zoning: false,
  valueHeat: false,
  salesHeat: false,
  investorHeat: false,
  oceanView: false,
  development: false,
};
