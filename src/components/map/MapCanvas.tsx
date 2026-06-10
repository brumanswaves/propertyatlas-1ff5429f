import { useMemo, useState } from "react";
import { PROPERTIES, type Property } from "@/data/properties";
import { cn } from "@/lib/utils";

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  filterFn?: (p: Property) => boolean;
  layer: "parcels" | "heatmap" | "zoning";
}

const TYPE_COLOR: Record<string, string> = {
  Residential: "oklch(0.82 0.04 240)",
  Commercial: "oklch(0.78 0.09 280)",
  Industrial: "oklch(0.7 0.08 30)",
  Agricultural: "oklch(0.84 0.09 130)",
  "Vacant Land": "oklch(0.92 0.03 90)",
};

export function MapCanvas({ selectedId, onSelect, filterFn, layer }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const filtered = useMemo(
    () => (filterFn ? PROPERTIES.filter(filterFn) : PROPERTIES),
    [filterFn],
  );
  const filteredIds = new Set(filtered.map((p) => p.id));

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--color-ocean)]">
      {/* Subtle grid background */}
      <svg viewBox="0 0 1000 900" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth="1" />
          </pattern>
          <radialGradient id="heat" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.78 0.17 70 / 0.85)" />
            <stop offset="100%" stopColor="oklch(0.78 0.17 70 / 0)" />
          </radialGradient>
          <linearGradient id="coast" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--color-coast)" />
            <stop offset="100%" stopColor="var(--color-land)" />
          </linearGradient>
        </defs>

        {/* Land mass */}
        <path
          d="M0,150 C150,120 320,140 480,170 C620,195 760,210 820,260 L820,900 L0,900 Z"
          fill="url(#coast)"
        />
        {/* Coastline accent */}
        <path
          d="M0,150 C150,120 320,140 480,170 C620,195 760,210 820,260"
          fill="none"
          stroke="oklch(0.55 0.05 220)"
          strokeWidth="1.5"
          strokeOpacity="0.5"
        />
        <rect width="1000" height="900" fill="url(#grid)" />

        {/* Roads */}
        <g stroke="oklch(0.78 0.005 240)" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.85">
          <path d="M40,400 C220,395 440,420 760,430" />
          <path d="M120,200 C180,420 240,640 300,820" />
          <path d="M500,210 C520,420 540,630 560,820" />
          <path d="M700,260 C720,440 740,640 760,820" />
        </g>
        <g stroke="oklch(0.97 0.005 240)" strokeWidth="1.5" strokeDasharray="6 8" fill="none">
          <path d="M40,400 C220,395 440,420 760,430" />
          <path d="M120,200 C180,420 240,640 300,820" />
          <path d="M500,210 C520,420 540,630 560,820" />
          <path d="M700,260 C720,440 740,640 760,820" />
        </g>

        {/* Heatmap layer */}
        {layer === "heatmap" && (
          <g>
            {filtered
              .filter((p) => p.scores.investor > 70)
              .map((p) => (
                <circle
                  key={`h-${p.id}`}
                  cx={p.centroid[0]}
                  cy={p.centroid[1]}
                  r={40 + p.scores.investor / 3}
                  fill="url(#heat)"
                />
              ))}
          </g>
        )}

        {/* Parcels */}
        <g>
          {PROPERTIES.map((p) => {
            const included = filteredIds.has(p.id);
            const isSel = p.id === selectedId;
            const isHover = p.id === hover;
            const fill =
              layer === "zoning"
                ? TYPE_COLOR[p.type] ?? "var(--color-parcel)"
                : isSel
                  ? "var(--color-parcel-selected)"
                  : isHover
                    ? "var(--color-parcel-hover)"
                    : included
                      ? "var(--color-parcel)"
                      : "oklch(0.88 0.005 240 / 0.35)";
            return (
              <polygon
                key={p.id}
                points={p.parcel.points.map((pt) => pt.join(",")).join(" ")}
                fill={fill}
                stroke={isSel ? "var(--color-accent)" : "oklch(0.4 0.04 250 / 0.35)"}
                strokeWidth={isSel ? 2 : 0.8}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(p.id)}
                className={cn("cursor-pointer transition-colors", !included && "pointer-events-none")}
              />
            );
          })}
        </g>

        {/* Area labels */}
        <g fill="oklch(0.3 0.04 250 / 0.65)" fontFamily="Inter" fontSize="11" fontWeight={600} style={{ pointerEvents: "none" }}>
          <text x="150" y="280" letterSpacing="2">ST FRANCIS BAY</text>
          <text x="520" y="320" letterSpacing="2">SANTAREME</text>
          <text x="650" y="540" letterSpacing="2">PORT ST FRANCIS</text>
          <text x="260" y="720" letterSpacing="2">CAPE ST FRANCIS</text>
          <text x="60" y="560" letterSpacing="2">OYSTER BAY</text>
        </g>

        {/* Compass */}
        <g transform="translate(950 60)">
          <circle r="20" fill="oklch(1 0 0 / 0.8)" stroke="oklch(0.4 0.04 250 / 0.3)" />
          <text textAnchor="middle" y="-6" fontSize="9" fill="oklch(0.3 0.04 250)">N</text>
          <path d="M0,-12 L4,8 L0,4 L-4,8 Z" fill="var(--color-brand)" />
        </g>
      </svg>
    </div>
  );
}
