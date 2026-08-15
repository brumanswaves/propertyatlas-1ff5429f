import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection } from "@/components/layout/MarketingPage";
import { CircleDollarSign, Layers3, ReceiptText } from "lucide-react";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions | Easy Erf" },
      {
        name: "description",
        content:
          "Easy Erf does not currently sell a recurring subscription. See current pricing and optional paid evidence information.",
      },
    ],
  }),
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  return (
    <MarketingPage
      eyebrow="Pricing"
      title="Easy Erf does not currently sell a subscription."
      subtitle="The MVP commercial model is intentionally simpler than a conventional SaaS plan."
      intro="The old subscription terms on this URL no longer represented the product and have been retired. There is no active Easy Erf monthly auto-renewing plan, cancellation flow or subscription refund policy to apply to the current MVP."
      heroCta={{ label: "See Current Pricing", to: "/pricing" }}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card icon={<CircleDollarSign className="h-5 w-5" />} title="Start without recurring billing" accent>
          The core property investigation is designed to let a user begin working on a property without first choosing a monthly plan.
        </Card>
        <Card icon={<ReceiptText className="h-5 w-5" />} title="Optional costs stay explicit">
          Third-party evidence may carry provider fees, and any future paid Easy Erf capability should show its real price and deliverable before purchase.
        </Card>
        <Card icon={<Layers3 className="h-5 w-5" />} title="Future plans must earn their complexity">
          Multi-property bundles, professional volume packages or subscriptions can be considered later if real customer behaviour proves they improve the product.
        </Card>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground shadow-soft">
        Looking for billing or entitlement information tied to your own account? The Account and My Investigations areas will surface only real connected payment, allowance or entitlement state. Easy Erf should not display invented billing history or controls for services that are not live.
        <div className="mt-4">
          <Link to="/profile" className="text-sm font-semibold text-foreground hover:text-accent">
            Open Account
          </Link>
        </div>
      </div>

      <CTASection
        title="See the offer that is actually live"
        description="Pricing explains the core investigation, optional provider evidence and current Site Potential beta access without inventing a recurring plan."
        primary={{ label: "See Pricing", to: "/pricing" }}
        secondary={{ label: "How It Works", to: "/how-it-works" }}
      />
    </MarketingPage>
  );
}
