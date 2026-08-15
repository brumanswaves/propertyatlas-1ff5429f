import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection } from "@/components/layout/MarketingPage";
import { FileSearch2, Calculator, Building2, FileText, ShieldCheck, MessageCircleQuestion } from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Easy Erf Features" },
      {
        name: "description",
        content:
          "Easy Erf features now form one guided property investigation: evidence, planning, Market Evidence, Strategy, Site Potential, Ask Easy Erf and a living report.",
      },
    ],
  }),
  component: Features,
});

function Features() {
  return (
    <MarketingPage
      eyebrow="Product"
      title="Easy Erf is one investigation, not a menu of disconnected features."
      subtitle="The detailed product walkthrough now lives in How It Works."
      intro="As Easy Erf has evolved, the old Features page became a duplicate product directory. The current product is better understood as one property journey where each capability improves the same canonical property file."
      heroCta={{ label: "See How It Works", to: "/how-it-works" }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card icon={<FileSearch2 className="h-5 w-5" />} title="Investigate the evidence" accent>
          Property identity, SG and cadastral material, planning sources, uploaded documents and missing evidence remain connected to the selected erf.
        </Card>
        <Card icon={<ShieldCheck className="h-5 w-5" />} title="Keep confidence visible">
          Verified facts, working conclusions, assumptions, conflicts and unknowns are deliberately not collapsed into one answer.
        </Card>
        <Card icon={<Calculator className="h-5 w-5" />} title="Run Strategy">
          Deterministic calculations turn property facts and explicit assumptions into acquisition, development, resale, rental and sensitivity scenarios.
        </Card>
        <Card icon={<Building2 className="h-5 w-5" />} title="Explore Site Potential">
          Where available, build-envelope assumptions and generated concepts help explain what the property could become without masquerading as approval.
        </Card>
        <Card icon={<FileText className="h-5 w-5" />} title="Build the living report">
          The Easy Erf Report improves as the investigation improves rather than becoming a separate static product.
        </Card>
        <Card icon={<MessageCircleQuestion className="h-5 w-5" />} title="Ask Easy Erf">
          Grounded questions and explanations use the current property file, evidence and calculations instead of acting like a generic chatbot.
        </Card>
      </div>

      <CTASection
        title="See the complete journey"
        description="How It Works explains the current Easy Erf experience from property search through Guided Investigation, Strategy, Site Potential and report."
        primary={{ label: "How It Works", to: "/how-it-works" }}
        secondary={{ label: "Find a Property", to: "/" }}
      />
    </MarketingPage>
  );
}
