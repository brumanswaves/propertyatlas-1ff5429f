import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bookmark, MapPinned, TrendingUp } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getProperty, formatZAR, type Property } from "@/data/properties";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PropertyAtlas" },
      { name: "description", content: "Your saved properties, watchlists, and market insights." },
      { property: "og:url", content: "/dashboard" },
    ],
    links: [{ rel: "canonical", href: "/dashboard" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, loading } = useAuth();
  const [saved, setSaved] = useState<Property[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("saved_properties")
      .select("parcel_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const props = (data ?? [])
          .map((r) => getProperty(r.parcel_id))
          .filter((p): p is Property => !!p);
        setSaved(props);
      });
  }, [user]);

  if (!user) return null;

  const totalValue = saved.reduce((s, p) => s + p.estimatedValue, 0);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-28">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your portfolio</h1>
            <p className="text-sm text-muted-foreground">Saved properties and watchlist insights.</p>
          </div>
          <Link
            to="/"
            className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted sm:inline-flex"
          >
            <MapPinned className="h-3.5 w-3.5" /> Back to map
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard label="Saved properties" value={saved.length.toString()} />
          <StatCard label="Portfolio value (est.)" value={formatZAR(totalValue)} />
          <StatCard
            label="Avg investor score"
            value={
              saved.length
                ? Math.round(saved.reduce((s, p) => s + p.scores.investor, 0) / saved.length).toString()
                : "—"
            }
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
          />
        </div>

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Saved properties</h2>
        {saved.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border p-10 text-center">
            <Bookmark className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              You haven't saved any properties yet. Click any parcel on the map to save it.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
            >
              Open the map
            </Link>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {p.area} · Erf {p.erf}
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold">{p.street}</div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div className="text-lg font-semibold tracking-tight">{formatZAR(p.estimatedValue)}</div>
                  <div className="text-[11px] text-muted-foreground">Score {p.scores.investor}</div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${p.scores.investor}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {icon}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
