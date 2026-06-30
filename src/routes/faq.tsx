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
      { name: "description", content: `Answers to common questions about ${BRAND.site} - accuracy, coverage, reports, exports, and source limits.` },
      { property: "og:title", content: `${BRAND.site} FAQ` },
      { property: "og:description", content: "Common questions about the platform, public sources, reports, and data limits." },
    ],
  }),
  component: FAQ,
});

const QA: Array<{ q: string; a: string }> = [
  {
    q: `What is ${BRAND.site}?`,
    a: `${BRAND.site} is a map-first erf research command center. It helps users organize public-source links, notes, assumptions, saved evidence, due diligence steps, and optional third-party report requests. It is not a listings website, brokerage, valuation service, law firm, or financial adviser.`,
  },
  {
    q: "How accurate are the estimates?",
    a: "Calculator outputs and user-entered assumptions are estimates only. Verified valuations are not attached unless a real provider report or verified source is added. For any formal decision, commission a professional valuation.",
  },
  {
    q: "What areas are covered?",
    a: `${BRAND.site} is currently live as a pilot in the St Francis Bay region. We are expanding gradually - first across the Eastern Cape, then nationally.`,
  },
  {
    q: "How often is data updated?",
    a: "Data refresh cadence depends on the source. Public map layers, user notes, saved evidence, and third-party report availability can update on different schedules. Always verify material facts with the official source.",
  },
  {
    q: "What is the Investor Plan?",
    a: "Paid reports and future plans may improve confidence with provider-backed data, but the free/manual workflow remains useful for public-source research, notes, calculators, and due diligence organization.",
  },
  {
    q: "Can I export reports?",
    a: `Yes - saved dossiers are intended to become ${BRAND.reports} for your own records, with public-source links, notes, assumptions, charts, and clear source limitations.`,
  },
  {
    q: "How do property scores work?",
    a: "Guided workflow indicators are informational prompts only. They are not recommendations, guarantees, forecasts, or professional advice.",
  },
  {
    q: "Can I trust the ownership records?",
    a: `${BRAND.site} does not attach verified ownership data unless a verified source or paid provider report is added. Use the dossier to track what still needs to be checked with the relevant authority or provider.`,
  },
  {
    q: "What data sources are used?",
    a: `${BRAND.site} may incorporate public records, municipal data, geospatial layers, mapping providers, user submissions, optional paid reports, and automated analysis. See the Data Sources page for more.`,
  },
  {
    q: `Is ${BRAND.site} a valuation service?`,
    a: `No. ${BRAND.site} is a research and information platform. It is not legal, financial, valuation, surveying, municipal, tax, or investment advice.`,
  },
];

function FAQ() {
  return (
    <MarketingPage
      eyebrow="FAQ"
      title="Frequently Asked Questions"
      subtitle="Straight answers about the platform, the data, and the disclaimers."
    >
      <div className="space-y-3">
        {QA.map((item, i) => (
          <Item key={i} q={item.q} a={item.a} defaultOpen={i === 0} />
        ))}
      </div>
    </MarketingPage>
  );
}

function Item({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-foreground sm:text-base">{q}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border bg-background/40 px-5 py-4 text-[13.5px] leading-relaxed text-muted-foreground">
          {a}
        </div>
      )}
    </div>
  );
}
