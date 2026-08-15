import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection } from "@/components/layout/MarketingPage";
import { FileSearch2, ShieldCheck, Calculator, Route } from "lucide-react";

export const Route = createFileRoute("/why")({
  head: () => ({
    meta: [
      { title: "Why Easy Erf?" },
      {
        name: "description",
        content:
          "Easy Erf is built around one evidence-backed property investigation rather than listings, unsupported scores or disconnected research tools.",
      },
    ],
  }),
  component: Why,
});

function Why() {
  return (
    <MarketingPage
      eyebrow="Why Easy Erf"
      title="Property research is scattered. The decision should not be."
      subtitle="Easy Erf organizes the investigation around the erf and preserves the evidence behind the answer."
      intro="The useful distinction is not listings versus intelligence. It is fragmented research versus one canonical property file that keeps identity, evidence, planning, calculations, Site Potential and the next action connected."
      heroCta={{ label: "How It Works", to: "/how-it-works" }}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card icon={<FileSearch2 className="h-5 w-5" />} title="One property file" accent>
          Evidence and analysis stay bound to the selected parcel instead of being copied between separate research tools.
        </Card>
        <Card icon={<ShieldCheck className="h-5 w-5" />} title="Confidence stays visible">
          Easy Erf should show uncertainty and missing evidence instead of converting incomplete data into a confident-looking score.
        </Card>
        <Card icon={<Calculator className="h-5 w-5" />} title="Maths before narrative">
          Strategy uses deterministic calculations and transparent assumptions. AI explains the result rather than inventing the arithmetic.
        </Card>
        <Card icon={<Route className="h-5 w-5" />} title="One Next Best Step">
          Guided Investigation and report intelligence should tell the user what is worth doing next rather than dumping every possible property task on one screen.
        </Card>
      </div>

      <CTASection
        title="The product story now lives in one place"
        description="How It Works is the canonical public explanation of the current Easy Erf experience."
        primary={{ label: "How It Works", to: "/how-it-works" }}
        secondary={{ label: "Find a Property", to: "/" }}
      />
    </MarketingPage>
  );
}
