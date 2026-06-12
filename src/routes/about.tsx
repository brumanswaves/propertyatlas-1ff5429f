import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, SectionHeading, Prose, CTASection } from "@/components/layout/MarketingPage";
import { Target, Compass, Map, Sparkles, ShieldCheck, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About PropertyAtlas — Every Property. Every Story." },
      { name: "description", content: "PropertyAtlas is a property intelligence platform helping South Africans understand real estate through maps, valuations, ownership data, and research tools." },
      { property: "og:title", content: "About PropertyAtlas" },
      { property: "og:description", content: "Map-based property intelligence for South Africa." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <MarketingPage
      eyebrow="About"
      title="Every Property. Every Story."
      subtitle="PropertyAtlas is a property intelligence platform — not another listings website."
      intro="We help homeowners, buyers, investors, developers, and property professionals better understand real estate. The platform combines mapping technology, valuation insights, ownership intelligence, property history, geospatial analysis, and research tools to support more informed decisions."
      heroCta={{ label: "Explore the Map", to: "/" }}
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <Card icon={<Target className="h-5 w-5" />} title="Our Mission" accent>
          To make property information more accessible, understandable, and useful — for everyone with a stake in real estate.
        </Card>
        <Card icon={<Compass className="h-5 w-5" />} title="Our Vision" accent>
          To become South Africa's leading property intelligence platform — built around maps, data, and rigorous research.
        </Card>
      </section>

      <section className="mt-12">
        <SectionHeading
          eyebrow="What we do"
          title="Property intelligence, not listings"
          subtitle="Traditional property websites focus on selling listings. PropertyAtlas focuses on understanding the property itself — every parcel, every signal, every story."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card icon={<Map className="h-5 w-5" />} title="Map-first research">
            Every parcel, plotted. Click any erf to open a full intelligence panel — valuation, sales, ownership, zoning, scores.
          </Card>
          <Card icon={<TrendingUp className="h-5 w-5" />} title="Investor signals">
            Modelled scores for seller probability, investor potential, and development feasibility — surfaced where you need them.
          </Card>
          <Card icon={<ShieldCheck className="h-5 w-5" />} title="Transparent disclosures">
            Every estimate is flagged as informational. We are a research platform, not a valuer, broker, or advisor.
          </Card>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-border bg-card p-8 shadow-soft">
        <SectionHeading
          eyebrow="Pilot"
          title="Starting with St Francis Bay"
        />
        <Prose>
          <p>
            PropertyAtlas was initially launched as a pilot focused on the <strong>St Francis Bay region</strong>, a high-signal
            coastal market that lets us refine the platform with real users — homeowners, investors, developers, and property
            professionals — before expanding nationally.
          </p>
          <p>
            Our long-term vision is to extend this intelligence layer across South Africa, region by region, with the same
            commitment to clarity, accuracy, and usefulness.
          </p>
        </Prose>
      </section>

      <CTASection
        title="See PropertyAtlas in action"
        description="Open the live map, click any parcel, and explore the property intelligence behind it."
        primary={{ label: "Open the Map", to: "/" }}
        secondary={{ label: "How it works", to: "/how-it-works" }}
      />
    </MarketingPage>
  );
}
