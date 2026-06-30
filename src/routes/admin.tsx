import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Database, AlertCircle, CheckCircle2, CircleDashed } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { listProviders, getActiveProviderId, setActiveProviderId } from "@/lib/providers/registry";
import { PROPERTIES } from "@/data/properties";
import { AdminGuard } from "@/components/admin/AdminGuard";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — ErfStoep" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <AdminGuard>
      <AdminContent />
    </AdminGuard>
  );
}

function AdminContent() {
  const [activeId, setActiveId] = useState(getActiveProviderId());
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [healths, setHealths] = useState<Record<string, { status: string; message?: string }>>({});

  useEffect(() => {
    supabase.from("report_orders").select("id", { count: "exact", head: true })
      .then(({ count }) => setOrderCount(count ?? 0));
  }, []);

  useEffect(() => {
    Promise.all(listProviders().map(async (p) => [p.meta.id, await p.health()] as const))
      .then((entries) => {
        const next: Record<string, { status: string; message?: string }> = {};
        for (const [id, h] of entries) next[id] = { status: h.status, message: h.message };
        setHealths(next);
      });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-16 pt-28">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-primary" /> Admin
        </span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Platform control</h1>
        <p className="text-sm text-muted-foreground">Internal monitoring and provider configuration.</p>
        <div className="mt-4">
          <Link
            to="/admin/readiness"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted"
          >
            Provider readiness checklist →
          </Link>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Properties indexed" value={PROPERTIES.length.toString()} />
          <StatCard label="Parcels rendered" value={PROPERTIES.length.toString()} />
          <StatCard label="Report orders" value={orderCount?.toString() ?? "—"} />
          <StatCard label="Active provider" value={activeId} />
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Data providers</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-2 text-left">Provider</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-left">Active</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listProviders().map((p) => {
                  const h = healths[p.meta.id];
                  const ok = h?.status === "active";
                  return (
                    <tr key={p.meta.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{p.meta.name}</div>
                            <div className="text-[11px] text-muted-foreground">{p.meta.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ok ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                          {ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                          {h?.status?.replace("_", " ") ?? "checking…"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setActiveProviderId(p.meta.id); setActiveId(p.meta.id); }}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${activeId === p.meta.id ? "bg-foreground text-background" : "border border-border hover:bg-muted"}`}
                        >
                          {activeId === p.meta.id ? "Active" : "Switch"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Provider switching is local to this browser and intended for development / staging only.
          </p>
        </section>

        <HealthChecks />

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Data provider roadmap</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-2 text-left">Capability</th><th className="px-4 py-2 text-left">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { label: "Demo Provider", status: "Active" },
                  { label: "Public link research", status: "Active" },
                  { label: "CSG Public Cadastral Provider", status: "In Progress" },
                  { label: "Kouga Municipal GIS Provider", status: "In Progress" },
                  { label: "Lightstone Reports", status: "Pending Contract" },
                  { label: "WinDeed Reports", status: "Pending Contract" },
                  { label: "Surveyor-General licensed feed", status: "Pending Contract" },
                ].map((r) => {
                  const ok = r.status === "Active";
                  const progress = r.status === "In Progress";
                  return (
                    <tr key={r.label}>
                      <td className="px-4 py-3 font-medium">{r.label}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ok ? "bg-emerald-100 text-emerald-700" : progress ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"}`}>
                          {ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

type HealthRow = { name: string; ok: boolean | null; detail?: string };

function HealthChecks() {
  const [rows, setRows] = useState<HealthRow[]>([
    { name: "CSG endpoint reachable", ok: null },
    { name: "Kouga endpoint reachable", ok: null },
    { name: "Mapbox token configured", ok: null },
    { name: "Lovable Cloud backend", ok: null },
    { name: "Demo data loaded", ok: null },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { probeUpstream } = await import("@/lib/providers/arcgis.functions");
      const [csg, kouga] = await Promise.all([
        probeUpstream({ data: { layer: "csg-parcels" } }).catch((e: unknown) => ({ ok: false, reachable: false, message: e instanceof Error ? e.message : "error" })),
        probeUpstream({ data: { layer: "kouga-zoning" } }).catch((e: unknown) => ({ ok: false, reachable: false, message: e instanceof Error ? e.message : "error" })),
      ]);
      const mapboxOk = typeof import.meta.env.VITE_MAPBOX_ACCESS_TOKEN === "string" && import.meta.env.VITE_MAPBOX_ACCESS_TOKEN.length > 0;
      const { error: pingErr } = await supabase.from("user_roles").select("user_id", { head: true, count: "exact" }).limit(1);
      if (cancelled) return;
      const readMeta = (k: string) => {
        try {
          const raw = window.localStorage.getItem(k);
          if (!raw) return undefined;
          const m = JSON.parse(raw) as { count?: number; fetchedAt?: string; upstreamReachable?: boolean; upstreamMessage?: string };
          const when = m.fetchedAt ? new Date(m.fetchedAt).toLocaleString() : "—";
          return `${m.upstreamReachable ? "reachable" : "unreachable"} · ${m.count ?? 0} features · ${when}${m.upstreamMessage ? ` · ${m.upstreamMessage}` : ""}`;
        } catch { return undefined; }
      };
      setRows([
        { name: "CSG endpoint reachable", ok: csg.ok, detail: ("status" in csg ? `HTTP ${csg.status}` : csg.message) + (readMeta("pa.arcgis.csg.meta") ? ` — last fetch: ${readMeta("pa.arcgis.csg.meta")}` : "") },
        { name: "Kouga endpoint reachable", ok: kouga.ok, detail: ("status" in kouga ? `HTTP ${kouga.status}` : kouga.message ?? "Not configured") + (readMeta("pa.arcgis.kouga.meta") ? ` — last fetch: ${readMeta("pa.arcgis.kouga.meta")}` : "") },
        { name: "Mapbox token configured", ok: mapboxOk, detail: mapboxOk ? "VITE_MAPBOX_ACCESS_TOKEN present" : "Missing" },
        { name: "Lovable Cloud backend", ok: !pingErr, detail: pingErr?.message },
        { name: "Demo data loaded", ok: PROPERTIES.length > 0, detail: `${PROPERTIES.length} demo parcels` },
      ]);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Health checks</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-2 text-left">Check</th><th className="px-4 py-2 text-left">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const pending = r.ok === null;
              const ok = r.ok === true;
              return (
                <tr key={r.name}>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${pending ? "bg-muted text-muted-foreground" : ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {pending ? <CircleDashed className="h-2.5 w-2.5" /> : ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                      {pending ? "checking…" : ok ? "OK" : "Down"}
                    </span>
                    {r.detail ? <span className="ml-2 text-[11px] text-muted-foreground">{r.detail}</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
