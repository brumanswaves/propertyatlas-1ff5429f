import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection } from "@/components/layout/MarketingPage";
import { FileSearch2, Home, ShieldCheck, FileText } from "lucide-react";

export const Route = createFileRoute("/for-homeowners")({
  head: () => ({
    meta: [
      { title: "Easy Erf for Homeowners" },
      {
        name: "description",
        content:
          "Use Easy Erf to understand your erf, organize property documents, investigate planning questions and see what still needs official confirmation.",
      },
    ],
  }),
  component: ForHomeowners,
});

function ForHomeowners() {
  return (
    <MarketingPage
      eyebrow="For homeowners"
      title="Understand the property you already own."
      subtitle="The same evidence discipline used for a purchase can help you understand your own erf."
      intro="Easy Erf can organize the parcel identity, uploaded property documents, planning questions, property checks and unresolved evidence around your home. It does not invent a live valuation, ownership history or transaction-monitoring service when those sources are not connected."
      heroCta={{ label: "Find Your Property", to: "/" }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={<Home className="h-5 w-5" />} title="Confirm the erf" accent>
          Start with the official parcel identity and working address so documents and later findings stay attached to the right property.
        </Card>
        <Card icon={<FileSearch2 className="h-5 w-5" />} title="Organize evidence">
          Add SG, title, planning or other supported documents and see what each source actually supports.
        </Card>
        <Card icon={<ShieldCheck className="h-5 w-5" />} title="Understand planning confidence">
          Published rules, working zoning, property-specific evidence and missing municipal confirmation remain visibly distinct.
        </Card>
        <Card icon={<FileText className="h-5 w-5" />} title="Keep a living property file">
          Use the Easy Erf Report as an understandable summary of what is known, what is uncertain and what to check next.
        </Card>
      </div>

      <CTASection
        title="Start with your own erf"
        description="Find the property, review Property Overview, and begin Guided Investigation only when you want to work through the evidence."
        primary={{ label: "Find a Property", to: "/" }}
        secondary={{ label: "How It Works", to: "/how-it-works" }}
      />
    </MarketingPage>
  );
}
