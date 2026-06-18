import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection } from "@/components/layout/MarketingPage";
import {
  Map, FileText, Layers, Link2, Bookmark, Calculator, NotebookPen, ShieldCheck, Landmark,
} from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "PropertyAtlas Features" },
      { name: "description", content: "CSG parcel map, erf research, Kouga public GIS context, research links, listing workspace, notes, calculators, and a future report marketplace." },
      { property: "og:title", content: "PropertyAtlas Features" },
      { property: "og:description", content: "Public-data property research for South Africa — what PropertyAtlas does today." },
    ],
  }),
  component: Features,
});

const FEATURES = [
  { icon: Map, title: "Official Parcel Map", desc: "Click CSG parcels and view public cadastral details." },
  { icon: FileText, title: "Erf Research Panel", desc: "See erf number, LPI, parcel key, area, region, and coordinates." },
  { icon: Landmark, title: "Kouga Public GIS Context", desc: "View Kouga public mapping records, municipal context, and zoning where available." },
  { icon: Link2, title: "Research Links", desc: "Open official and municipal sources from one place." },
  { icon: Bookmark, title: "Listing Workspace", desc: "Save listing URLs, asking prices, agents, and notes — manually, from any portal." },
  { icon: Layers, title: "Report Marketplace", desc: "Prepare to order Lightstone, WinDeed, and SG document reports once those connections are live." },
  { icon: NotebookPen, title: "Notes and Due Diligence", desc: "Track questions, checks, risks, and property notes." },
  { icon: Calculator, title: "Calculators", desc: "Run yield, holding cost, flip, and development scenarios using your own numbers." },
  { icon: ShieldCheck, title: "Public Data First", desc: "No fake ownership, no fake valuations, no fake sales history. Every record is labelled by source." },
];

function Features() {
  return (
    <MarketingPage
      eyebrow="Features"
      title="Public-data property research, done properly."
      subtitle="One map. One panel. Real public sources — honestly labelled."
      heroCta={{ label: "Try the Map", to: "/" }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} icon={<f.icon className="h-5 w-5" />} title={f.title}>{f.desc}</Card>
        ))}
      </div>
      <CTASection
        title="Start with the live map"
        description="Open the Kouga pilot and click any parcel to see public-data research in action."
        primary={{ label: "Open the Map", to: "/" }}
        secondary={{ label: "See pricing", to: "/pricing" }}
      />
    </MarketingPage>
  );
}
