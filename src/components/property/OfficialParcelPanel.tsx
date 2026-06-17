import { X, ExternalLink, ShieldCheck, FileText, Lock } from "lucide-react";
import type { OfficialFeatureSelection } from "@/components/map/MapCanvas";

interface Props {
  selection: OfficialFeatureSelection;
  onClose: () => void;
}

const NA = "Not available from public source";
function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return NA;
  return String(v);
}

function normalizeCsg(p: Record<string, unknown>) {
  return {
    provider: "Chief Surveyor-General",
    sourceType: "Official Public Cadastral Data",
    erfNumber: p.PARCEL_NO ?? p.TAG_VALUE,
    portion: p.PORTION,
    lpi: p.ID,
    parcelKey: p.PRCL_KEY,
    province: p.PROVINCE,
    majorRegion: p.MAJ_REGION,
    minorRegion: p.MIN_REGION,
    geometryArea: p.GEOM_AREA ?? p.SHAPE_Area,
    longitude: p.TAG_X,
    latitude: p.TAG_Y,
    providerId: p.PRCL_KEY ?? p.ID ?? p.OBJECTID,
  };
}

function normalizeKouga(p: Record<string, unknown>) {
  return {
    provider: "Kouga Municipality GIS",
    sourceType: "Official Public Zoning Data",
    zoningType: p.ZONING_TYP,
    zoningCode: p.ZONING,
    zoningDescription: p.ZONING_DES,
    shapeArea: p.Shape__Area,
    shapeLength: p.Shape__Length,
  };
}

const REPORTS = [
  { name: "Lightstone Property Report", desc: "Ownership, valuation, transfers, bonds, comparables." },
  { name: "Lightstone Seller Report", desc: "Likely-to-sell signals and seller intelligence." },
  { name: "WinDeed Property Report", desc: "Deeds office search: ownership and bond history." },
  { name: "Surveyor-General Diagram", desc: "Approved SG diagram for the erf." },
];

export function OfficialParcelPanel({ selection, onClose }: Props) {
  const isCsg = selection.layer === "csg-parcels";
  const csg = isCsg ? normalizeCsg(selection.properties) : null;
  const kouga = !isCsg ? normalizeKouga(selection.properties) : null;
  const fetchedAt = new Date().toLocaleString();
  const sourceUrl = isCsg
    ? "https://csggis.drdlr.gov.za/psv/"
    : "https://mapping-kouga.hub.arcgis.com/";

  return (
    <aside className="absolute right-0 top-0 z-30 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-border bg-card shadow-panel md:w-[420px]">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-3 w-3" />
            Official Public Cadastral Record
          </div>
          <h2 className="mt-1 truncate text-base font-semibold text-foreground">
            {isCsg ? `Parcel ${fmt(csg?.erfNumber)}` : `Zoning ${fmt(kouga?.zoningCode)}`}
          </h2>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{selection.source}</div>
        </div>
        <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-900 dark:text-emerald-200">
          Official Public Data · {isCsg ? "Chief Surveyor-General" : "Kouga Municipality GIS"}
          <div className="mt-0.5 text-[10px] opacity-80">Last fetched: {fetchedAt}</div>
        </div>

        <dl className="mt-4 divide-y divide-border rounded-xl border border-border text-[12px]">
          {csg && (
            <>
              <Row label="Source" value={csg.provider} />
              <Row label="Erf number" value={fmt(csg.erfNumber)} />
              <Row label="Portion" value={fmt(csg.portion)} />
              <Row label="LPI / ID" value={fmt(csg.lpi)} />
              <Row label="Parcel key" value={fmt(csg.parcelKey)} />
              <Row label="Province" value={fmt(csg.province)} />
              <Row label="Major region" value={fmt(csg.majorRegion)} />
              <Row label="Minor region" value={fmt(csg.minorRegion)} />
              <Row label="Geometry area (m²)" value={fmt(csg.geometryArea)} />
              <Row label="Latitude" value={fmt(csg.latitude ?? selection.lngLat[1].toFixed(6))} />
              <Row label="Longitude" value={fmt(csg.longitude ?? selection.lngLat[0].toFixed(6))} />
            </>
          )}
          {kouga && (
            <>
              <Row label="Source" value={kouga.provider} />
              <Row label="Zoning code" value={fmt(kouga.zoningCode)} />
              <Row label="Zoning type" value={fmt(kouga.zoningType)} />
              <Row label="Zoning description" value={fmt(kouga.zoningDescription)} />
              <Row label="Shape area" value={fmt(kouga.shapeArea)} />
              <Row label="Shape length" value={fmt(kouga.shapeLength)} />
            </>
          )}
        </dl>

        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground underline-offset-2 hover:underline"
        >
          Open official source <ExternalLink className="h-3 w-3" />
        </a>

        <section className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Official Public Data</div>
          <p className="mt-1 text-[12px] text-foreground">
            No valuation available from this public source. Order a Lightstone or WinDeed report for
            ownership, valuation, transfers, bonds, and comparable sales.
          </p>
        </section>

        <section className="mt-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Order a report</div>
          <div className="space-y-2">
            {REPORTS.map((r) => (
              <div key={r.name} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    {r.name}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.desc}</div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  <Lock className="h-2.5 w-2.5" /> Coming soon
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Official ownership, transfer history, bonds, comparable sales, and valuations require a third-party report.
          </p>
        </section>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
