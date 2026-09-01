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
  UserCheck,
  ReceiptText,
  CheckCircle2,
} from "lucide-react";
import {
  DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY,
  DONE_FOR_YOU_STANDARD_INVESTIGATION_ITEMS,
} from "@/lib/humanReview/scope";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Easy Erf Works" },
      {
        name: "description",
        content:
          "Find a South African erf, confirm the exact parcel, investigate it yourself or choose the R999 Done-for-You Property Investigation, and build an evidence-backed Easy Erf Report.",
      },
      { property: "og:title", content: "How Easy Erf Works" },
      {
        property: "og:description",
        content:
          "One property file with two paths: guided self-service investigation or a R999 done-for-you Easy Erf investigation.",
      },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [
  {
    icon: Search,
    title: "Find and confirm the exact property",
    text: "Search by address or erf details, review the result on the map, and open the exact official parcel. Erf numbers repeat across South Africa, so every investigation and all later evidence stay bound to one canonical parcel identity.",
  },
  {
    icon: ClipboardCheck,
    title: "Start with Property Overview",
    text: "Easy Erf opens with a read-only first look at the parcel and intelligence already available. Nothing is marked complete just because you opened the property.",
  },
  {
    icon: FileSearch2,
    title: "Build or review the evidence",
    text: "Guided Investigation works through address, SG and cadastral material, title or paid reports, planning position, property checks and other evidence. Verified facts, working conclusions, assumptions and missing information remain distinct.",
  },
  {
    icon: Calculator,
    title: "Run the numbers",
    text: "Market Evidence and Strategy use deterministic calculators with visible inputs and assumptions for acquisition costs, development feasibility, maximum offer, resale, rental and sensitivity scenarios.",
  },
  {
    icon: Building2,
    title: "Explore Site Potential",
    text: "Site Potential converts the best available parcel geometry, planning controls and explicit assumptions into a deterministic build envelope and street-side build-line view. It is not a generated house design or an approved plan.",
  },
  {
    icon: FileText,
    title: "Keep one living Easy Erf Report",
    text: "The same report improves as the investigation improves. It brings together property identity, evidence, planning, risks, Market Evidence, Strategy and Site Potential, then shows what still needs verification.",
  },
];

const DONE_FOR_YOU_STEPS = [
  ["1", "Confirm the property", "The R999 service cannot begin from a typed Erf number alone. Confirm the exact parcel on the Easy Erf map first."],
  ["2", "Tell us what matters most", "Choose Overall Property Check, Property Potential, or Check My Intended Use. This directs the review emphasis; the standard investigation is still worked through."],
  ["3", "Pay R999 once-off", "Stripe handles payment only. Your confirmed property and brief stay inside Easy Erf and remain attached to your account."],
  ["4", "Easy Erf does the investigation", "We reuse work already completed, work through the standard Easy Erf investigation, review one third-party property data report during Early Access where available, and keep missing evidence explicit."],
  ["5", "A human reviewer checks the file", "The reviewer checks the evidence, contradictions, assumptions and selected emphasis before the report is delivered."],
  ["6", "Read the Human-Reviewed report", "Your report appears in My Reports with the bottom line, evidence-backed findings, risks, unknowns and next checks. PDF is a secondary export."],
] as const;

const HUMAN_REVIEW_OUTPUT = [
  "What do we know?",
  "What appears possible?",
  "What could be a problem?",
  "What do we not know yet?",
  "What should be verified next?",
] as const;

function HowItWorks() {
  return (
    <MarketingPage
      eyebrow="How it works"
      title="One property. One property file. Two ways to investigate."
      subtitle="Investigate it yourself, or choose the R999 Done-for-You Property Investigation and let Easy Erf work through it for you."
      intro="Easy Erf starts with the exact parcel, not a loose Erf number. From there you can work through the investigation yourself or pay once for Easy Erf and a human reviewer to do the standard investigation on your behalf. Both paths use the same property file, evidence, assumptions and report instead of creating disconnected work."
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

      <section className="mt-14">
        <SectionHeading
          eyebrow="Choose your path"
          title="Do the investigation yourself or let Easy Erf do it for you"
          subtitle="Both paths use the same confirmed parcel and canonical Easy Erf property file. The difference is who does the work."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Card icon={<ClipboardCheck className="h-5 w-5" />} title="Investigate it yourself">
            Use Guided Investigation, evidence uploads, Market Evidence, Strategy, Site Potential and Ask Easy Erf. You control the pace and can switch to the done-for-you service later without losing the property file you already built.
          </Card>
          <Card icon={<UserCheck className="h-5 w-5" />} title="Done-for-You Property Investigation · R999" accent>
            You choose the exact property and tell us what matters most. Easy Erf and a human reviewer work through the standard investigation, reuse anything already completed, add the included Early Access property data report where available, and deliver the reviewed report to your account. No subscription.
          </Card>
        </div>
      </section>

      <section className="mt-14 overflow-hidden rounded-[2rem] border border-[#FF6A00]/25 bg-gradient-to-br from-[#fff8ec] via-white to-[#F7FBFF] p-6 shadow-soft sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
              <ReceiptText className="h-4 w-4" /> R999 Done-for-You Investigation
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
              What happens after you hand the property to Easy Erf
            </h2>
            <div className="mt-5 space-y-3">
              {DONE_FOR_YOU_STEPS.map(([number, title, body]) => (
                <div key={number} className="flex gap-3 rounded-2xl border border-[#0D1B2A]/8 bg-white/80 p-4">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0D1B2A] text-xs font-bold text-white">
                    {number}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#0D1B2A]">{title}</div>
                    <p className="mt-1 text-xs leading-5 text-[#64748B]">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] bg-[#0D1B2A] p-5 text-white sm:p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
              Standard investigation we work through
            </div>
            <div className="mt-4 space-y-3">
              {DONE_FOR_YOU_STANDARD_INVESTIGATION_ITEMS.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm leading-6 text-white/85">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#FF8A33]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-xs leading-5 text-white/65">
              {DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading
          eyebrow="The final report"
          title="The human-reviewed output still answers five simple questions"
          subtitle="The investigation can be broad underneath while the final answer stays easy to understand."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {HUMAN_REVIEW_OUTPUT.map((item) => (
            <div key={item} className="rounded-2xl border border-border bg-card p-4 text-sm font-semibold text-foreground shadow-soft">
              <CheckCircle2 className="mb-2 h-4 w-4 text-accent" />
              {item}
            </div>
          ))}
        </div>
      </section>

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
            Where supported, Easy Erf reviews the canonical property state and available sources before asking the user to repeat work. Missing evidence stays explicit.
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
        title="You choose the property. We do the investigation."
        description="Find the exact property on the map first. Then investigate it yourself or hand the confirmed parcel to Easy Erf for the R999 done-for-you path."
        primary={{ label: "Find a Property", to: "/" }}
        secondary={{ label: "See Done-for-You · R999", to: "/pricing" }}
      />
    </MarketingPage>
  );
}
