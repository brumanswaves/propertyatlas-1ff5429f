import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection } from "@/components/layout/MarketingPage";
import { FileText, Upload, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Property Reports | Easy Erf" },
      {
        name: "description",
        content:
          "Easy Erf uses third-party reports as optional evidence inside the property investigation. A live Easy Erf report marketplace checkout is not currently offered.",
      },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <MarketingPage
      eyebrow="Evidence"
      title="Third-party reports belong inside the property investigation."
      subtitle="The old standalone Report Marketplace has been retired because it was not a real paid checkout."
      intro="Easy Erf can use provider reports as stronger evidence when a property question requires them. The product should guide the user to obtain the right report, preserve it as source evidence, and connect its findings back to the same property file."
      heroCta={{ label: "See Current Pricing", to: "/pricing" }}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card icon={<FileText className="h-5 w-5" />} title="Provider evidence" accent>
          Lightstone, WinDeed and similar reports can contain ownership, deed, valuation, transfer, bond or comparable information depending on the report purchased.
        </Card>
        <Card icon={<Upload className="h-5 w-5" />} title="Bring it back to the property file">
          Where the Guided workflow requests a report, obtain it from the appropriate provider and upload it so Easy Erf can preserve and interpret the evidence in context.
        </Card>
        <Card icon={<ShieldCheck className="h-5 w-5" />} title="No fake checkout">
          Easy Erf does not currently process payment for these provider reports inside the app. The retired marketplace no longer creates placeholder pending orders with no payment behind them.
        </Card>
      </div>

      <CTASection
        title="Investigate the property first"
        description="Easy Erf should ask for paid evidence only when it materially improves the property investigation."
        primary={{ label: "Find a Property", to: "/" }}
        secondary={{ label: "See Pricing", to: "/pricing" }}
      />
    </MarketingPage>
  );
}
