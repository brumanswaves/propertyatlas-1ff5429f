import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

      <TestGeometryToggle />


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
          <DebugButton running={running} label="Test backend proxy" onClick={() => run("Backend proxy", () => runForLayers("Backend proxy", (layer) => testEdgeProxy(layer, bbox, 400)))} />
          <DebugButton running={running} label="Test direct browser fetch" onClick={() => run("Direct browser fetch", () => runForLayers("Direct browser fetch", (layer) => testDirectFetch(layer, bbox, 400)))} />
          <DebugButton running={running} label="Test static CSG GeoJSON" onClick={() => run("Static CSG GeoJSON", async () => [{ id: `${Date.now()}-static-csg`, title: "Static CSG GeoJSON", result: await testStaticGeoJson("csg-parcels") }])} />
          <DebugButton running={running} label="Test static Kouga GeoJSON" onClick={() => run("Static Kouga GeoJSON", async () => [{ id: `${Date.now()}-static-kouga`, title: "Static Kouga GeoJSON", result: await testStaticGeoJson("kouga-zoning") }])} />
          <DebugButton running={running} label="Test Mapbox rendering with test geometry" onClick={() => run("Mapbox test geometry", async () => {
            const [csg, kouga] = await Promise.all([testStaticGeoJson("csg-parcels", true), testStaticGeoJson("kouga-zoning", true)]);
            const csgUpdated = window.localStorage.getItem("pa.arcgis.csg.meta.sourceUpdated") === "true";
            const kougaUpdated = window.localStorage.getItem("pa.arcgis.kouga.meta.sourceUpdated") === "true";
            return [
              { id: `${Date.now()}-test-csg`, title: "Mapbox test geometry: csg-parcels", result: csg, mapboxSourceUpdated: csgUpdated },
              { id: `${Date.now()}-test-kouga`, title: "Mapbox test geometry: kouga-zoning", result: kouga, mapboxSourceUpdated: kougaUpdated },
            ];
          })} />
          <DebugButton running={running} label="Run full fallback chain" onClick={() => run("Full fallback chain", () => runForLayers("Full fallback chain", (layer) => loadOfficialPublicLayer(layer, bbox, 400)))} />
        </div>
        {running && <div className="mt-3 text-xs text-muted-foreground">Running: {running}…</div>}
      </section>

      <section className="mt-6 space-y-4">
        {results.map((item) => <ResultCard key={item.id} item={item} />)}
      </section>

      <KougaEndpointStatus />
      <KougaLiveProbe />
      <SgDocumentDebug />

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
        <Row k="Whether Mapbox source was updated" v={item.mapboxSourceUpdated == null ? "No live map source update recorded by this test" : String(item.mapboxSourceUpdated)} />
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

function TestGeometryToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(window.localStorage.getItem("pa.testGeometry") === "1"); }, []);
  function toggle() {
    const next = !on;
    setOn(next);
    try { window.localStorage.setItem("pa.testGeometry", next ? "1" : "0"); } catch {}
  }
  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-3 text-[12px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-foreground">Show Test Geometry on main map</div>
          <div className="text-[11px] text-muted-foreground">
            Loads <code>TEST GEOMETRY ONLY</code> shapes. Not official data. Defaults to OFF. Reload the home page after toggling.
          </div>
        </div>
        <button onClick={toggle}
          className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-amber-500" : "bg-muted"}`}
          aria-pressed={on}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
        </button>
      </div>
      {on && (
        <div className="mt-2 rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
          TEST GEOMETRY ONLY — NOT OFFICIAL DATA
        </div>
      )}
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
import { buildSgDocumentUrl } from "@/lib/research/sgDocument";

function SgDocumentDebug() {
  const [lpi, setLpi] = useState("C01900000000007480000");
  const [erf, setErf] = useState("394");
  const [portion, setPortion] = useState("0");
  const [province, setProvince] = useState("Eastern Cape");
  const [majorRegion, setMajor] = useState("Humansdorp");
  const [minorRegion, setMinor] = useState("St Francis Bay");

  const result = buildSgDocumentUrl({ lpi, erfNumber: erf, portion, province, majorRegion, minorRegion });

  return (
    <section className="mt-10 rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">SG Document URL builder</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Tests the best-effort CSG document-list URL logic used by the property panel. Edit the fields below to see why the URL is or is not shown.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <DebugInput label="LPI" value={lpi} onChange={setLpi} />
        <DebugInput label="Erf number" value={erf} onChange={setErf} />
        <DebugInput label="Portion" value={portion} onChange={setPortion} />
        <DebugInput label="Province" value={province} onChange={setProvince} />
        <DebugInput label="Major region" value={majorRegion} onChange={setMajor} />
        <DebugInput label="Minor region" value={minorRegion} onChange={setMinor} />
      </div>

      <dl className="mt-5 space-y-1 rounded-lg border border-border bg-background p-3 text-[11px]">
        <Row k="Shown" v={result.shown ? "yes" : "no"} />
        <Row k="Reason" v={result.reason} />
        <Row k="Generated URL" v={result.shown ? result.url : "— (hidden)"} />
        <Row k="Fallback URL" v={result.fallbackUrl} />
        <Row k="Fields used" v={JSON.stringify(result.fieldsUsed)} />
      </dl>
    </section>
  );
}

function DebugInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]" />
    </label>
  );
}

import { KOUGA_ZONING_QUERY_URL, KOUGA_PROPERTIES_SG_URL, KOUGA_WARDS_URL } from "@/lib/providers/kougaEnrichment";

function KougaEndpointStatus() {
  const rows: Array<{ name: string; env?: string; url: string | null }> = [
    { name: "Zoning (hardcoded)", url: KOUGA_ZONING_QUERY_URL },
    { name: "Properties / SG", env: "VITE_KOUGA_PROPERTIES_SG_URL", url: KOUGA_PROPERTIES_SG_URL },
    { name: "Wards",            env: "VITE_KOUGA_WARDS_URL",        url: KOUGA_WARDS_URL },
  ];
  return (
    <section className="mt-10 rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">Kouga public GIS endpoints</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Zoning is hardcoded and discovered. Properties/SG and Wards are optional config slots — when missing, the property panel shows a clean "Endpoint not configured" state instead of an error.
      </p>
      <ul className="mt-3 space-y-2 text-[12px]">
        {rows.map((r) => (
          <li key={r.name} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-foreground">{r.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${r.url ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
                {r.url ? "Configured" : "Missing"}
              </span>
            </div>
            {r.env && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                {r.url
                  ? <>Env var: <code className="font-mono">{r.env}</code></>
                  : <>Missing endpoint: <code className="font-mono">{r.env}</code></>}
              </div>
            )}
            {r.url && <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{r.url}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}

import { fetchKougaEnrichment, type KougaEnrichmentState } from "@/lib/providers/kougaEnrichment";

function KougaLiveProbe() {
  const [lng, setLng] = useState("24.9112");
  const [lat, setLat] = useState("-34.0490");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<null | Awaited<ReturnType<typeof fetchKougaEnrichment>>>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setErr(null); setOut(null);
    try {
      const lo = Number(lng), la = Number(lat);
      if (!Number.isFinite(lo) || !Number.isFinite(la)) throw new Error("Invalid coordinates");
      setOut(await fetchKougaEnrichment(lo, la));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">Kouga live probe</h2>
      <p className="mt-1 text-xs text-muted-foreground">Fires the real Kouga ArcGIS queries at a point. Default coords are Jeffreys Bay.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs">Lng<input className="ml-2 w-32 rounded border border-border bg-background px-2 py-1 font-mono text-xs" value={lng} onChange={(e) => setLng(e.target.value)} /></label>
        <label className="text-xs">Lat<input className="ml-2 w-32 rounded border border-border bg-background px-2 py-1 font-mono text-xs" value={lat} onChange={(e) => setLat(e.target.value)} /></label>
        <button onClick={run} disabled={busy} className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50">{busy ? "Probing…" : "Probe at point"}</button>
      </div>
      {err && <div className="mt-3 text-xs text-amber-700 dark:text-amber-400">{err}</div>}
      {out && (
        <div className="mt-4 space-y-3">
          <ProbeRow label="Zoning" state={out.zoning} />
          <ProbeRow label="Properties / SG" state={out.property} />
          <ProbeRow label="Wards" state={out.ward} />
        </div>
      )}
    </section>
  );
}

function ProbeRow({ label, state }: { label: string; state: KougaEnrichmentState }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">{state.status}</span>
      </div>
      {state.status !== "not-configured" && (
        <div className="mt-2 space-y-1">
          {state.attemptUrls.map((u, i) => (
            <div key={i} className="break-all font-mono text-[10px] text-muted-foreground">{i + 1}. {u}</div>
          ))}
        </div>
      )}
      {state.status === "ok" && (
        <div className="mt-2 space-y-1">
          <div className="text-[10px] text-muted-foreground">Feature count: <span className="font-semibold text-foreground">{state.record.featureCount}</span> · Match method: <span className="font-semibold text-foreground">{state.record.matchMethod}</span></div>
          <details className="mt-1">
            <summary className="cursor-pointer text-[10px] text-muted-foreground">First feature attributes</summary>
            <pre className="mt-1 max-h-64 overflow-auto rounded border border-border bg-muted/40 p-2 text-[10px]">{JSON.stringify(state.record.attributes, null, 2)}</pre>
          </details>
        </div>
      )}
      {state.status === "error" && (
        <div className="mt-2 text-[10px] text-amber-700 dark:text-amber-400">Error: {state.message}{state.httpStatus ? ` (HTTP ${state.httpStatus})` : ""}</div>
      )}
      {state.status === "not-found" && (
        <div className="mt-2 text-[10px] text-muted-foreground">No matching feature at this point (point + envelope tried where applicable).</div>
      )}
      {state.status === "not-configured" && (
        <div className="mt-2 text-[10px] text-muted-foreground">Endpoint not configured.</div>
      )}
    </div>
  );
}
