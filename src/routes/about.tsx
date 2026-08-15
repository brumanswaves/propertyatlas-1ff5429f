import { createFileRoute } from "@tanstack/react-router";
import {
  MarketingPage,
  Card,
  SectionHeading,
  Prose,
  CTASection,
} from "@/components/layout/MarketingPage";
import { Target, Compass, FileSearch2, ShieldCheck, Calculator, Building2 } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Easy Erf" },
      {
        name: "description",
        content:
          "Easy Erf is a South African property investigation platform that connects parcel identity, evidence, planning, calculations, Site Potential and a living report.",
      },
      { property: "og:title", content: "About Easy Erf" },
      {
        property: "og:description",
        content: "A simple property investigation experience with serious evidence and decision intelligence underneath.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <MarketingPage
      eyebrow="About"
      title="Property due diligence should be easier to understand."
      subtitle="Easy Erf turns a scattered property investigation into one guided, evidence-backed property file."
      intro="South African property research often means jumping between maps, municipal documents, SG material, provider reports, listing portals, spreadsheets and professional advice. Easy Erf brings the useful parts together around the erf, while keeping the source and confidence of each conclusion visible."
      heroCta={{ label: "Find a Property", to: "/" }}
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <Card icon={<Target className="h-5 w-5" />} title="Our mission" accent>
          Make serious property investigation understandable enough for a normal buyer while keeping the evidence, assumptions and calculations credible enough for investors and developers.
        </Card>
        <Card icon={<Compass className="h-5 w-5" />} title="Our MVP focus" accent>
          Make one real end-to-end investigation work extremely well first. Erf 1570 and the Kouga/St Francis pilot remain the canonical proving ground for the deepest workflow.
        </Card>
      </section>

      <section className="mt-12">
        <SectionHeading
          eyebrow="What Easy Erf is"
          title="An investigation platform, not a pile of property tools"
          subtitle="The map, evidence, calculators, Site Potential and report are capabilities inside one property journey."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={<FileSearch2 className="h-5 w-5" />} title="Evidence-led">
            SG material, planning sources, uploaded documents, provider reports and user confirmations retain their identity and provenance.
          </Card>
          <Card icon={<ShieldCheck className="h-5 w-5" />} title="Honest confidence">
            Verified facts, working conclusions, assumptions, conflicts and missing evidence remain visibly different.
          </Card>
          <Card icon={<Calculator className="h-5 w-5" />} title="Decision-focused">
            Strategy uses deterministic maths first, with AI explanation and scenario guidance layered on top rather than replacing the calculations.
          </Card>
          <Card icon={<Building2 className="h-5 w-5" />} title="Potential, not approval">
            Site Potential helps users understand what a property could become while preserving the planning assumptions and approval boundary beneath every concept.
          </Card>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-border bg-card p-8 shadow-soft">
        <SectionHeading eyebrow="Trust" title="What Easy Erf is not" />
        <Prose>
          <p>
            Easy Erf is not a municipality, deeds office, land surveyor, town planner, architect, valuer, attorney, lender or investment adviser. It does not turn an AI interpretation into official evidence or turn a generated concept into an approved building plan.
          </p>
          <p>
            The product should make it easier to see what is already supported, what still needs professional or official confirmation, and what the most useful next action is.
          </p>
        </Prose>
      </section>

      <CTASection
        title="Investigate a real property"
        description="Start with Property Overview, then use Guided Investigation when you want Easy Erf to build the property file with you."
        primary={{ label: "Find a Property", to: "/" }}
        secondary={{ label: "How it works", to: "/how-it-works" }}
      />
    </MarketingPage>
  );
}
