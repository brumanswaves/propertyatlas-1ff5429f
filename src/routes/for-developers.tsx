import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection } from "@/components/layout/MarketingPage";
import { Building2, Calculator, FileSearch2, Ruler, ShieldCheck, FileText } from "lucide-react";

export const Route = createFileRoute("/for-developers")({
  head: () => ({
    meta: [
      { title: "Easy Erf for Property Developers" },
      {
        name: "description",
        content:
          "Investigate parcel evidence, planning controls, development assumptions, Site Potential and feasibility scenarios in one Easy Erf property file.",
      },
    ],
  }),
  component: ForDevelopers,
});

function ForDevelopers() {
  return (
    <MarketingPage
      eyebrow="For developers"
      title="Connect planning evidence to development feasibility."
      subtitle="Site Potential and Strategy are strongest when the property constraints underneath them are explicit."
      intro="Easy Erf helps a developer move from parcel identity and planning evidence into build-envelope assumptions, concept exploration and deterministic financial scenarios. It does not claim automatic development scores, complete ownership histories or parcel rights that have not been proved."
      heroCta={{ label: "Find a Property", to: "/" }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card icon={<Ruler className="h-5 w-5" />} title="Start with the parcel" accent>
          Use the canonical cadastral identity, geometry and SG material as the base for later development work.
        </Card>
        <Card icon={<FileSearch2 className="h-5 w-5" />} title="Investigate planning">
          Review the best available municipal sources, working zoning, published general rules, property-specific evidence and unresolved constraints.
        </Card>
        <Card icon={<Building2 className="h-5 w-5" />} title="Explore Site Potential">
          Convert verified or explicitly assumed building controls into understandable build-envelope and concept work without presenting it as approval.
        </Card>
        <Card icon={<Calculator className="h-5 w-5" />} title="Run feasibility">
          Use Strategy to model acquisition, build costs, soft costs, contingency, GDV, residual land value, profit and sensitivity with transparent maths.
        </Card>
        <Card icon={<ShieldCheck className="h-5 w-5" />} title="Keep provenance attached">
          A general scheme rule, user-confirmed working conclusion and official property-specific right remain different inputs even when they produce the same number.
        </Card>
        <Card icon={<FileText className="h-5 w-5" />} title="Carry it into the report">
          Accepted Site Potential and the chosen Strategy scenario flow into the same living Easy Erf Report rather than becoming isolated workbenches.
        </Card>
      </div>

      <CTASection
        title="See the complete development path"
        description="How It Works explains where planning, Strategy and Site Potential fit inside the broader property investigation."
        primary={{ label: "How It Works", to: "/how-it-works" }}
        secondary={{ label: "See Pricing", to: "/pricing" }}
      />
    </MarketingPage>
  );
}
