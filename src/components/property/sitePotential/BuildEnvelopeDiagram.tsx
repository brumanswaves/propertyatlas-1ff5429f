import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { BuildEnvelopeResult, LocalPoint } from "@/lib/sitePotential/buildEnvelope";

interface Props {
  result: BuildEnvelopeResult;
  className?: string;
  /** Compact mode drops edge dimension labels and the legend. */
  compact?: boolean;
  /** Used when overlaid on top of satellite imagery: no fill/border chrome. */
  transparentBackground?: boolean;
}

function toPath(points: LocalPoint[]) {
  if (!points.length) return "";
  return `${points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")} Z`;
}

const EDGE_LABEL: Record<string, string> = {
  street: "Street boundary",
  side: "Side",
  rear: "Rear",
};

export function BuildEnvelopeDiagram({
  result,
  className,
  compact = false,
  transparentBackground = false,
}: Props) {
  const view = useMemo(() => {
    const points = result.parcelPolygon;
    if (points.length < 3) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(...xs) - minX;
    const height = Math.max(...ys) - minY;
    const pad = Math.max(width, height) * 0.16 + 2;
    return {
      viewBox: `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`,
      scale: Math.max(width, height) + pad * 2,
    };
  }, [result.parcelPolygon]);

  if (!view) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center text-sm text-white/60",
          className,
        )}
      >
        No parcel boundary geometry is available for this erf, so the build envelope cannot be
        drawn.
      </div>
    );
  }

  const stroke = view.scale / 260;
  const fontSize = view.scale / 34;
  const coverageCentre = result.coverageFootprint
    ? polygonCentroid(result.coverageFootprint.polygon)
    : null;



  return (
    <div
      className={cn(
        transparentBackground
          ? "p-0"
          : "rounded-2xl border border-white/10 bg-[#06152A] p-3",
        className,
      )}
    >
      <svg
        viewBox={view.viewBox}
        className="h-auto w-full"
        role="img"
        aria-label="Deterministic build envelope diagram for this erf"
      >
        <defs>
          <pattern
            id="erf-coverage-hatch"
            width="3"
            height="3"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="3" height="3" fill="#FF6A00" fillOpacity="0.12" />
            <line x1="0" y1="0" x2="0" y2="3" stroke="#FF6A00" strokeOpacity="0.5" strokeWidth="0.7" />
          </pattern>
        </defs>

        {/* Parcel boundary */}
        <path
          d={toPath(result.parcelPolygon)}
          fill="#0EA5B7"
          fillOpacity={transparentBackground ? 0.16 : 0.07}
          stroke="#22D3EE"
          strokeWidth={stroke * 1.6}
        />

        {/* Buildable envelope, light green */}
        {result.envelopePolygon ? (
          <path
            d={toPath(result.envelopePolygon)}
            fill="#4ADE80"
            fillOpacity={0.18}
            stroke="#22C55E"
            strokeOpacity={0.85}
            strokeWidth={stroke}
            strokeDasharray={`${stroke * 4} ${stroke * 2}`}
          />
        ) : null}

        {/* Building lines: blue for the street line, green for side / rear */}
        {result.edges.map((edge) =>
          edge.setbackLine ? (
            <line
              key={`setback-${edge.index}`}
              x1={edge.setbackLine.a.x}
              y1={edge.setbackLine.a.y}
              x2={edge.setbackLine.b.x}
              y2={edge.setbackLine.b.y}
              stroke={edge.kind === "street" ? "#38BDF8" : "#22C55E"}
              strokeOpacity={0.9}
              strokeWidth={edge.kind === "street" ? stroke * 1.4 : stroke}
              strokeDasharray={`${stroke * 3} ${stroke * 2}`}
            />
          ) : null,
        )}

        {/* Maximum coverage area, salmon fill with a red dashed outline */}
        {result.coverageFootprint ? (
          <>
            <path
              d={toPath(result.coverageFootprint.polygon)}
              fill="#FB7185"
              fillOpacity={0.35}
              stroke="#EF4444"
              strokeWidth={stroke * 1.2}
              strokeDasharray={`${stroke * 3} ${stroke * 2}`}
            />
            <text
              x={coverageCentre?.x ?? 0}
              y={coverageCentre?.y ?? 0}
              fill="#FFFFFF"
              fontSize={fontSize * 0.95}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
              paintOrder="stroke"
              stroke="#7F1D1D"
              strokeWidth={fontSize / 5}
            >
              {`MAX COVERAGE · ${result.coverageFootprint.areaM2} m²`}
            </text>
          </>
        ) : null}

        {/* Street edge emphasis */}
        {result.streetEdge ? (
          <line
            x1={result.streetEdge.a.x}
            y1={result.streetEdge.a.y}
            x2={result.streetEdge.b.x}
            y2={result.streetEdge.b.y}
            stroke="#FF6A00"
            strokeWidth={stroke * 3}
            strokeLinecap="round"
          />
        ) : null}


        {/* Dimensions, only when the boundary was confirmed */}
        {!compact && result.showsDimensions
          ? result.edges.map((edge) => {
              const mx = (edge.a.x + edge.b.x) / 2;
              const my = (edge.a.y + edge.b.y) / 2;
              return (
                <text
                  key={`dim-${edge.index}`}
                  x={mx}
                  y={my}
                  fill="#E2E8F0"
                  fontSize={fontSize}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  paintOrder="stroke"
                  stroke="#06152A"
                  strokeWidth={fontSize / 6}
                >
                  {edge.lengthM} m
                </text>
              );
            })
          : null}
      </svg>

      {compact ? null : (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-white/65">
          <LegendSwatch color="#22D3EE" label="Parcel boundary" />
          <LegendSwatch color="#FF6A00" label={result.streetEdge ? "Street boundary" : "Street boundary not set"} />
          <LegendSwatch color="#FFFFFF" dashed label="Building lines" />
          <LegendSwatch color="#22D3EE" faded label="Buildable envelope" />
          <LegendSwatch color="#FF6A00" faded label="Maximum coverage footprint" />
        </div>
      )}
      {compact ? null : (
        <p className="mt-2 text-[11px] leading-5 text-white/50">
          {result.showsDimensions
            ? "Dimensions are measured from the official parcel geometry you confirmed."
            : "Dimensions are hidden until you confirm the parcel boundary is correct."}{" "}
          The coverage footprint shows allowed area only, not a building design or a real position.
        </p>
      )}
    </div>
  );
}

function LegendSwatch({
  color,
  label,
  dashed,
  faded,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  faded?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-5 rounded-sm"
        style={
          dashed
            ? { borderTop: `2px dashed ${color}`, opacity: 0.6, height: 0 }
            : { backgroundColor: color, opacity: faded ? 0.35 : 1 }
        }
      />
      {label}
    </span>
  );
}

export { EDGE_LABEL };
