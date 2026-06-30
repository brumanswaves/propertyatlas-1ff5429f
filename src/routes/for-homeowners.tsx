import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection } from "@/components/layout/MarketingPage";
import { Home, Compass, LineChart, Users, MapPin } from "lucide-react";

export const Route = createFileRoute("/for-homeowners")({
  head: () => ({
    meta: [
      { title: "ErfStop for Homeowners" },
      { name: "description", content: "Research your property, understand your neighbourhood, track value over time, and stay informed about your local market." },
      { property: "og:title", content: "ErfStop for Homeowners" },
      { property: "og:description", content: "Understand your home and your neighbourhood — clearly and honestly." },
    ],
  }),
  component: ForHomeowners,
});

function ForHomeowners() {
  return (
    <MarketingPage
      eyebrow="For Homeowners"
      title="Know your property. Know your neighbourhood."
      subtitle="Property research that actually helps you understand your home."
      intro="ErfStop gives homeowners a clear, map-based view of their own property and the area around it — so you can stay informed without sifting through listings."
      heroCta={{ label: "Find Your Property", to: "/" }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card icon={<Home className="h-5 w-5" />} title="Property research">
          Pull up your erf, see its size, zoning, last sale, estimated value, and how long it has been held.
        </Card>
        <Card icon={<Compass className="h-5 w-5" />} title="Neighbourhood insights">
          Understand the suburb around you — ownership patterns, turnover, beachfront proximity, and walkability.
        </Card>
        <Card icon={<LineChart className="h-5 w-5" />} title="Valuation tracking">
          Monitor the modelled value of your property over time, with clear disclosures that this is an informational estimate — not a certified valuation.
        </Card>
        <Card icon={<Users className="h-5 w-5" />} title="Ownership information">
          Understand the ownership profile of properties around you — individual, trust, or company — using public-record style intelligence.
        </Card>
        <Card icon={<MapPin className="h-5 w-5" />} title="Market awareness">
          Know when comparable properties transact nearby and how your micro-pocket is trending.
        </Card>
        <Card icon={<Home className="h-5 w-5" />} title="Built for you, not the agent" accent>
          We do not sell your data to brokers. ErfStop is research-first — you stay in control.
        </Card>
      </div>

      <CTASection
        title="Start with your own property"
        description="Open the map, search your address, and see what ErfStop knows about your home."
        primary={{ label: "Search the Map", to: "/" }}
        secondary={{ label: "Why ErfStop", to: "/why" }}
      />
    </MarketingPage>
  );
}
