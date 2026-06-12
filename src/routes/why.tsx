import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, CTASection, SectionHeading } from "@/components/layout/MarketingPage";
import { X, Check } from "lucide-react";

export const Route = createFileRoute("/why")({
  head: () => ({
    meta: [
      { title: "Why PropertyAtlas?" },
      { name: "description", content: "Traditional property websites focus on listings. PropertyAtlas focuses on intelligence — research, analysis, and understanding." },
      { property: "og:title", content: "Why PropertyAtlas?" },
      { property: "og:description", content: "Listings vs intelligence. Browsing vs understanding." },
    ],
  }),
  component: Why,
});

const COMPARISON: Array<{ axis: string; old: string; pa: string }> = [
  { axis: "Focus", old: "Listings", pa: "Intelligence" },
  { axis: "Content", old: "Photos and price tags", pa: "Research, scores, and signals" },
  { axis: "Behaviour", old: "Browsing", pa: "Analysis" },
  { axis: "Goal", old: "Searching for what's for sale", pa: "Understanding what's there" },
  { axis: "Coverage", old: "Only properties on the market", pa: "Every parcel, every story" },
  { axis: "Bias", old: "Optimised for the seller", pa: "Optimised for the researcher" },
  { axis: "Disclosure", old: "Sparse or marketing-led", pa: "Transparent, informational, disclosed" },
];

function Why() {
  return (
    <MarketingPage
      eyebrow="Why PropertyAtlas?"
      title="Listings show you what's for sale. We show you what's there."
      subtitle="Two very different products. Two very different outcomes."
      intro="PropertyAtlas exists because property decisions deserve more than thumbnails and asking prices. Every parcel has a story — ownership tenure, sales history, location signals, and modelled potential. That's what we surface."
      heroCta={{ label: "Open the Map", to: "/" }}
    >
      <section>
        <SectionHeading title="Traditional property websites vs PropertyAtlas" />
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-border bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="px-4 py-3">Dimension</div>
            <div className="flex items-center gap-1.5 border-x border-border px-4 py-3">
              <X className="h-3.5 w-3.5" /> Traditional sites
            </div>
            <div className="flex items-center gap-1.5 px-4 py-3 text-primary">
              <Check className="h-3.5 w-3.5" /> PropertyAtlas
            </div>
          </div>
          {COMPARISON.map((row, i) => (
            <div
              key={row.axis}
              className={`grid grid-cols-[1fr_1fr_1fr] text-sm ${i % 2 ? "bg-background/40" : "bg-card"}`}
            >
              <div className="px-4 py-3 font-semibold text-foreground">{row.axis}</div>
              <div className="border-x border-border px-4 py-3 text-muted-foreground">{row.old}</div>
              <div className="px-4 py-3 font-medium text-foreground">{row.pa}</div>
            </div>
          ))}
        </div>
      </section>

      <CTASection
        title="See the difference for yourself"
        description="Open the live map and click any parcel — listed or not — to see what PropertyAtlas can surface."
        primary={{ label: "Open the Map", to: "/" }}
        secondary={{ label: "How it works", to: "/how-it-works" }}
      />
    </MarketingPage>
  );
}
