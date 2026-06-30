import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, SectionHeading, Prose, CTASection } from "@/components/layout/MarketingPage";
import { Target, Compass, Map, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About ErfStoep — Public-Data Property Research" },
      { name: "description", content: "ErfStoep is a public-data property research workspace for South African real estate. Pilot: St Francis Bay and Kouga Municipality." },
      { property: "og:title", content: "About ErfStoep" },
      { property: "og:description", content: "Public-data property research workspace. Not a valuer, agency, or deeds provider." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <MarketingPage
      eyebrow="About"
      title="Public-data property research, organised."
      subtitle="A workspace for South African property research — built on public sources."
      intro="ErfStoep helps users organise public parcel data, municipal context, listing research, notes, calculators, and third-party report requests in one place. It is not a valuer, estate agency, deeds provider, law firm, or financial adviser."
      heroCta={{ label: "Open the Map", to: "/" }}
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <Card icon={<Target className="h-5 w-5" />} title="Our Mission" accent>
          Make property research easier, clearer, and more organised — using public data, honestly labelled by source.
        </Card>
        <Card icon={<Compass className="h-5 w-5" />} title="Pilot" accent>
          St Francis Bay and Kouga Municipality. Expanding region by region as official public layers come online.
        </Card>
      </section>

      <section className="mt-12">
        <SectionHeading
          eyebrow="What we do"
          title="A workspace, not a listings site"
          subtitle="ErfStoep focuses on organising research around a parcel — CSG cadastral, municipal context, your notes, listing URLs you've found, and the reports you plan to order."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card icon={<Map className="h-5 w-5" />} title="Map-first">
            Click any erf to open a research panel — public parcel details, municipal context where available, and links to official sources.
          </Card>
          <Card icon={<ShieldCheck className="h-5 w-5" />} title="Source-labelled">
            Every record is marked with its source. We do not invent ownership, valuations, sales history, or investor scores.
          </Card>
          <Card icon={<Compass className="h-5 w-5" />} title="Report-ready">
            When you need verified data, register interest for a Lightstone, WinDeed, or SG report and we'll wire the connection.
          </Card>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-border bg-card p-8 shadow-soft">
        <SectionHeading eyebrow="Honesty" title="What ErfStoep does not do (yet)" />
        <Prose>
          <p>
            ErfStoep does not currently provide verified ownership history, transfer history, bonds, AVM valuations,
            comparable sales, seller probability, investor scores based on real data, live active-listing detection, or
            confirmed listing availability from Property24 or other portals. These will become available only through
            third-party reports once the relevant integrations go live.
          </p>
        </Prose>
      </section>

      <CTASection
        title="See ErfStoep in action"
        description="Open the live map and click any parcel to see what public data looks like, honestly labelled."
        primary={{ label: "Open the Map", to: "/" }}
        secondary={{ label: "How it works", to: "/how-it-works" }}
      />
    </MarketingPage>
  );
}
