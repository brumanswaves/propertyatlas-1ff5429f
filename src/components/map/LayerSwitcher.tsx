import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export type MapLayer = "parcels" | "heatmap" | "zoning";

const LAYERS: { id: MapLayer; label: string }[] = [
  { id: "parcels", label: "Parcels" },
  { id: "zoning", label: "Zoning" },
  { id: "heatmap", label: "Heatmap" },
];

export function LayerSwitcher({ value, onChange }: { value: MapLayer; onChange: (l: MapLayer) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-card/95 p-1 shadow-soft backdrop-blur">
      <Layers className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
      {LAYERS.map((l) => (
        <button
          key={l.id}
          onClick={() => onChange(l.id)}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-medium transition",
            value === l.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
