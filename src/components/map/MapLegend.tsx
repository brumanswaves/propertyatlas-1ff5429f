// Compact map legend, shown bottom-left on the map. Reflects the active layer set.

import { cn } from "@/lib/utils";
import type { MapLayers } from "./MapCanvas";

interface Props {
  layers: MapLayers;
}

interface Entry {
  key: keyof MapLayers | "saved" | "selected";
  label: string;
  swatch: React.ReactNode;
}

const swatchBox = (color: string, border?: string) => (
  <span
    className="inline-block h-2.5 w-3.5 rounded-sm"
    style={{ background: color, border: border ? `1px solid ${border}` : undefined }}
  />
);

const swatchOutline = (color: string) => (
  <span
    className="inline-block h-2.5 w-3.5 rounded-sm bg-transparent"
    style={{ border: `1.5px solid ${color}` }}
  />
);

export function MapLegend({ layers }: Props) {
  const entries: Entry[] = [];
  if (layers.parcels) {
    entries.push({ key: "parcels", label: "Demo parcel", swatch: swatchOutline("#ffffff") });
    entries.push({ key: "selected", label: "Selected", swatch: swatchOutline("#d4842a") });
  }
  if (layers.csgParcels) {
    entries.push({ key: "csgParcels", label: "CSG parcel (official)", swatch: swatchOutline("#3ea58f") });
  }
  if (layers.kougaZoning) {
    entries.push({ key: "kougaZoning", label: "Kouga zoning", swatch: swatchBox("rgba(167,139,250,0.45)", "#a78bfa") });
  }
  if (layers.zoning) {
    entries.push({ key: "zoning", label: "Zoning (demo)", swatch: swatchBox("rgba(92,189,185,0.55)") });
  }

  if (entries.length === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-20 select-none">
      <div className="rounded-xl border border-border bg-card/90 px-3 py-2 text-[10px] shadow-soft backdrop-blur">
        <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Legend</div>
        <ul className="space-y-1">
          {entries.map((e) => (
            <li key={String(e.key)} className={cn("flex items-center gap-2 text-foreground/90")}>
              {e.swatch}
              <span>{e.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
