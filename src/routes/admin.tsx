import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Database, AlertCircle, CheckCircle2 } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { listProviders, getActiveProviderId, setActiveProviderId } from "@/lib/providers/registry";
import { PROPERTIES } from "@/data/properties";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — PropertyAtlas" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeId, setActiveId] = useState(getActiveProviderId());
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [healths, setHealths] = useState<Record<string, { status: string; message?: string }>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
    supabase.from("report_orders").select("id", { count: "exact", head: true })
      .then(({ count }) => setOrderCount(count ?? 0));
  }, [user]);

  useEffect(() => {
    Promise.all(listProviders().map(async (p) => [p.meta.id, await p.health()] as const))
      .then((entries) => {
        const next: Record<string, { status: string; message?: string }> = {};
        for (const [id, h] of entries) next[id] = { status: h.status, message: h.message };
        setHealths(next);
      });
  }, []);

  if (!user) return null;

  if (isAdmin === false) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <TopNav />
        <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16 pt-28">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h1 className="text-lg font-semibold text-amber-900">Admin access required</h1>
            <p className="mt-2 text-sm text-amber-800">
              Your account doesn't have the <code>admin</code> role. Ask a workspace owner to grant access via the
              <code className="mx-1 rounded bg-amber-100 px-1">user_roles</code> table.
            </p>
            <p className="mt-2 text-xs text-amber-700">Signed in as {user.email}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isAdmin === null) return null;

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

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Data provider roadmap</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-2 text-left">Capability</th><th className="px-4 py-2 text-left">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { label: "Demo data", status: "Active" },
                  { label: "Public link research", status: "Active" },
                  { label: "Lightstone reports", status: "Pending integration" },
                  { label: "WinDeed reports", status: "Pending integration" },
                  { label: "Surveyor-General data", status: "Pending integration" },
                  { label: "Municipal GIS", status: "Pending integration" },
                ].map((r) => {
                  const ok = r.status === "Active";
                  return (
                    <tr key={r.label}>
                      <td className="px-4 py-3 font-medium">{r.label}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
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
