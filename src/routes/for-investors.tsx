import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection } from "@/components/layout/MarketingPage";
import { Calculator, FileSearch2, GitCompare, ShieldCheck, Building2, FileText } from "lucide-react";

export const Route = createFileRoute("/for-investors")({
  head: () => ({
    meta: [
      { title: "Easy Erf for Property Investors" },
      {
        name: "description",
        content:
          "Use Easy Erf to investigate a South African property, test deal assumptions, preserve evidence confidence and understand the next due diligence step.",
      },
    ],
  }),
  component: ForInvestors,
});

function ForInvestors() {
  return (
    <MarketingPage
      eyebrow="For investors"
      title="Move from property interest to a defensible deal view."
      subtitle="The investor workflow is the core Easy Erf workflow, not a separate version of the product."
      intro="Easy Erf is being built serious-buyer and investor first. The useful investor job is not another score or alert feed. It is understanding the property evidence, testing the numbers and knowing which unknown could still change the decision."
      heroCta={{ label: "Find a Property", to: "/" }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card icon={<FileSearch2 className="h-5 w-5" />} title="Investigate before assuming" accent>
          Build the property file around parcel identity, planning, SG material, title or provider evidence, property checks and unresolved gaps.
        </Card>
        <Card icon={<Calculator className="h-5 w-5" />} title="Run Strategy">
          Test acquisition costs, maximum offer, build feasibility, resale, rental, return and sensitivity scenarios with visible assumptions.
        </Card>
        <Card icon={<GitCompare className="h-5 w-5" />} title="Add Market Evidence">
          Save and compare relevant listing or market evidence instead of relying on a platform-generated score with no source trail.
        </Card>
        <Card icon={<Building2 className="h-5 w-5" />} title="Explore development potential">
          Site Potential can turn evidence-backed planning constraints and explicit assumptions into development concepts where access is available.
        </Card>
        <Card icon={<ShieldCheck className="h-5 w-5" />} title="See the weak assumptions">
          Easy Erf keeps working conclusions and missing evidence visible so a clean-looking result does not hide a fragile input.
        </Card>
        <Card icon={<FileText className="h-5 w-5" />} title="Keep one living report">
          The report combines the property, evidence, strategy, risks and next action rather than making you rebuild the decision in a separate document.
        </Card>
      </div>

      <CTASection
        title="The full workflow is in How It Works"
        description="Audience pages are supporting context. The same canonical Guided Investigation serves the actual property decision."
        primary={{ label: "How It Works", to: "/how-it-works" }}
        secondary={{ label: "See Pricing", to: "/pricing" }}
      />
    </MarketingPage>
  );
}
