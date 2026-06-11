import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown, Sparkles } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — PropertyAtlas" },
      { name: "description", content: "Free, Investor (R199/mo), and Pro (R499/mo) tiers for South African property intelligence." },
      { property: "og:title", content: "PropertyAtlas pricing" },
      { property: "og:description", content: "Investor-grade property analytics from R199/month." },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

const TIERS = [
  {
    name: "Free",
    price: "R0",
    period: "forever",
    blurb: "For homeowners and casual research.",
    cta: "Start exploring",
    features: [
      "Full map access",
      "Basic property profiles",
      "Search by address & erf",
      "Limited filters",
    ],
  },
  {
    name: "Investor",
    price: "R199",
    period: "/ month",
    blurb: "For buyers and investors tracking opportunities.",
    cta: "Start free trial",
    featured: true,
    features: [
      "Everything in Free",
      "Ownership timeline & duration",
      "Comparable sales within 1 km",
      "10-year property history (PDF export)",
      "Unlimited watchlists & price alerts",
    ],
  },
  {
    name: "Pro",
    price: "R499",
    period: "/ month",
    blurb: "For developers, agents, analysts, and property professionals.",
    cta: "Talk to sales",
    features: [
      "Everything in Investor",
      "Development feasibility scoring",
      "Portfolio tracker",
      "Advanced filters & bulk exports",
      "Advanced research tools",
    ],
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-32">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" />
            Pricing
          </span>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            Investor-grade property intelligence,<br className="hidden md:block" /> at a fraction of the cost.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Start free. Upgrade when you need ownership history, comparable sales, and development analytics.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`relative flex flex-col rounded-3xl border p-6 ${
                t.featured ? "border-transparent bg-gradient-brand text-white shadow-panel" : "border-border bg-card"
              }`}
            >
              {t.featured && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
                  <Crown className="h-3 w-3" /> Most popular
                </span>
              )}
              <div className="text-sm font-medium uppercase tracking-wider opacity-70">{t.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">{t.price}</span>
                <span className="text-sm opacity-70">{t.period}</span>
              </div>
              <p className="mt-2 text-sm opacity-80">{t.blurb}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-4 w-4 ${t.featured ? "text-white" : "text-primary"}`} />
                    <span className={t.featured ? "opacity-90" : ""}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className={`mt-6 inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  t.featured
                    ? "bg-white text-foreground hover:bg-white/90"
                    : "bg-foreground text-background hover:opacity-90"
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-12 max-w-2xl text-center text-[11px] leading-relaxed text-muted-foreground">
          Pilot data is mock data for demonstration purposes. PropertyAtlas does not yet provide official deeds, valuation, or ownership records.
        </p>
      </main>
    </div>
  );
}
