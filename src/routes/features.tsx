import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection } from "@/components/layout/MarketingPage";
import {
  Map, Activity, Users, Banknote, TrendingUp, Building2, Bookmark, Bell, History,
  Layers, Search, FolderHeart, Crown,
} from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "PropertyAtlas Features" },
      { name: "description", content: "Interactive property map, ownership insights, sales history, investor scores, watchlists, alerts, historical imagery, and more." },
      { property: "og:title", content: "PropertyAtlas Platform Features" },
      { property: "og:description", content: "Everything PropertyAtlas brings to the map." },
    ],
  }),
  component: Features,
});

const FEATURES = [
  { icon: Map, title: "Interactive Property Map", desc: "Every parcel is interactive — click to explore." },
  { icon: Activity, title: "Property Intelligence", desc: "Estimated value, scores, AI summary, and key signals." },
  { icon: Users, title: "Ownership Insights", desc: "Profile owner type (individual, trust, company) and tenure." },
  { icon: Banknote, title: "Sales History", desc: "Last sale, price-per-m², and area-level transaction patterns." },
  { icon: TrendingUp, title: "Investor Scores", desc: "Composite signals for liquidity, appreciation, and yield." },
  { icon: Building2, title: "Development Analysis", desc: "Zoning, coverage, bulk, and indicative GDV per parcel." },
  { icon: Bookmark, title: "Watchlists", desc: "Save properties and revisit them from your dashboard." },
  { icon: Bell, title: "Property Alerts", desc: "Get notified when something material changes." },
  { icon: History, title: "Historical Imagery", desc: "Compare aerials and street views across years (premium)." },
  { icon: Layers, title: "Map Layers", desc: "Switch between satellite, street, and analytical layers." },
  { icon: Search, title: "Smart Search", desc: "Find by address, erf number, or area with smart suggestions." },
  { icon: FolderHeart, title: "Saved Properties", desc: "Build comparison sets and revisit research at any time." },
  { icon: Crown, title: "Premium Research Tools", desc: "Ownership timelines, comparable sales, transfer history." },
];

function Features() {
  return (
    <MarketingPage
      eyebrow="Features"
      title="Everything you need to research property."
      subtitle="One map. One panel. Every signal that matters."
      heroCta={{ label: "Try the Map", to: "/" }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} icon={<f.icon className="h-5 w-5" />} title={f.title}>{f.desc}</Card>
        ))}
      </div>
      <CTASection
        title="Start with the live map"
        description="Open St Francis Bay and click any parcel to see features in action."
        primary={{ label: "Open the Map", to: "/" }}
        secondary={{ label: "See pricing", to: "/pricing" }}
      />
    </MarketingPage>
  );
}
