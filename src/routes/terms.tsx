import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection, LegalList } from "@/components/layout/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — ErfStoep" },
      { name: "description", content: "ErfStoep Terms of Use. The terms that govern your access to and use of the ErfStoep platform." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro="These Terms of Use govern your access to and use of ErfStoep. By using the platform you agree to be bound by these terms."
    >
      <LegalSection title="1. About ErfStoep">
        <p>
          ErfStoep is a property intelligence and research platform that aggregates,
          analyses, and presents property-related information. It is not a law firm, accounting
          firm, valuation company, surveying company, or investment advisor.
        </p>
      </LegalSection>

      <LegalSection title="2. Acceptable Use">
        <p>By using ErfStoep you agree not to:</p>
        <LegalList items={[
          "scrape, harvest, or systematically extract data without written permission",
          "resell, redistribute, or sublicense ErfStoep data",
          "reverse engineer or attempt to derive source code",
          "use the platform to harass, defame, or unlawfully target any person",
          "rely on the platform as a substitute for professional advice",
        ]} />
      </LegalSection>

      <LegalSection title="3. Accounts">
        <p>
          You are responsible for maintaining the confidentiality of your account credentials
          and for all activity under your account. Notify us immediately of any unauthorised use.
        </p>
      </LegalSection>

      <LegalSection title="4. Information and Estimates">
        <p>
          All property values, analytics, scores, and AI summaries are informational only. They
          are not certified valuations, appraisals, legal opinions, or investment recommendations.
          See the <a className="text-primary underline-offset-2 hover:underline" href="/disclaimer">Disclaimer</a> for full details.
        </p>
      </LegalSection>

      <LegalSection title="5. Intellectual Property">
        <p>
          The platform, including its design, analytics, scoring methodology, branding, and
          software, is owned by ErfStoep and protected by intellectual property laws.
        </p>
      </LegalSection>

      <LegalSection title="6. Subscriptions">
        <p>
          Paid features are governed by the <a className="text-primary underline-offset-2 hover:underline" href="/subscriptions">Premium Subscription Terms</a>.
        </p>
      </LegalSection>

      <LegalSection title="7. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, ErfStoep shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages, or any loss of
          profits or revenues arising from your use of the platform.
        </p>
      </LegalSection>

      <LegalSection title="8. Changes">
        <p>
          ErfStoep may modify these Terms at any time. Continued use of the platform
          constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection title="9. Governing Law">
        <p>These Terms are governed by the laws of the Republic of South Africa.</p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          Questions about these Terms? Visit our <a className="text-primary underline-offset-2 hover:underline" href="/contact">Contact</a> page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
