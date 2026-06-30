import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MarketingPage } from "@/components/layout/MarketingPage";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "ErfStop FAQ" },
      { name: "description", content: "Answers to common questions about ErfStop — accuracy, coverage, scores, plans, exports, and ownership records." },
      { property: "og:title", content: "ErfStop FAQ" },
      { property: "og:description", content: "Common questions about the platform, scores, and data." },
    ],
  }),
  component: FAQ,
});

const QA: Array<{ q: string; a: string }> = [
  {
    q: "What is ErfStop?",
    a: "ErfStop is a property intelligence platform. It combines maps, valuation insights, ownership data, sales history, and proprietary scoring into one research tool. It is not a listings website, brokerage, or valuation service.",
  },
  {
    q: "How accurate are the estimates?",
    a: "All valuation figures shown are modelled, informational estimates and are not certified valuations or appraisals. Confidence indicators are provided where possible. For any formal decision, always commission a professional valuation.",
  },
  {
    q: "What areas are covered?",
    a: "ErfStop is currently live as a pilot in the St Francis Bay region. We are expanding gradually — first across the Eastern Cape, then nationally.",
  },
  {
    q: "How often is data updated?",
    a: "Data refresh cadence depends on the source. Some signals update continuously, others on a scheduled basis. Sales and ownership records reflect the most recent data we have available.",
  },
  {
    q: "What is the Investor Plan?",
    a: "The Investor Plan unlocks deeper research features — ownership timelines, comparable sales, transfer history, development feasibility, and historical imagery. See the Pricing page for current options.",
  },
  {
    q: "Can I export reports?",
    a: "Yes — property panels can be exported as PDF reports for your own records. Premium plans include enhanced exports and additional research modules.",
  },
  {
    q: "How do property scores work?",
    a: "Scores are proprietary informational indicators composed from spatial, historical, and ownership signals. They are not recommendations, guarantees, or forecasts and should be interpreted alongside professional advice.",
  },
  {
    q: "Can I trust the ownership records?",
    a: "Ownership data is presented for research purposes only. While we work with public-record style sources, accuracy and timeliness vary. Confirm any material detail with the relevant authority before acting on it.",
  },
  {
    q: "What data sources are used?",
    a: "ErfStop may incorporate public records, licensed datasets, municipal data, geospatial layers, mapping providers, user submissions, and automated analysis. See the Data Sources page for more.",
  },
  {
    q: "Is ErfStop a valuation service?",
    a: "No. ErfStop is a research and information platform. All value indications are estimates only and are not certified valuations. We are not a brokerage, valuer, advisor, or law firm.",
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
