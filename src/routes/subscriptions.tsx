import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection, LegalList } from "@/components/layout/LegalPage";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "Premium Subscription Terms — ErfStop" },
      { name: "description", content: "Terms governing ErfStop premium subscriptions: renewals, refunds, feature changes, and data availability." },
    ],
  }),
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  return (
    <LegalPage
      title="Premium Subscription Terms"
      intro="These terms apply to all paid ErfStop subscriptions and are in addition to the Terms of Use."
    >
      <LegalSection title="Renewals">
        <p>
          Subscriptions automatically renew at the end of each billing period unless cancelled
          before the renewal date.
        </p>
      </LegalSection>

      <LegalSection title="Fees and Refunds">
        <p>
          Fees are non-refundable except where required by law. Partial-period refunds are not
          provided.
        </p>
      </LegalSection>

      <LegalSection title="Changes to Features and Pricing">
        <p>
          ErfStop may change features, pricing, or functionality at any time. We will
          give reasonable notice of material changes that affect existing paid subscribers.
        </p>
      </LegalSection>

      <LegalSection title="Data Availability">
        <p>
          Access to premium information depends on data availability. There is no guarantee
          that any specific property will contain premium data such as detailed ownership
          history, transfer records, or development feasibility outputs.
        </p>
      </LegalSection>

      <LegalSection title="Cancellation">
        <p>
          You can cancel your subscription at any time from your account settings. Access to
          premium features will continue until the end of the current billing period.
        </p>
      </LegalSection>

      <LegalSection title="What You Are Not Buying">
        <p>A premium subscription is not:</p>
        <LegalList items={[
          "a certified valuation or appraisal",
          "legal, financial, tax, or investment advice",
          "a guarantee of property data accuracy or completeness",
        ]} />
      </LegalSection>
    </LegalPage>
  );
}
