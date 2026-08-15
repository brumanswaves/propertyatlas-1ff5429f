import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MarketingPage } from "@/components/layout/MarketingPage";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: `${BRAND.site} FAQ` },
      {
        name: "description",
        content: `Answers to common questions about ${BRAND.site}, Guided Investigation, evidence confidence, Site Potential, reports, pricing and coverage.`,
      },
      { property: "og:title", content: `${BRAND.site} FAQ` },
      {
        property: "og:description",
        content: "Common questions about the Easy Erf property investigation platform and its evidence limits.",
      },
    ],
  }),
  component: FAQ,
});

const QA: Array<{ q: string; a: string }> = [
  {
    q: `What is ${BRAND.site}?`,
    a: `${BRAND.site} is a South African property investigation platform. It helps you identify an erf, build an evidence-backed property file, investigate planning and property questions, add Market Evidence, run Strategy calculations, explore Site Potential where available, and maintain a living ${BRAND.reports}.`,
  },
  {
    q: "What happens when I open a property?",
    a: "Easy Erf first opens Property Overview, a read-only first look at the selected parcel and intelligence already recorded. Opening a property does not automatically mark investigation work complete. Choose Investigate this property when you are ready to enter Guided Investigation.",
  },
  {
    q: "How does Easy Erf decide what is verified?",
    a: "Important conclusions retain their source and evidence type. Official or document-supported facts, user-confirmed working conclusions, assumptions, AI interpretations and missing evidence are kept distinct. Easy Erf should not turn a published general planning rule into a parcel-specific right without supporting evidence.",
  },
  {
    q: "What areas are covered?",
    a: "Coverage varies across South Africa because municipal, cadastral and provider sources vary. Kouga and the St Francis area are the current deepest MVP pilot for end-to-end planning work. Other properties may still be useful to investigate, but Easy Erf should show source gaps honestly when deeper evidence is unavailable.",
  },
  {
    q: "What is Site Potential?",
    a: "Site Potential uses the best available parcel geometry, planning controls and explicit assumptions to explore understandable development concepts. It is not an approved building plan, municipal permission or professional design certification. Concept generation is currently subject to beta availability and account allowances or credits.",
  },
  {
    q: "Does Easy Erf sell subscriptions?",
    a: "No recurring Easy Erf subscription is currently being sold for the MVP. The current commercial direction is simple pay-per-use or pay-per-property pricing only when a real paid capability is available. Future bundles or subscriptions may be considered later if actual customer usage proves they are useful.",
  },
  {
    q: "Can I buy Lightstone or WinDeed reports inside Easy Erf?",
    a: "Not through a live Easy Erf checkout today. Where a third-party report would strengthen the property file, Easy Erf can guide you to obtain it and upload it back to the investigation. Any provider fee is separate unless and until a real Easy Erf payment workflow is connected.",
  },
  {
    q: `What is the ${BRAND.reports}?`,
    a: `The ${BRAND.reports} is the living destination of the investigation. It brings together property identity, evidence, planning, property checks, Market Evidence, Strategy, accepted Site Potential work, risks and unresolved items. It improves as the property file improves.`,
  },
  {
    q: "How reliable are the calculators?",
    a: "Strategy calculations use deterministic maths and visible inputs. The maths can be exact while an input is still an assumption, so Easy Erf keeps the source and confidence of important property inputs visible. AI may explain or compare scenarios, but it should not silently replace the calculation engine.",
  },
  {
    q: `Is ${BRAND.site} professional advice?`,
    a: `No. ${BRAND.site} is an information and investigation platform. It is not municipal approval, legal advice, financial advice, tax advice, a certified valuation, surveying work, architectural approval or a substitute for the appropriate professional when one is required.`,
  },
];

function FAQ() {
  return (
    <MarketingPage
      eyebrow="FAQ"
      title="Frequently Asked Questions"
      subtitle="Straight answers about the investigation, evidence, coverage and what Easy Erf does not pretend to know."
    >
      <div className="space-y-3">
        {QA.map((item, index) => (
          <Item key={item.q} q={item.q} a={item.a} defaultOpen={index === 0} />
        ))}
      </div>
    </MarketingPage>
  );
}

function Item({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <button
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-foreground sm:text-base">{q}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-border bg-background/40 px-5 py-4 text-[13.5px] leading-relaxed text-muted-foreground">
          {a}
        </div>
      )}
    </div>
  );
}
