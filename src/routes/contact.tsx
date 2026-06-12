import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { LegalPage, LegalSection } from "@/components/layout/LegalPage";

const CONTACT_EMAIL = "info@propertyatlas.co.za";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — PropertyAtlas" },
      { name: "description", content: "Get in touch with PropertyAtlas for questions, corrections, data requests, privacy requests, and support." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const channels: { title: string; body: string }[] = [
    { title: "Questions", body: "General questions about how PropertyAtlas works or what it covers." },
    { title: "Corrections", body: "Spotted incorrect information about a property? Let us know and we'll review." },
    { title: "Data Requests", body: "Request specific datasets, exports, or coverage expansion in your area." },
    { title: "Privacy Requests", body: "Access, correct, or delete personal information held by PropertyAtlas." },
    { title: "POPIA Requests", body: "Formal requests under the Protection of Personal Information Act." },
    { title: "General Support", body: "Account, billing, or technical issues with the platform." },
  ];

  return (
    <LegalPage
      title="Contact Us"
      intro="We're a small team. Reach out for any of the topics below and we'll get back to you."
    >
      <LegalSection title="Email">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-soft transition hover:border-primary/40 hover:text-primary"
        >
          <Mail className="h-4 w-4" />
          {CONTACT_EMAIL}
        </a>
        <p className="text-xs text-muted-foreground">
          Please include relevant property references (street, area, or PropertyAtlas link) where applicable.
        </p>
      </LegalSection>

      <LegalSection title="What You Can Contact Us About">
        <div className="grid gap-3 sm:grid-cols-2">
          {channels.map((c) => (
            <div key={c.title} className="rounded-xl border border-border bg-card/60 p-4">
              <div className="text-sm font-semibold text-foreground">{c.title}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection title="Response Times">
        <p>
          We aim to respond within 5 business days. Privacy and POPIA requests are handled in
          line with our statutory obligations.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
