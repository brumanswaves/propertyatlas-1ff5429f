import { createFileRoute } from "@tanstack/react-router";
import {
  MarketingPage,
  NumberedStep,
  SectionHeading,
  Card,
  CTASection,
} from "@/components/layout/MarketingPage";
import {
  Search,
  ClipboardCheck,
  FileSearch2,
  Calculator,
  Building2,
  FileText,
  MessageCircleQuestion,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Easy Erf Works" },
      {
        name: "description",
        content:
          "Find a South African erf, review what is known, investigate the evidence, run the numbers, explore Site Potential, and build a living Easy Erf Report.",
      },
      { property: "og:title", content: "How Easy Erf Works" },
      {
        property: "og:description",
        content: "One guided property investigation from parcel identity to evidence, strategy, Site Potential and report.",
      },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [
  {
    icon: Search,
    title: "Find the property",
    text: "Search by address or erf details, or select an official parcel on the map. Easy Erf binds the investigation to one canonical property identity so later evidence and calculations stay attached to the right erf.",
  },
  {
    icon: ClipboardCheck,
    title: "Start with Property Overview",
    text: "Easy Erf opens with a read-only first look at the parcel and intelligence already available. Nothing is marked complete just because you opened the property. Start Guided Investigation when you are ready to work through it.",
  },
  {
    icon: FileSearch2,
    title: "Build the evidence",
    text: "Guided Investigation works through the address, SG and cadastral material, title or paid reports, planning position, property checks and other evidence. Verified facts, working conclusions, assumptions and missing information remain distinct.",
  },
  {
    icon: Calculator,
    title: "Run the deal",
    text: "Market Evidence and Strategy turn the property file into decisions. Deterministic calculators use visible inputs and assumptions for acquisition costs, development feasibility, maximum offer, resale, rental and sensitivity scenarios.",
  },
  {
    icon: Building2,
    title: "Explore Site Potential",
    text: "Site Potential converts the best available parcel geometry, planning controls and explicit assumptions into understandable development concepts. Concepts inherit the confidence of the evidence beneath them and are never presented as approved plans.",
  },
  {
    icon: FileText,
    title: "Use the living Easy Erf Report",
    text: "The report improves as the investigation improves. It brings together identity, planning, evidence, risks, Market Evidence, Strategy and accepted Site Potential work, then shows the next useful action instead of becoming a dead-end PDF.",
  },
];

function HowItWorks() {
  return (
    <MarketingPage
      eyebrow="How it works"
      title="One property. One investigation. One clear next step."
      subtitle="Easy Erf turns a parcel into an evidence-backed property file you can actually use."
      intro="The normal experience is deliberately simple. Find the erf, see what Easy Erf already knows, investigate what matters, run the numbers, and keep improving the same living report. Serious evidence and calculations sit underneath without turning the product into a wall of GIS tools."
      heroCta={{ label: "Find a Property", to: "/" }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <NumberedStep key={step.title} step={index + 1} title={step.title}>
              <span className="inline-flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {step.text}
              </span>
            </NumberedStep>
          );
        })}
      </div>

      <section className="mt-12">
        <SectionHeading
          eyebrow="What makes it different"
          title="Easy Erf shows what is known and what is still missing"
          subtitle="Confidence and provenance are part of the product, not a disclaimer added after the answer."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Card icon={<ShieldCheck className="h-5 w-5" />} title="Evidence stays traceable" accent>
            Important facts retain their source and property binding. A municipal source, uploaded document, user confirmation and AI interpretation are not treated as the same kind of proof.
          </Card>
          <Card icon={<FileSearch2 className="h-5 w-5" />} title="Easy Erf investigates first">
            Where supported, autonomous investigation jobs review the canonical property state and available sources before asking the user to repeat work. Planning Investigation is the first real job in that direction.
          </Card>
          <Card icon={<MessageCircleQuestion className="h-5 w-5" />} title="Ask Easy Erf stays grounded">
            Ask Easy Erf works over the property file and evidence pack. It should explain uncertainty, use calculator outputs, and point to the Next Best Step rather than act like a generic chatbot.
          </Card>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-border bg-card p-8 shadow-soft">
        <SectionHeading
          eyebrow="Coverage"
          title="Deep coverage grows municipality by municipality"
          subtitle="Kouga and the St Francis area remain the primary MVP pilot for the deepest end-to-end planning work."
        />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Easy Erf can be useful before every source is automated, but source availability varies across South Africa. When a property-specific zoning record, title condition, SG document or provider report is not available, Easy Erf should show that gap instead of filling it with a demo value or unsupported certainty.
        </p>
      </section>

      <CTASection
        title="Start with a real property"
        description="Find an erf and open Property Overview. Start Guided Investigation only when you are ready to build the property file."
        primary={{ label: "Find a Property", to: "/" }}
        secondary={{ label: "See pricing", to: "/pricing" }}
      />
    </MarketingPage>
  );
}
