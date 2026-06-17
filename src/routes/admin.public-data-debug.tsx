import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { fetchArcGisLayer, type ArcGisFeatureCollection } from "@/lib/providers/arcgis.functions";

export const Route = createFileRoute("/admin/public-data-debug")({
  head: () => ({ meta: [{ title: "Public Data Debug — PropertyAtlas Admin" }] }),
  component: PublicDataDebug,
});

const ST_FRANCIS_BBOX: [number, number, number, number] = [24.80, -34.21, 24.86, -34.14];

type LayerResult = { layer: "csg-parcels" | "kouga-zoning"; bbox: [number, number, number, number]; result?: ArcGisFeatureCollection; error?: string };

function PublicDataDebug() {
  const [bbox, setBbox] = useState<[number, number, number, number]>(ST_FRANCIS_BBOX);
  const [results, setResults] = useState<LayerResult[]>([]);
  const [running, setRunning] = useState(false);

  async function runQuery(layer: "csg-parcels" | "kouga-zoning", b: [number, number, number, number]) {
    try {
      const result = await fetchArcGisLayer({ data: { layer, bbox: b, limit: 50 } });
      return { layer, bbox: b, result };
    } catch (err) {
      return { layer, bbox: b, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  async function runTest(b: [number, number, number, number]) {
    setRunning(true);
    setResults([]);
    const out = await Promise.all([runQuery("csg-parcels", b), runQuery("kouga-zoning", b)]);
    setResults(out);
    setRunning(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Admin</div>
      <h1 className="text-2xl font-bold tracking-tight">Public Data Debug</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Probes the CSG primary, DFFE fallback, and Kouga zoning endpoints against a fixed bbox and shows raw counts plus the active source.
      </p>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Test bbox</div>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          {(["minLng", "minLat", "maxLng", "maxLat"] as const).map((label, i) => (
            <label key={label} className="block text-[11px] text-muted-foreground">
              {label}
              <input
                type="number"
                step="0.01"
                value={bbox[i]}
                onChange={(e) => {
                  const next = [...bbox] as [number, number, number, number];
                  next[i] = parseFloat(e.target.value);
                  setBbox(next);
                }}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => runTest(ST_FRANCIS_BBOX)}
            disabled={running}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Test St Francis Public Data
          </button>
          <button
            onClick={() => runTest(bbox)}
            disabled={running}
            className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
          >
            Run custom bbox
          </button>
        </div>
      </section>

      <section className="mt-6 space-y-4">
        {running && <div className="text-sm text-muted-foreground">Querying upstream endpoints…</div>}
        {results.map((r) => (
          <article key={r.layer} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{r.layer}</h2>
              {r.result?.meta.activeSource && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                  Active: {r.result.meta.activeSource}
                </span>
              )}
            </div>
            {r.error && <div className="mt-2 rounded bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">{r.error}</div>}
            {r.result && (
              <div className="mt-2 grid gap-2 text-[12px]">
                <Row k="Source" v={r.result.meta.source} />
                <Row k="Upstream reachable" v={String(r.result.meta.upstreamReachable)} />
                <Row k="Upstream URL" v={r.result.meta.upstreamUrl ?? "—"} />
                <Row k="Feature count" v={String(r.result.meta.count)} />
                <Row k="Upstream message" v={r.result.meta.upstreamMessage ?? "—"} />
                <Row k="Fetched at" v={r.result.meta.fetchedAt} />
                {r.result.meta.primaryStatus && (
                  <Row k="Primary" v={`reachable=${r.result.meta.primaryStatus.reachable} count=${r.result.meta.primaryStatus.count}${r.result.meta.primaryStatus.message ? ` msg=${r.result.meta.primaryStatus.message}` : ""}`} />
                )}
                {r.result.meta.fallbackStatus && (
                  <Row k="Fallback" v={`reachable=${r.result.meta.fallbackStatus.reachable} count=${r.result.meta.fallbackStatus.count}${r.result.meta.fallbackStatus.message ? ` msg=${r.result.meta.fallbackStatus.message}` : ""}`} />
                )}
                {r.result.features[0] && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">First feature properties</summary>
                    <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-[10px] leading-tight">
                      {JSON.stringify(r.result.features[0].properties, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1">
      <dt className="text-[11px] text-muted-foreground">{k}</dt>
      <dd className="break-all text-right font-mono text-[11px] text-foreground">{v}</dd>
    </div>
  );
}
