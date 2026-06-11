import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bookmark, MapPinned, TrendingUp, Activity, Bell, Crown, Sparkles,
  ArrowUpRight, Building2, Waves, LineChart, AlertCircle,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getProperty, formatZAR, PROPERTIES, type Property } from "@/data/properties";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PropertyAtlas" },
      { name: "description", content: "Your saved properties, watchlist alerts, portfolio insights, and market pulse." },
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

  // Top picks: best investor-score properties not yet saved
  const topPicks = useMemo(() => {
    const savedIds = new Set(saved.map((p) => p.id));
    return [...PROPERTIES]
      .filter((p) => !savedIds.has(p.id))
      .sort((a, b) => b.scores.investor - a.scores.investor)
      .slice(0, 6);
  }, [saved]);

  // Market pulse (mock, deterministic on PROPERTIES)
  const pulse = useMemo(() => {
    const beachfront = PROPERTIES.filter((p) => p.features.beachfront);
    const median = (vals: number[]) => {
      const s = [...vals].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)] ?? 0;
    };
    return {
      medianPrice: median(PROPERTIES.map((p) => p.estimatedValue)),
      beachfrontPrice: median(beachfront.map((p) => p.estimatedValue)),
      avgInvestor: Math.round(PROPERTIES.reduce((s, p) => s + p.scores.investor, 0) / PROPERTIES.length),
      yoy: 7.4,
      activeListings: PROPERTIES.filter((p) => p.status === "Recently listed").length,
    };
  }, []);

  if (!user) return null;

  const totalValue = saved.reduce((s, p) => s + p.estimatedValue, 0);
  const avgInvestor = saved.length
    ? Math.round(saved.reduce((s, p) => s + p.scores.investor, 0) / saved.length)
    : 0;
  const avgSellerProb = saved.length
    ? Math.round(saved.reduce((s, p) => s + p.scores.sellerProbability, 0) / saved.length)
    : 0;

  // Mock alerts derived from saved properties
  const alerts = saved.slice(0, 3).map((p, i) => {
    const kinds = [
      { icon: TrendingUp, tone: "text-emerald-600", msg: `Estimated value up ${(2 + i * 0.7).toFixed(1)}% this quarter` },
      { icon: AlertCircle, tone: "text-amber-600", msg: "Seller probability rose to High" },
      { icon: Activity, tone: "text-sky-600", msg: "Comparable sale registered within 400 m" },
    ];
    const k = kinds[i % kinds.length];
    return { property: p, ...k };
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16 pt-28">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3 text-accent" /> Investor dashboard
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Your portfolio</h1>
            <p className="text-sm text-muted-foreground">Watchlist, alerts, and live market pulse.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <MapPinned className="h-3.5 w-3.5" /> Open map
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-premium px-3 py-1.5 text-xs font-semibold text-accent-foreground shadow-soft hover:opacity-95"
            >
              <Crown className="h-3.5 w-3.5" /> Upgrade
            </Link>
          </div>
        </div>

        {/* Portfolio KPIs */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Saved properties" value={saved.length.toString()} accent="brand" />
          <KpiCard label="Portfolio value (est.)" value={saved.length ? formatZAR(totalValue) : "—"} accent="brand" />
          <KpiCard
            label="Avg investor score"
            value={saved.length ? `${avgInvestor} / 100` : "—"}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <KpiCard
            label="Avg seller probability"
            value={saved.length ? `${avgSellerProb}%` : "—"}
            icon={<Activity className="h-4 w-4" />}
          />
        </div>

        {/* Market pulse */}
        <section className="mt-10">
          <SectionTitle icon={<LineChart className="h-3.5 w-3.5" />}>St Francis Bay market pulse</SectionTitle>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <PulseCard label="Median price" value={formatZAR(pulse.medianPrice)} delta={`+${pulse.yoy}% YoY`} positive />
            <PulseCard label="Beachfront median" value={formatZAR(pulse.beachfrontPrice)} delta="+11.2% YoY" positive icon={<Waves className="h-3.5 w-3.5" />} />
            <PulseCard label="Avg investor score" value={`${pulse.avgInvestor} / 100`} delta="Stable" />
            <PulseCard label="Active listings" value={pulse.activeListings.toString()} delta="Tracking weekly" />
          </div>
        </section>

        {/* Alerts */}
        <section className="mt-10">
          <SectionTitle icon={<Bell className="h-3.5 w-3.5" />}>Watchlist alerts</SectionTitle>
          {alerts.length === 0 ? (
            <EmptyCard
              icon={<Bell className="h-5 w-5" />}
              title="No alerts yet"
              body="Save properties to start receiving valuation, seller-probability, and comparable-sale alerts."
            />
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {alerts.map((a, i) => {
                const Icon = a.icon;
                return (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className={`grid h-8 w-8 place-items-center rounded-full bg-muted ${a.tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.property.street}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {a.property.area} · Erf {a.property.erf} — {a.msg}
                      </div>
                    </div>
                    <span className="hidden text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
                      Today
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Saved properties */}
        <section className="mt-10">
          <SectionTitle icon={<Bookmark className="h-3.5 w-3.5" />}>Saved properties</SectionTitle>
          {saved.length === 0 ? (
            <EmptyCard
              icon={<Bookmark className="h-5 w-5" />}
              title="You haven't saved any properties yet"
              body="Click any parcel on the map and tap the bookmark to add it to your portfolio."
              cta={{ to: "/", label: "Open the map" }}
            />
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {saved.map((p) => <PropertyCard key={p.id} p={p} />)}
            </div>
          )}
        </section>

        {/* Top picks */}
        <section className="mt-10">
          <SectionTitle icon={<TrendingUp className="h-3.5 w-3.5" />}>Top picks for you</SectionTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Ranked by investor score across the St Francis Bay pilot.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topPicks.map((p) => <PropertyCard key={p.id} p={p} highlight />)}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="grid h-5 w-5 place-items-center rounded-md bg-muted text-foreground/70">{icon}</span>
      {children}
    </div>
  );
}

function KpiCard({
  label, value, icon, accent,
}: { label: string; value: string; icon?: React.ReactNode; accent?: "brand" }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent === "brand" ? "border-transparent bg-gradient-brand text-white" : "border-border bg-card"
      }`}
    >
      <div className={`flex items-center justify-between text-[11px] font-medium uppercase tracking-wider ${accent === "brand" ? "text-white/80" : "text-muted-foreground"}`}>
        {label}
        {icon}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

function PulseCard({
  label, value, delta, positive, icon,
}: { label: string; value: string; delta: string; positive?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1">{icon}{label}</span>
      </div>
      <div className="mt-1 text-lg font-semibold tracking-tight tabular-nums">{value}</div>
      <div className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${positive ? "text-emerald-600" : "text-muted-foreground"}`}>
        {positive && <ArrowUpRight className="h-3 w-3" />} {delta}
      </div>
    </div>
  );
}

function PropertyCard({ p, highlight }: { p: Property; highlight?: boolean }) {
  return (
    <Link
      to="/"
      className={`group block rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-soft ${
        highlight ? "border-accent/40" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <span>{p.area} · Erf {p.erf}</span>
        {p.features.beachfront && <Waves className="h-3 w-3 text-primary" />}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate text-sm font-semibold">{p.street}</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <div className="text-lg font-semibold tracking-tight tabular-nums">{formatZAR(p.estimatedValue)}</div>
        <div className="text-[11px] text-muted-foreground">Score {p.scores.investor}</div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${p.scores.investor}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Seller prob. {p.scores.sellerProbability}%</span>
        <span className="inline-flex items-center gap-0.5 text-foreground/70 group-hover:text-foreground">
          View on map <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

function EmptyCard({
  icon, title, body, cta,
}: { icon: React.ReactNode; title: string; body: string; cta?: { to: string; label: string } }) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      {cta && (
        <Link
          to={cta.to}
          className="mt-4 inline-flex rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
