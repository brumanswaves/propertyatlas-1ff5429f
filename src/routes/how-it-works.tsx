import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, NumberedStep, SectionHeading, CTASection } from "@/components/layout/MarketingPage";
import { Search, Map, MousePointerClick, BarChart3, Bookmark, Crown } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How ErfStop Works" },
      { name: "description", content: "Search a property, explore the map, click a parcel, review intelligence, save and monitor — and unlock deeper insights with premium tools." },
      { property: "og:title", content: "How ErfStop Works" },
      { property: "og:description", content: "Six steps from search to deep property intelligence." },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [
  { icon: Search, title: "Search for a property", text: "Search by address, erf number, or area. Suggestions surface as you type — including the most relevant parcels in the current view." },
  { icon: Map, title: "Explore the map", text: "Switch between satellite, street, and analytical layers. Filter by property type, ownership, scores, and investment signals." },
  { icon: MousePointerClick, title: "Click a parcel", text: "Tap any erf to open its intelligence panel. Every property on the map is interactive, not just listed ones." },
  { icon: BarChart3, title: "Review property intelligence", text: "See estimated value, last sale, ownership tenure, area performance, investor and development scores, plus an AI summary of why this property matters." },
  { icon: Bookmark, title: "Save and monitor", text: "Add properties to your watchlist, build comparison sets, and revisit them from your dashboard at any time." },
  { icon: Crown, title: "Unlock deeper insights", text: "Upgrade to access ownership timelines, comparable sales, transfer history, development feasibility, and historical imagery." },
];

function HowItWorks() {
  return (
    <MarketingPage
      eyebrow="How it works"
      title="From a single search to a full property story."
      subtitle="Six steps. One map. Real intelligence."
      intro="ErfStop is designed around the way real research actually happens — visually, on a map, parcel by parcel."
      heroCta={{ label: "Try the Map", to: "/" }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <NumberedStep key={s.title} step={i + 1} title={s.title}>
              <span className="inline-flex items-center gap-2">
                <Icon className="h-4 w-4 text-accent" />
                {s.text}
              </span>
            </NumberedStep>
          );
        })}
      </div>

      <section className="mt-12 rounded-3xl border border-border bg-gradient-to-br from-card to-muted/40 p-8 shadow-soft">
        <SectionHeading
          eyebrow="Visual"
          title="Everything happens on the map"
          subtitle="The map is the interface. There is no list of properties to scroll — you explore them in space, the way they actually exist."
        />
        <div className="grid gap-3 rounded-2xl border border-dashed border-border bg-background/60 p-4 text-xs text-muted-foreground sm:grid-cols-3">
          <div className="rounded-xl bg-card p-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent">View 1</div>
            <p>Satellite map with every parcel rendered as an interactive polygon.</p>
          </div>
          <div className="rounded-xl bg-card p-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent">View 2</div>
            <p>Right-side intelligence panel — Overview, Ownership, Sales, Intelligence, Photos.</p>
          </div>
          <div className="rounded-xl bg-card p-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent">View 3</div>
            <p>Filters and layers to focus on beachfront, large erven, recent sales, or scoring thresholds.</p>
          </div>
        </div>
      </section>

      <CTASection
        title="Ready to explore your first property?"
        description="Open the live map and click any parcel in St Francis Bay to see real intelligence in action."
        primary={{ label: "Open the Map", to: "/" }}
        secondary={{ label: "See platform features", to: "/features" }}
      />
    </MarketingPage>
  );
}
