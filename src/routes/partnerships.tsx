import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection } from "@/components/layout/MarketingPage";
import { Database, Building, Map, Users, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/partnerships")({
  head: () => ({
    meta: [
      { title: "Easy Erf Partnerships" },
      {
        name: "description",
        content:
          "Easy Erf may collaborate with municipalities, data providers, mapping providers and property professionals where the partnership improves trustworthy property evidence or fulfilment.",
      },
    ],
  }),
  component: Partnerships,
});

const TYPES = [
  {
    icon: Database,
    title: "Data providers",
    desc: "Reliable property, deeds, valuation, market or geospatial evidence that can be licensed and preserved with clear provenance.",
  },
  {
    icon: Building,
    title: "Municipalities",
    desc: "Official planning, zoning and public-record access that can improve property-specific investigation without overstating certainty.",
  },
  {
    icon: Map,
    title: "Mapping and geospatial providers",
    desc: "Parcel geometry, imagery, terrain and environmental context that can strengthen the canonical property file.",
  },
  {
    icon: Users,
    title: "Property professionals",
    desc: "Town planners, surveyors, architects, attorneys and other professionals who may later support evidence review or fulfilment workflows.",
  },
  {
    icon: ShieldCheck,
    title: "Trust-first integrations",
    desc: "Easy Erf should integrate a partner only when the source, rights, customer value and operational responsibility are clear.",
  },
];

function Partnerships() {
  return (
    <MarketingPage
      eyebrow="Partnerships"
      title="Better property evidence requires the right partners."
      subtitle="Easy Erf is interested in partnerships that improve source quality, coverage or professional fulfilment."
      intro="Partnerships are supporting infrastructure, not a separate marketplace today. The current product remains focused on making the property investigation work extremely well before adding broad partner directories or referral flows."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TYPES.map((type) => (
          <Card key={type.title} icon={<type.icon className="h-5 w-5" />} title={type.title}>
            {type.desc}
          </Card>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-amber-300/50 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950">
        <strong>Partnership inquiry delivery is not yet connected.</strong> The previous form only changed browser state and did not send the inquiry. It has been removed until a real intake and follow-up workflow exists.
      </div>

      <CTASection
        title="See what Easy Erf is building now"
        description="The current customer product is best understood through the canonical investigation journey."
        primary={{ label: "How It Works", to: "/how-it-works" }}
        secondary={{ label: "View Roadmap", to: "/roadmap" }}
      />
    </MarketingPage>
  );
}
