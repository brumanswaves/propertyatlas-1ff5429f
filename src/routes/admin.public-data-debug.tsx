import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  loadOfficialPublicLayer,
  testDirectFetch,
  testEdgeProxy,
  testStaticGeoJson,
  type PublicBbox,
  type PublicDataAttempt,
  type PublicDataResult,
  type PublicLayerId,
} from "@/lib/providers/publicDataClient";

export const Route = createFileRoute("/admin/public-data-debug")({
  head: () => ({ meta: [{ title: "Public Data Debug — PropertyAtlas Admin" }] }),
  component: PublicDataDebug,
});

const ST_FRANCIS_BBOX: PublicBbox = [24.80, -34.21, 24.86, -34.14];
const LAYERS: PublicLayerId[] = ["csg-parcels", "kouga-zoning"];

type DebugResult = {
  id: string;
  title: string;
  result: PublicDataResult;
  mapboxSourceUpdated?: boolean;
};

function PublicDataDebug() {
  const [bbox, setBbox] = useState<PublicBbox>(ST_FRANCIS_BBOX);
  const [results, setResults] = useState<DebugResult[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  async function run(title: string, fn: () => Promise<DebugResult[]>) {
    setRunning(title);
    try {
      const next = await fn();
      setResults((current) => [...next, ...current]);
    } finally {
      setRunning(null);
    }
  }

  const runForLayers = async (title: string, fn: (layer: PublicLayerId) => Promise<PublicDataResult>) => {
    const items = await Promise.all(LAYERS.map(async (layer) => ({ id: `${Date.now()}-${title}-${layer}`, title: `${title}: ${layer}`, result: await fn(layer) })));
    return items;
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Admin</div>
      <h1 className="text-2xl font-bold tracking-tight">Public Data Debug</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tests the current fallback order: backend proxy, direct browser fetch, static official GeoJSON, and test geometry.
      </p>

      <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-[12px] text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <strong>Compliance:</strong> test geometry is labelled TEST GEOMETRY ONLY and is not official data. Official layers only count as loaded when real endpoint or imported official GeoJSON features are present.
      </div>

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
                  const next = [...bbox] as PublicBbox;
                  next[i] = parseFloat(e.target.value);
                  setBbox(next);
                }}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <DebugButton running={running} label="Test Supabase proxy" onClick={() => run("Supabase proxy", () => runForLayers("Supabase proxy", (layer) => testEdgeProxy(layer, bbox, 400)))} />
          <DebugButton running={running} label="Test direct browser fetch" onClick={() => run("Direct browser fetch", () => runForLayers("Direct browser fetch", (layer) => testDirectFetch(layer, bbox, 400)))} />
          <DebugButton running={running} label="Test static CSG GeoJSON" onClick={() => run("Static CSG GeoJSON", async () => [{ id: `${Date.now()}-static-csg`, title: "Static CSG GeoJSON", result: await testStaticGeoJson("csg-parcels") }])} />
          <DebugButton running={running} label="Test static Kouga GeoJSON" onClick={() => run("Static Kouga GeoJSON", async () => [{ id: `${Date.now()}-static-kouga`, title: "Static Kouga GeoJSON", result: await testStaticGeoJson("kouga-zoning") }])} />
          <DebugButton running={running} label="Test Mapbox rendering with test geometry" onClick={() => run("Mapbox test geometry", async () => {
            const [csg, kouga] = await Promise.all([testStaticGeoJson("csg-parcels", true), testStaticGeoJson("kouga-zoning", true)]);
            const mapboxSourceUpdated = csg.features.length > 0 || kouga.features.length > 0;
            return [
              { id: `${Date.now()}-test-csg`, title: "Mapbox test geometry: csg-parcels", result: csg, mapboxSourceUpdated },
              { id: `${Date.now()}-test-kouga`, title: "Mapbox test geometry: kouga-zoning", result: kouga, mapboxSourceUpdated },
            ];
          })} />
          <DebugButton running={running} label="Run full fallback chain" onClick={() => run("Full fallback chain", () => runForLayers("Full fallback chain", (layer) => loadOfficialPublicLayer(layer, bbox, 400)))} />
        </div>
        {running && <div className="mt-3 text-xs text-muted-foreground">Running: {running}…</div>}
      </section>

      <section className="mt-6 space-y-4">
        {results.map((item) => <ResultCard key={item.id} item={item} />)}
      </section>
    </div>
  );
}

function DebugButton({ label, onClick, running }: { label: string; onClick: () => void; running: string | null }) {
  return (
    <button
      onClick={onClick}
      disabled={!!running}
      className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function ResultCard({ item }: { item: DebugResult }) {
  const count = item.result.features.length;
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{item.title}</h2>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${count > 0 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-700 dark:text-red-400"}`}>
          {count > 0 ? `Features: ${count}` : "No features"}
        </span>
      </div>
      <div className="mt-2 grid gap-1 text-[12px]">
        <Row k="Layer" v={item.result.layer} />
        <Row k="Feature count" v={String(count)} />
        <Row k="Which fallback was used" v={item.result.fallbackUsed} />
        <Row k="Source label" v={item.result.sourceLabel} />
        <Row k="Official data" v={String(item.result.official)} />
        <Row k="Fetched at" v={item.result.fetchedAt} />
        <Row k="Whether Mapbox source was updated" v={item.mapboxSourceUpdated == null ? "Only available from live map/test geometry control" : String(item.mapboxSourceUpdated)} />
        {item.result.message && <Row k="Error message" v={item.result.message} />}
      </div>
      <details className="mt-3" open>
        <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">Attempts ({item.result.attempts.length})</summary>
        <div className="mt-2 space-y-2">
          {item.result.attempts.map((attempt, i) => <AttemptCard key={i} attempt={attempt} />)}
        </div>
      </details>
      {item.result.features[0] && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">First feature properties</summary>
          <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-[10px] leading-tight">{JSON.stringify(item.result.features[0].properties, null, 2)}</pre>
        </details>
      )}
    </article>
  );
}

function AttemptCard({ attempt }: { attempt: PublicDataAttempt }) {
  return (
    <div className={`rounded border p-2 text-[11px] ${attempt.ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{attempt.method} · {attempt.layer}</span>
        <span className={attempt.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>{attempt.ok ? `OK · ${attempt.featureCount ?? 0} features` : "FAIL"}</span>
      </div>
      <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{attempt.requestUrl}</div>
      <div className="mt-1 grid gap-0.5 text-[10px]">
        <Row k="Request URL" v={attempt.requestUrl} />
        <Row k="HTTP status" v={attempt.httpStatus != null ? String(attempt.httpStatus) : "—"} />
        <Row k="Feature count" v={attempt.featureCount != null ? String(attempt.featureCount) : "—"} />
        <Row k="Error message" v={attempt.errorMessage ?? "—"} />
        <Row k="Which fallback was used" v={attempt.fallbackUsed} />
        {attempt.responsePreview && (
          <details className="mt-1">
            <summary className="cursor-pointer">Response preview</summary>
            <pre className="mt-1 overflow-auto rounded bg-muted p-1.5 text-[10px] leading-tight">{attempt.responsePreview}</pre>
          </details>
        )}
      </div>
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