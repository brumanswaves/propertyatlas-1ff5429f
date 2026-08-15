import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection } from "@/components/layout/MarketingPage";
import { FileSearch2, Network, BrainCircuit, Layers3 } from "lucide-react";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Easy Erf Roadmap" },
      {
        name: "description",
        content:
          "A high-level, non-binding view of Easy Erf's product direction: strengthen the core investigation, automate evidence acquisition, deepen decision intelligence, then expand coverage and platform capabilities.",
      },
    ],
  }),
  component: Roadmap,
});

function Roadmap() {
  return (
    <MarketingPage
      eyebrow="Roadmap"
      title="Build the investigation first. Expand from evidence."
      subtitle="This is product direction, not a delivery calendar or promise of specific dates."
      intro="Easy Erf is deliberately proving the end-to-end property investigation before chasing national breadth. The deepest current validation remains the Kouga/St Francis pilot and the canonical Erf 1570 journey."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card icon={<FileSearch2 className="h-5 w-5" />} title="Now: make the core investigation excellent" accent>
          Strengthen Property Overview, Guided Investigation, canonical evidence, planning, Market Evidence, Strategy, Site Potential, Ask Easy Erf and the living report as one coherent property experience.
        </Card>
        <Card icon={<Network className="h-5 w-5" />} title="Next: automate evidence acquisition">
          Improve cadastral retrieval, municipal planning sources, document extraction, address intelligence, provider evidence and market/comparable ingestion without weakening provenance.
        </Card>
        <Card icon={<BrainCircuit className="h-5 w-5" />} title="Then: deepen decision intelligence">
          Improve build-envelope reasoning, development scenarios, financial comparisons, risk framing and investor decision summaries using the same canonical property file.
        </Card>
        <Card icon={<Layers3 className="h-5 w-5" />} title="Later: expand the platform">
          Broader municipal coverage, monitoring, professional collaboration, property passport, transaction-room workflows, portfolio tools, marketplace capabilities and enterprise/API products remain later-stage opportunities.
        </Card>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground shadow-soft">
        Roadmap items are directional. Easy Erf should not label a capability “live,” “coming soon,” or paid until the actual product and supporting data/provider infrastructure justify that statement.
      </div>

      <CTASection
        title="Judge Easy Erf by what works today"
        description="The current product journey is explained in How It Works."
        primary={{ label: "How It Works", to: "/how-it-works" }}
        secondary={{ label: "Find a Property", to: "/" }}
      />
    </MarketingPage>
  );
}
