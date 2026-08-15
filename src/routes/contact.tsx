import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage, Card, CTASection } from "@/components/layout/MarketingPage";
import { LifeBuoy, Handshake, Database, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Easy Erf" },
      {
        name: "description",
        content:
          "Easy Erf support, corrections, privacy and partnership contact information. The previous browser-only form has been retired until real message delivery is connected.",
      },
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <MarketingPage
      eyebrow="Contact"
      title="Need help with Easy Erf?"
      subtitle="Use the product and account routes that are connected today."
      intro="The previous contact form only showed a local success message and did not deliver a message anywhere. It has been removed rather than pretending an inquiry was received. A real support/contact intake will return when delivery and operational follow-up are connected."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={<LifeBuoy className="h-5 w-5" />} title="Product support" accent>
          If a saved property or investigation is not behaving correctly, keep the property in My Investigations so the Founder Operations workflow can inspect canonical state as that support capability is completed.
        </Card>
        <Card icon={<Database className="h-5 w-5" />} title="Data correction">
          Keep the disputed source or uploaded evidence attached to the property where possible. Easy Erf should preserve the conflicting evidence rather than silently overwrite it.
        </Card>
        <Card icon={<ShieldCheck className="h-5 w-5" />} title="Privacy or account">
          Account is the customer-facing place for identity and account information. Privacy terms remain available from the footer.
        </Card>
        <Card icon={<Handshake className="h-5 w-5" />} title="Partnerships">
          Partnership inquiries are not currently collected through a live web form. The Partnerships page explains the types of collaboration Easy Erf may consider.
        </Card>
      </div>

      <div className="mt-8 rounded-2xl border border-amber-300/50 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950">
        <strong>Contact intake is not yet connected.</strong> Easy Erf should not display a “message received” confirmation until a real backend or email delivery path exists and can be monitored by an operator.
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          to="/dashboard"
          className="inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          My Investigations
        </Link>
        <Link
          to="/profile"
          className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
        >
          Account
        </Link>
      </div>

      <CTASection
        title="Looking for product information?"
        description="How It Works and Pricing describe the current product without requiring a contact request."
        primary={{ label: "How It Works", to: "/how-it-works" }}
        secondary={{ label: "See Pricing", to: "/pricing" }}
      />
    </MarketingPage>
  );
}
