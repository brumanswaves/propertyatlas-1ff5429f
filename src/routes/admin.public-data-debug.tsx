import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { fetchArcGisLayer, type ArcGisFeatureCollection, type AttemptDiagnostic } from "@/lib/providers/arcgis.functions";

export const Route = createFileRoute("/admin/public-data-debug")({
  head: () => ({ meta: [{ title: "Public Data Debug — PropertyAtlas Admin" }] }),
  component: PublicDataDebug,
});

const ST_FRANCIS_BBOX: [number, number, number, number] = [24.80, -34.21, 24.86, -34.14];

type LayerResult = {
  layer: "csg-parcels" | "kouga-zoning";
  bbox: [number, number, number, number];
  result?: ArcGisFeatureCollection;
  error?: { name: string; message: string; causeCode?: string; causeMessage?: string };
  startedAt: string;
};

function PublicDataDebug() {
  const [bbox, setBbox] = useState<[number, number, number, number]>(ST_FRANCIS_BBOX);
  const [results, setResults] = useState<LayerResult[]>([]);
  const [staticProbe, setStaticProbe] = useState<{ ok: boolean; status?: number; count?: number; message?: string } | null>(null);
  const [running, setRunning] = useState(false);

  async function runQuery(layer: "csg-parcels" | "kouga-zoning", b: [number, number, number, number]): Promise<LayerResult> {
    const startedAt = new Date().toISOString();
    try {
      const result = await fetchArcGisLayer({ data: { layer, bbox: b, limit: 50 } });
      return { layer, bbox: b, result, startedAt };
    } catch (err) {
      const e = err as Error & { cause?: { code?: unknown; message?: unknown } };
      return {
        layer,
        bbox: b,
        startedAt,
        error: {
          name: e?.name ?? "Error",
          message: e?.message ?? String(err),
          causeCode: e?.cause?.code != null ? String(e.cause.code) : undefined,
          causeMessage: typeof e?.cause?.message === "string" ? e.cause.message : undefined,
        },
      };
    }
  }

  async function probeStatic() {
    try {
      const res = await fetch("/data/st-francis-csg-parcels.geojson", { cache: "no-cache" });
      if (!res.ok) {
        setStaticProbe({ ok: false, status: res.status, message: "No imported CSG parcel file found." });
        return;
      }
      const j = await res.json();
      const count = Array.isArray(j?.features) ? j.features.length : 0;
      setStaticProbe({ ok: true, status: res.status, count });
    } catch (err) {
      setStaticProbe({ ok: false, message: err instanceof Error ? err.message : "fetch failed" });
    }
  }

  async function runTest(b: [number, number, number, number]) {
    setRunning(true);
    setResults([]);
    setStaticProbe(null);
    const [csg, kouga] = await Promise.all([runQuery("csg-parcels", b), runQuery("kouga-zoning", b)]);
    setResults([csg, kouga]);
    await probeStatic();
    setRunning(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Admin</div>
      <h1 className="text-2xl font-bold tracking-tight">Public Data Debug</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Walks CSG (https/http, primary + DFFE fallback) and Kouga endpoints, retrying
        GeoJSON and ESRI JSON formats. Shows every attempt with HTTP status, body preview,
        and the underlying fetch error including cause code.
      </p>

      <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-[12px] text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <strong>Admin note:</strong> Live CSG endpoints may be unreliable or blocked from
        cloud runtimes. If live access fails, upload official CSG GeoJSON to
        <code className="mx-1 rounded bg-amber-900/10 px-1">public/data/st-francis-csg-parcels.geojson</code>
        and the map will load it as <em>Imported CSG GeoJSON</em>. Do not fabricate official
        parcel data.
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

        {staticProbe && (
          <article className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Imported CSG GeoJSON fallback</h2>
            <div className="mt-2 grid gap-1 text-[12px]">
              <Row k="Path" v="/data/st-francis-csg-parcels.geojson" />
              <Row k="Reachable" v={String(staticProbe.ok)} />
              <Row k="HTTP status" v={staticProbe.status != null ? String(staticProbe.status) : "—"} />
              <Row k="Feature count" v={staticProbe.count != null ? String(staticProbe.count) : "—"} />
              {staticProbe.message && <Row k="Message" v={staticProbe.message} />}
            </div>
          </article>
        )}

        {results.map((r) => (
          <article key={r.layer} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{r.layer}</h2>
              {r.result?.meta.activeSource ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                  Active: {r.result.meta.activeSource} · {r.result.meta.activeFormat}
                </span>
              ) : (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700 dark:text-red-400">
                  Failed
                </span>
              )}
            </div>

            {r.error && (
              <div className="mt-2 rounded bg-red-500/10 p-2 text-[11px] text-red-700 dark:text-red-300">
                <div><strong>{r.error.name}:</strong> {r.error.message}</div>
                {r.error.causeCode && <div>cause.code = {r.error.causeCode}</div>}
                {r.error.causeMessage && <div>cause.message = {r.error.causeMessage}</div>}
              </div>
            )}

            {r.result && (
              <div className="mt-2 grid gap-1 text-[12px]">
                <Row k="Source" v={r.result.meta.source} />
                <Row k="Upstream reachable" v={String(r.result.meta.upstreamReachable)} />
                <Row k="Active URL" v={r.result.meta.activeUrl ?? "—"} />
                <Row k="Feature count" v={String(r.result.meta.count)} />
                <Row k="Upstream message" v={r.result.meta.upstreamMessage ?? "—"} />
                <Row k="Bbox used" v={r.result.meta.bboxUsed.join(", ")} />
                <Row k="Runtime" v={r.result.meta.runtime} />
                <Row k="Fetched at" v={r.result.meta.fetchedAt} />
                <Row k="Started at" v={r.startedAt} />
                {r.result.meta.primaryStatus && (
                  <Row k="Primary summary" v={`reachable=${r.result.meta.primaryStatus.reachable} count=${r.result.meta.primaryStatus.count}${r.result.meta.primaryStatus.message ? ` msg=${r.result.meta.primaryStatus.message}` : ""}`} />
                )}
                {r.result.meta.fallbackStatus && (
                  <Row k="Fallback summary" v={`reachable=${r.result.meta.fallbackStatus.reachable} count=${r.result.meta.fallbackStatus.count}${r.result.meta.fallbackStatus.message ? ` msg=${r.result.meta.fallbackStatus.message}` : ""}`} />
                )}

                <details className="mt-2" open>
                  <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">
                    Attempts ({r.result.meta.attempts.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {r.result.meta.attempts.map((a, i) => (
                      <AttemptCard key={i} a={a} />
                    ))}
                  </div>
                </details>

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

function AttemptCard({ a }: { a: AttemptDiagnostic }) {
  return (
    <div className={`rounded border p-2 text-[11px] ${a.ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold">{a.endpoint} · {a.format}</span>
        <span className={a.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
          {a.ok ? `OK · ${a.count ?? 0} features` : "FAIL"} · {a.durationMs}ms
        </span>
      </div>
      <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{a.url}</div>
      <div className="mt-1 grid gap-0.5 text-[10px]">
        {a.httpStatus != null && <div>HTTP status: {a.httpStatus}</div>}
        {a.errorName && <div>err.name: {a.errorName}</div>}
        {a.errorMessage && <div>err.message: {a.errorMessage}</div>}
        {a.errorCauseCode && <div>err.cause.code: {a.errorCauseCode}</div>}
        {a.errorCauseMessage && <div>err.cause.message: {a.errorCauseMessage}</div>}
        {a.bodyPreview && (
          <details>
            <summary className="cursor-pointer">Response body preview</summary>
            <pre className="mt-1 overflow-auto rounded bg-muted p-1.5 text-[10px] leading-tight">{a.bodyPreview}</pre>
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
