import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, SectionHeading, CTASection } from "@/components/layout/MarketingPage";
import { TrendingUp, MapPin, Bell, GitCompare, Layers, History, Activity, Building2, LineChart, Home, Banknote } from "lucide-react";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/for-investors")({
  head: () => ({
    meta: [
      { title: `${BRAND.site} for Investors` },
      { name: "description", content: "Identify opportunities, analyze locations, monitor properties, compare areas, evaluate development potential, and understand property history." },
      { property: "og:title", content: `${BRAND.site} for Investors` },
      { property: "og:description", content: "Investor-grade erf research - public sources, saved evidence, assumptions, and due diligence steps." },
    ],
  }),
  component: ForInvestors,
});

const SCORES = [
  { icon: Activity, name: "Research Readiness", desc: "Known fields, missing checks, and next best due diligence step." },
  { icon: Building2, name: "Planning Context", desc: "Public zoning and planning links where source-backed data exists." },
  { icon: LineChart, name: "Market Evidence", desc: "Saved listing and comp URLs that you verify manually." },
  { icon: Home, name: "Calculator Assumptions", desc: "Yield, holding cost, flip, and target-offer scenarios using your own numbers." },
  { icon: Banknote, name: "Report Confidence", desc: "Optional Lightstone, WinDeed, SG, and other provider reports when needed." },
];

const CAPABILITIES = [
  { icon: MapPin, title: "Identify opportunities", desc: "Click official erfs and build a source-backed dossier around the parcel." },
  { icon: TrendingUp, title: "Analyze locations", desc: "Compare market context, listing evidence, and your own assumptions side by side." },
  { icon: Bell, title: "Monitor properties", desc: "Add to watchlist and get alerts when something material changes." },
  { icon: GitCompare, title: "Compare areas", desc: "Save useful comps and compare evidence quality before making a call." },
  { icon: Layers, title: "Evaluate development potential", desc: "Open official zoning, planning, SG, and municipal sources where available." },
  { icon: History, title: "Track due diligence", desc: `Use ${BRAND.workflow} to see what is known, missing, and worth verifying next.` },
];

function ForInvestors() {
  return (
    <MarketingPage
      eyebrow="For Investors"
      title="Investor-grade research on every erf."
      subtitle="Find the right opportunities. Pass on the wrong ones - faster."
      intro={`${BRAND.site} gives investors a map-first command center for public parcel facts, saved evidence, calculators, due diligence steps, and optional provider reports.`}
      heroCta={{ label: "Open the Map", to: "/" }}
    >
      <section>
        <SectionHeading title={`What investors do on ${BRAND.site}`} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <Card key={c.title} icon={<c.icon className="h-5 w-5" />} title={c.title}>{c.desc}</Card>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading
          eyebrow={BRAND.workflow}
          title="Guided checks that move you to a decision"
          subtitle="Every prompt is informational - not a recommendation, forecast, valuation, or professional advice."
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
          Workflow prompts are informational indicators - not guarantees, recommendations, forecasts, valuations, or professional advice.
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
