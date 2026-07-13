import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection, LegalList } from "@/components/layout/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Easy Erf" },
      { name: "description", content: "Easy Erf Privacy Policy. How we collect, use, and protect personal information in line with POPIA." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains how Easy Erf collects, uses, and protects your personal information in line with the Protection of Personal Information Act (POPIA)."
    >
      <LegalSection title="Information We Collect">
        <LegalList items={[
          "Account information (name, email, password hash)",
          "Saved properties and watchlists",
          "Marketing preferences",
          "Contact requests and correspondence",
          "Usage analytics (pages visited, features used, device and browser data)",
          "Cookies and similar technologies for session management and analytics",
        ]} />
      </LegalSection>

      <LegalSection title="How We Use Information">
        <LegalList items={[
          "to provide and operate the Easy Erf platform",
          "to deliver saved properties, watchlists, alerts, and reports",
          "to improve product features, scoring methodology, and user experience",
          "to communicate service updates and (where permitted) marketing messages",
          "to comply with legal obligations",
        ]} />
      </LegalSection>

      <LegalSection title="Cookies and Analytics">
        <p>
          Easy Erf uses cookies for authentication, session management, and aggregated
          analytics. You can disable cookies in your browser, but parts of the platform may
          not function correctly without them.
        </p>
      </LegalSection>

      <LegalSection title="Marketing Preferences">
        <p>
          You can opt in or out of marketing communications at any time from your account
          settings or via the unsubscribe link in any marketing email.
        </p>
      </LegalSection>

      <LegalSection title="Your Rights Under POPIA">
        <p>You have the right to:</p>
        <LegalList items={[
          "access the personal information we hold about you",
          "request correction of inaccurate information",
          "request deletion of your personal information",
          "object to processing for direct marketing",
          "lodge a complaint with the Information Regulator of South Africa",
        ]} />
      </LegalSection>

      <LegalSection title="Data Deletion Requests">
        <p>
          To request deletion of your account or specific personal information, contact us via
          the <a className="text-primary underline-offset-2 hover:underline" href="/contact">Contact</a> page. We will respond within a reasonable period and in line with our
          legal obligations.
        </p>
      </LegalSection>

      <LegalSection title="Information Sharing">
        <p>
          Easy Erf does not sell personal information. We may share information with
          trusted service providers (hosting, analytics, payment processors) under appropriate
          confidentiality and data-protection agreements, or where required by law.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We use reasonable technical and organisational measures to protect personal
          information. No method of transmission or storage is fully secure, and we cannot
          guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Privacy or POPIA requests can be submitted through our <a className="text-primary underline-offset-2 hover:underline" href="/contact">Contact</a> page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
