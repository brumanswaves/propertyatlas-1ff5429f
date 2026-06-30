import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, SectionHeading } from "@/components/layout/MarketingPage";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "ErfStop Roadmap" },
      { name: "description", content: "Current pilot in St Francis Bay, planned expansion across the Eastern Cape, Western Cape, and national coverage, plus future features." },
      { property: "og:title", content: "ErfStop Roadmap" },
      { property: "og:description", content: "Where ErfStop is today and where it's going next." },
    ],
  }),
  component: Roadmap,
});

function Roadmap() {
  return (
    <MarketingPage
      eyebrow="Roadmap"
      title="Where we are. Where we're going."
      subtitle="A high-level view of how ErfStop is expanding."
      intro="We share our direction openly so users, partners, and municipalities can plan around it. Specific timelines and proprietary strategy are intentionally not included."
    >
      <section className="grid gap-6 md:grid-cols-3">
        <Column
          state="now"
          title="Current Pilot"
          items={["St Francis Bay region", "Full parcel coverage", "Investor-grade scoring", "Premium research tools"]}
        />
        <Column
          state="next"
          title="Future Expansion"
          items={["Eastern Cape", "Western Cape", "National Coverage"]}
        />
        <Column
          state="later"
          title="Future Features"
          items={[
            "Ownership History",
            "Historical Imagery",
            "Market Analytics",
            "Portfolio Tracking",
            "Advanced Investor Tools",
          ]}
        />
      </section>

      <section className="mt-12 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm leading-relaxed text-foreground">
        Roadmap items are directional and may change. Nothing on this page is a commitment, a forecast, or an obligation to deliver
        any specific feature in any specific timeframe.
      </section>
    </MarketingPage>
  );
}

function Column({
  state,
  title,
  items,
}: {
  state: "now" | "next" | "later";
  title: string;
  items: string[];
}) {
  const meta = {
    now: { label: "Live now", className: "border-primary/40 bg-gradient-to-br from-primary/10 via-card to-accent/5", icon: <Sparkles className="h-4 w-4 text-accent" /> },
    next: { label: "Coming soon", className: "border-border bg-card", icon: <Circle className="h-4 w-4 text-accent" /> },
    later: { label: "On the horizon", className: "border-border bg-card", icon: <Circle className="h-4 w-4 text-muted-foreground" /> },
  }[state];

  return (
    <div className={`rounded-3xl border p-6 shadow-soft ${meta.className}`}>
      <div className="flex items-center gap-2">
        {meta.icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">{meta.label}</span>
      </div>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      <ul className="mt-4 space-y-2">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-sm text-foreground/85">
            <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${state === "now" ? "text-primary" : "text-muted-foreground"}`} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
