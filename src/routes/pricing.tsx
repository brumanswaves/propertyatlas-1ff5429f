import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles, Lock, FileText } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Easy Erf" },
      { name: "description", content: "Easy Erf is free for public-data parcel research. Pay only for third-party reports once those integrations go live." },
      { property: "og:title", content: "Easy Erf pricing" },
      { property: "og:description", content: "Free public-data research. Pay only for the reports you need." },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

interface Tier {
  name: string;
  price: string;
  period?: string;
  blurb: string;
  cta: { label: string; to: string };
  features: string[];
  badge?: string;
}

const TIERS: Tier[] = [
  {
    name: "Free Research Tools",
    price: "R0",
    period: "forever",
    blurb: "Public-data parcel research, free for everyone.",
    cta: { label: "Open the map", to: "/" },
    features: [
      "CSG parcel map",
      "Erf lookup",
      "Kouga public GIS context where available",
      "Research links",
      "Notes",
      "Listing URL saving",
      "Calculators",
    ],
  },
  {
    name: "Lightstone Reports",
    price: "Coming Soon",
    blurb: "Pay per report once the Lightstone connection is live.",
    cta: { label: "Register interest", to: "/contact" },
    badge: "Coming Soon",
    features: [
      "Property report",
      "Seller valuation report",
      "Ownership, transfer, valuation, bond, and comparable sales data — where included in the official report",
    ],
  },
  {
    name: "WinDeed Reports",
    price: "Coming Soon",
    blurb: "Pay per report once the WinDeed connection is live.",
    cta: { label: "Register interest", to: "/contact" },
    badge: "Coming Soon",
    features: [
      "Property report",
      "Deeds search",
      "AVM report",
      "SG diagram support where available",
    ],
  },
  {
    name: "Surveyor-General Documents",
    price: "Official source",
    blurb: "Direct link-through to the official CSG public viewer.",
    cta: { label: "Open the map", to: "/" },
    features: [
      "SG document links where available",
      "CSG Property Viewer fallback always available",
    ],
  },
];

function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-32">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" /> Pricing
          </span>
          <h1 className="mx-auto mt-4 max-w-2xl text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Pay only for the reports you need.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            Easy Erf is free to use for public parcel research. Verified ownership, valuation, transfers, bonds, and comparable sales will be available through third-party reports once integrations are connected.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => (
            <div key={t.name} className="relative flex flex-col rounded-3xl border border-border bg-card p-6">
              {t.badge && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent dark:text-accent">
                  <Lock className="h-3 w-3" /> {t.badge}
                </span>
              )}
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight">{t.price}</span>
                {t.period && <span className="text-xs text-muted-foreground">{t.period}</span>}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t.blurb}</p>
              <ul className="mt-4 flex-1 space-y-1.5 text-xs">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={t.cta.to}
                className="mt-5 inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
              >
                {t.cta.label}
              </Link>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-border bg-card p-5 text-center">
          <FileText className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">No subscriptions. No fake data.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Easy Erf does not yet provide official deeds, valuation, ownership, transfer, bond, or comparable-sales data.
            Those will only be shown when delivered through a real third-party report.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
