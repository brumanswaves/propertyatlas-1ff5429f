import type { BuildEnvelopeResult } from "@/lib/sitePotential/buildEnvelope";

export interface StreetSideBuildEnvelopeProps {
  result: BuildEnvelopeResult | null;
}

function formatMetres(value: number | null | undefined) {
  return value != null && Number.isFinite(value) ? `${value} m` : "Not confirmed";
}

export function StreetSideBuildEnvelope({ result }: StreetSideBuildEnvelopeProps) {
  const streetSetbackM = result?.streetEdge?.setbackM ?? null;
  const maxHeightM = result?.summary.maxHeightM ?? null;
  const frontageM = result?.streetEdge?.lengthM ?? null;
  const hasStreetLine = Boolean(result?.streetEdge && streetSetbackM != null);
  const hasHeight = maxHeightM != null;

  return (
    <section className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
            Street-side build lines
          </div>
          <h3 className="mt-1 text-[15px] font-semibold tracking-tight text-[#0D1B2A]">
            Potential envelope from the street
          </h3>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[#64748B]">
            A deterministic profile of the recorded street building line and maximum height. This is
            not generated imagery, a house design, or an approval.
          </p>
        </div>
        <span className="rounded-full border border-[#0D1B2A]/10 bg-[#F7FBFF] px-3 py-1 text-[11px] font-semibold text-[#0D1B2A]">
          {result?.stateLabel ?? "Awaiting site inputs"}
        </span>
      </div>

      {result && (hasStreetLine || hasHeight) ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#0D1B2A]/10 bg-[#F7FBFF]">
          <svg
            viewBox="0 0 760 320"
            className="block h-auto w-full"
            role="img"
            aria-label="Street-side diagram showing the street building line and maximum permitted height"
          >
            <rect x="0" y="0" width="760" height="320" fill="#F7FBFF" />
            <rect x="0" y="244" width="760" height="76" fill="#E2E8F0" />
            <rect x="0" y="252" width="170" height="68" fill="#CBD5E1" />
            <text x="85" y="287" textAnchor="middle" fontSize="16" fontWeight="700" fill="#475569">
              Street
            </text>

            <line x1="170" y1="54" x2="170" y2="260" stroke="#0D1B2A" strokeWidth="3" />
            <text x="180" y="75" fontSize="13" fontWeight="700" fill="#0D1B2A">
              Erf boundary
            </text>

            <line
              x1="300"
              y1="54"
              x2="300"
              y2="260"
              stroke="#FF6A00"
              strokeWidth="4"
              strokeDasharray="10 8"
            />
            <text x="310" y="96" fontSize="13" fontWeight="700" fill="#B24A00">
              Street building line
            </text>

            <line x1="170" y1="226" x2="300" y2="226" stroke="#FF6A00" strokeWidth="2" />
            <line x1="170" y1="218" x2="170" y2="234" stroke="#FF6A00" strokeWidth="2" />
            <line x1="300" y1="218" x2="300" y2="234" stroke="#FF6A00" strokeWidth="2" />
            <text x="235" y="214" textAnchor="middle" fontSize="13" fontWeight="700" fill="#B24A00">
              {formatMetres(streetSetbackM)} setback
            </text>

            <rect
              x="300"
              y={hasHeight ? 92 : 142}
              width="330"
              height={hasHeight ? 152 : 102}
              fill="#FF6A00"
              fillOpacity="0.12"
              stroke="#FF6A00"
              strokeWidth="3"
              strokeDasharray="8 7"
              rx="6"
            />
            <text x="465" y="170" textAnchor="middle" fontSize="16" fontWeight="700" fill="#9A3412">
              Potential build envelope
            </text>

            {hasHeight ? (
              <>
                <line x1="658" y1="92" x2="658" y2="244" stroke="#0D1B2A" strokeWidth="2" />
                <line x1="650" y1="92" x2="666" y2="92" stroke="#0D1B2A" strokeWidth="2" />
                <line x1="650" y1="244" x2="666" y2="244" stroke="#0D1B2A" strokeWidth="2" />
                <text x="676" y="171" fontSize="13" fontWeight="700" fill="#0D1B2A">
                  {formatMetres(maxHeightM)} max
                </text>
              </>
            ) : null}

            <text x="300" y="284" fontSize="12" fontWeight="600" fill="#64748B">
              Buildable area begins behind the confirmed street building line
            </text>
          </svg>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-[#0D1B2A]/15 bg-[#F7FBFF] px-5 py-8 text-center">
          <div className="text-sm font-semibold text-[#0D1B2A]">Street-side lines need more information</div>
          <p className="mx-auto mt-2 max-w-xl text-[12px] leading-5 text-[#64748B]">
            Confirm the parcel boundary, street-facing boundary and planning controls on the map.
            Easy Erf will show the street building line and height here without inventing a building.
          </p>
        </div>
      )}

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Street building line" value={formatMetres(streetSetbackM)} />
        <Metric label="Maximum height" value={formatMetres(maxHeightM)} />
        <Metric label="Street frontage" value={formatMetres(frontageM)} />
      </dl>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#0D1B2A]/10 bg-[#F7FBFF] px-4 py-3">
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[#0D1B2A]">{value}</dd>
    </div>
  );
}

export default StreetSideBuildEnvelope;
