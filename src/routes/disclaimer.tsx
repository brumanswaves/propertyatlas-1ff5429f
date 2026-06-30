import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection, LegalList, LegalCallout } from "@/components/layout/LegalPage";

export const Route = createFileRoute("/disclaimer")({
  head: () => ({
    meta: [
      { title: "Disclaimer — ErfStoep" },
      { name: "description", content: "ErfStoep disclaimer. We provide property intelligence and research tools for informational purposes only — not legal, financial, valuation, or investment advice." },
    ],
  }),
  component: DisclaimerPage,
});

function DisclaimerPage() {
  return (
    <LegalPage
      title="ErfStoep Disclaimer"
      intro="Please read this disclaimer carefully before relying on any information, analytics, or estimates provided by ErfStoep."
    >
      <LegalCallout>
        <strong>ErfStoep provides property-related information, analytics, estimates, visualizations, scores, and research tools for informational purposes only.</strong>
      </LegalCallout>

      <LegalSection title="What ErfStoep Does Not Provide">
        <p>ErfStoep does not provide:</p>
        <LegalList items={[
          "legal advice",
          "financial advice",
          "investment advice",
          "tax advice",
          "accounting advice",
          "valuation services",
          "appraisal services",
          "surveying services",
        ]} />
        <p>
          Users should consult qualified professionals before making property, financial, legal,
          investment, tax, development, or valuation decisions.
        </p>
      </LegalSection>

      <LegalSection title="No Guarantees">
        <p>ErfStoep makes no guarantees regarding:</p>
        <LegalList items={["accuracy", "completeness", "timeliness", "suitability"]} />
        <p>Any use of information is entirely at the user's own risk.</p>
        <p>
          ErfStoep shall not be liable for losses arising from reliance on information
          presented on the platform.
        </p>
      </LegalSection>

      <LegalSection title="Property Estimates">
        <p>
          Estimated values are automated estimates based on available data and modelling
          assumptions. They are not formal valuations or appraisals.
        </p>
        <p className="font-semibold text-foreground">Estimate Only • Not a Certified Valuation</p>
      </LegalSection>

      <LegalSection title="AI-Generated Insights">
        <p>
          AI-generated insights are produced using automated analysis and may contain
          inaccuracies. Do not rely on AI-generated insights as professional advice.
        </p>
      </LegalSection>

      <LegalSection title="Scores">
        <p>
          Investor Score, Development Score, Seller Probability, Ocean View Score, Walkability
          Score, Rental Yield Score, and Appreciation Score are proprietary informational
          indicators and should not be interpreted as guarantees, recommendations, forecasts,
          or professional advice.
        </p>
      </LegalSection>

      <LegalSection title="Ownership Data">
        <p>
          Ownership information may be incomplete, delayed, estimated, or unavailable depending
          on source availability and licensing. ErfStoep does not guarantee ownership
          records. Users should verify ownership independently through official channels.
        </p>
      </LegalSection>

      <LegalSection title="Sales History">
        <p>
          Sales history may contain delays, omissions, or inaccuracies. Users should
          independently verify transaction history before relying on information.
        </p>
      </LegalSection>

      <LegalSection title="Photos and Imagery">
        <p>
          Historical imagery, photographs, aerial images, and visual materials may not represent
          current property conditions. Images should not be relied upon as evidence of current
          property state.
        </p>
      </LegalSection>

      <LegalSection title="Mock / Demo Data">
        <p>
          ErfStoep is currently operating in pilot mode. Where mock or demo data is shown,
          a visible "Demo Data" notice will appear. This notice is not hidden and should be
          considered an integral part of the displayed information.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
