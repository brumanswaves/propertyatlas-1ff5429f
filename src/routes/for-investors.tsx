import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, SectionHeading, CTASection } from "@/components/layout/MarketingPage";
import { TrendingUp, MapPin, Bell, GitCompare, Layers, History, Activity, Building2, LineChart, Home, Banknote } from "lucide-react";

export const Route = createFileRoute("/for-investors")({
  head: () => ({
    meta: [
      { title: "ErfStoep for Investors" },
      { name: "description", content: "Identify opportunities, analyze locations, monitor properties, compare areas, evaluate development potential, and understand property history." },
      { property: "og:title", content: "ErfStoep for Investors" },
      { property: "og:description", content: "Investor-grade property intelligence — scores, signals, and history on every parcel." },
    ],
  }),
  component: ForInvestors,
});

const SCORES = [
  { icon: Activity, name: "Investor Score", desc: "Composite of liquidity, appreciation, and yield indicators." },
  { icon: Building2, name: "Development Score", desc: "Zoning, bulk, and lot geometry potential." },
  { icon: LineChart, name: "Appreciation Potential", desc: "Modelled value trajectory relative to the suburb." },
  { icon: Home, name: "Rental Yield Potential", desc: "Indicative gross yield based on area performance." },
  { icon: Banknote, name: "Seller Probability", desc: "Likelihood the current owner is open to a transaction." },
];

const CAPABILITIES = [
  { icon: MapPin, title: "Identify opportunities", desc: "Filter the map by score thresholds, ownership tenure, or recent activity to surface candidates." },
  { icon: TrendingUp, title: "Analyze locations", desc: "Compare suburbs, micro-pockets, and street-level performance side by side." },
  { icon: Bell, title: "Monitor properties", desc: "Add to watchlist and get alerts when something material changes." },
  { icon: GitCompare, title: "Compare areas", desc: "See pricing, turnover, and ownership patterns across regions." },
  { icon: Layers, title: "Evaluate development potential", desc: "Zoning, coverage, bulk, and indicative GDV per parcel." },
  { icon: History, title: "Understand history", desc: "Ownership timelines, transfer prices, and long-term holding patterns." },
];

function ForInvestors() {
  return (
    <MarketingPage
      eyebrow="For Investors"
      title="Investor-grade intelligence on every parcel."
      subtitle="Find the right opportunities. Pass on the wrong ones — faster."
      intro="ErfStoep gives investors a Bloomberg-style view of residential, vacant land, and commercial parcels: scores, signals, sales history, and ownership intelligence in one place."
      heroCta={{ label: "Open the Map", to: "/" }}
    >
      <section>
        <SectionHeading title="What investors do on ErfStoep" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <Card key={c.title} icon={<c.icon className="h-5 w-5" />} title={c.title}>{c.desc}</Card>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading
          eyebrow="Proprietary signals"
          title="Scores that move you to a decision"
          subtitle="Every score is informational and modelled — not a recommendation, forecast, or professional advice."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCORES.map((s) => (
            <div key={s.name} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-2">
                <span className="inline-grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand text-primary-foreground">
                  <s.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">{s.name}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-primary to-accent" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground">
          Scores are proprietary informational indicators — not guarantees, recommendations, or forecasts. Estimate Only • Not a Certified Valuation.
        </p>
      </section>

      <CTASection
        title="Built for the way investors actually research"
        description="Map-first. Score-driven. Disclosure-clear. Start with St Francis Bay — more regions are coming."
        primary={{ label: "Start Free", to: "/auth" }}
        secondary={{ label: "See pricing", to: "/pricing" }}
      />
    </MarketingPage>
  );
}
