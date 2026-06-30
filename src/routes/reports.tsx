import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, FileText, Lock, Sparkles } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { REPORT_CATALOG, formatPrice, type ReportType } from "@/lib/reports/catalog";
import { getActiveProvider } from "@/lib/providers/registry";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Report Marketplace — ErfStoep" },
      { name: "description", content: "Order professional property intelligence reports. Property, Ownership, Valuation, Comparable Sales, and Transfer History." },
      { property: "og:title", content: "Report Marketplace — ErfStoep" },
      { property: "og:description", content: "Property intelligence reports for investors, developers and homeowners." },
    ],
    links: [{ rel: "canonical", href: "/reports" }],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Array<{ id: string; report_type: string; status: string; created_at: string }>>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("report_orders").select("id, report_type, status, created_at")
      .order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => setOrders(data ?? []));
  }, [user]);

  async function order(type: ReportType) {
    if (!user) { toast.message("Sign in to order reports"); return; }
    const def = REPORT_CATALOG.find((r) => r.id === type);
    if (!def?.available) { toast.message("This report is coming soon"); return; }
    const provider = getActiveProvider();
    const { error, data } = await supabase.from("report_orders").insert({
      user_id: user.id,
      parcel_id: "demo:sample",
      report_type: type,
      status: "pending",
      price_cents: def.priceCents,
      provider: provider.meta.id,
      payload: { placeholder: true, createdAt: new Date().toISOString() },
    }).select("id, report_type, status, created_at").single();
    if (error) { toast.error(error.message); return; }
    setOrders((o) => [data, ...o]);
    toast.success("Order placed (pending) — no payment processed");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16 pt-28">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3 w-3 text-accent" /> Report Marketplace
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Property intelligence reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Order official third-party reports when you need verified data. Reports marked Coming Soon will activate
          once their underlying provider is connected. No payment is processed at this stage — orders are logged as pending.
        </p>
        <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
          Reports are provided by third-party data providers. ErfStoep does not alter official report data.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {REPORT_CATALOG.map((r) => (
            <article key={r.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-white">
                  <FileText className="h-4 w-4" />
                </span>
                {!r.available && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" /> Coming Soon
                  </span>
                )}
              </div>
              <h3 className="mt-3 text-base font-semibold tracking-tight">{r.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
              <dl className="mt-4 space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between"><dt>Provider</dt><dd className="text-foreground">{r.providerHint}</dd></div>
                <div className="flex justify-between"><dt>Turnaround</dt><dd className="text-foreground">{r.estTurnaround}</dd></div>
                <div className="flex justify-between"><dt>Price</dt><dd className="font-semibold text-foreground tabular-nums">{formatPrice(r.priceCents)}</dd></div>
              </dl>
              <button
                disabled={!r.available}
                onClick={() => order(r.id)}
                className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              >
                {r.available ? "Order report" : "Coming Soon"}
              </button>
            </article>
          ))}
        </div>

        {user && orders.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold tracking-tight">Your recent orders</h2>
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{REPORT_CATALOG.find((r) => r.id === o.report_type)?.name ?? o.report_type}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                    {o.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!user && (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
            <Crown className="mx-auto h-6 w-6 text-accent" />
            <p className="mt-2 text-sm font-medium">Sign in to order reports</p>
            <Link to="/auth" className="mt-3 inline-flex rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background">Sign in</Link>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
