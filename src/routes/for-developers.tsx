import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection, SectionHeading } from "@/components/layout/MarketingPage";
import { Layers, Ruler, Map, Building2, FileStack, Compass } from "lucide-react";

export const Route = createFileRoute("/for-developers")({
  head: () => ({
    meta: [
      { title: "ErfStop for Developers" },
      { name: "description", content: "Land analysis, development opportunities, parcel exploration, location intelligence, and zoning insights — built for property developers." },
      { property: "og:title", content: "ErfStop for Developers" },
      { property: "og:description", content: "From parcel to feasibility — research land the modern way." },
    ],
  }),
  component: ForDevelopers,
});

function ForDevelopers() {
  return (
    <MarketingPage
      eyebrow="For Developers"
      title="From parcel to feasibility — on one map."
      subtitle="Land analysis, location intelligence, and zoning context where you do your research."
      intro="ErfStop helps developers move faster from idea to opportunity — by surfacing the spatial, ownership, and regulatory signals you actually need at each parcel."
      heroCta={{ label: "Explore Parcels", to: "/" }}
    >
      <section>
        <SectionHeading title="What developers do on ErfStop" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card icon={<Ruler className="h-5 w-5" />} title="Land analysis">
            Size, geometry, frontage, and corner status for every parcel — clearly visible at a glance.
          </Card>
          <Card icon={<Layers className="h-5 w-5" />} title="Development opportunities">
            Filter for large erven, vacant land, long-held ownership, and high development scores.
          </Card>
          <Card icon={<Map className="h-5 w-5" />} title="Parcel exploration">
            Click any erf for its full intelligence profile — no listings layer required.
          </Card>
          <Card icon={<Compass className="h-5 w-5" />} title="Location intelligence">
            Beachfront, ocean view, walkability, and proximity signals captured on every property.
          </Card>
          <Card icon={<Building2 className="h-5 w-5" />} title="Zoning intelligence">
            Indicative zoning, coverage, and bulk — to frame feasibility before you commission a formal study.
          </Card>
          <Card icon={<FileStack className="h-5 w-5" />} title="Comparable evidence" accent>
            Sales history, transfer prices, and ownership timelines support your assumptions with public-record style data.
          </Card>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-accent/30 bg-accent/5 p-6 text-sm leading-relaxed text-foreground">
        ErfStop is a research and information platform. Zoning, bulk, coverage, and indicative GDV figures are informational
        only and must be confirmed with the relevant municipality and a qualified town planner before any development decision.
      </section>

      <CTASection
        title="Find your next site"
        description="Open the map and filter for development-grade parcels in the St Francis Bay pilot region."
        primary={{ label: "Open the Map", to: "/" }}
        secondary={{ label: "Partner with us", to: "/partnerships" }}
      />
    </MarketingPage>
  );
}
