import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MarketingPage, SectionHeading, Card } from "@/components/layout/MarketingPage";
import { Database, Building, Map, Users, Send } from "lucide-react";

export const Route = createFileRoute("/partnerships")({
  head: () => ({
    meta: [
      { title: "PropertyAtlas Partnerships" },
      { name: "description", content: "PropertyAtlas welcomes discussions with data providers, municipalities, mapping providers, real estate organizations, and proptech companies." },
      { property: "og:title", content: "PropertyAtlas Partnerships" },
      { property: "og:description", content: "Bring your data, reach, or tooling into the PropertyAtlas ecosystem." },
    ],
  }),
  component: Partnerships,
});

const TYPES = [
  { icon: Database, title: "Data providers", desc: "Property, ownership, geospatial, and transaction datasets." },
  { icon: Building, title: "Municipalities", desc: "Make official records more accessible to residents and investors." },
  { icon: Map, title: "Mapping providers", desc: "Imagery, cadastre, and basemap collaborations." },
  { icon: Users, title: "Real estate organizations", desc: "Industry associations and professional bodies." },
  { icon: Building, title: "Proptech companies", desc: "Complementary tools across valuation, finance, and analytics." },
];

function Partnerships() {
  const [sent, setSent] = useState(false);
  return (
    <MarketingPage
      eyebrow="Partnerships"
      title="Partner with PropertyAtlas."
      subtitle="Help us bring better property intelligence to South Africa."
      intro="We're actively building an ecosystem of data providers, municipalities, mapping partners, and proptech collaborators. If your organisation can contribute or benefit, we'd love to talk."
    >
      <section>
        <SectionHeading title="Who we work with" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map((t) => (
            <Card key={t.title} icon={<t.icon className="h-5 w-5" />} title={t.title}>{t.desc}</Card>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <SectionHeading
          eyebrow="Get in touch"
          title="Partnership inquiry"
          subtitle="Tell us a little about your organisation and what you'd like to explore. We respond to every legitimate inquiry."
        />
        {sent ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-sm text-foreground">
            Thanks — your inquiry has been received. A member of our team will be in touch shortly.
          </div>
        ) : (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <Field label="Organisation" name="org" required />
            <Field label="Your name" name="name" required />
            <Field label="Email" name="email" type="email" required />
            <Field label="Role" name="role" />
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Partnership type
              </label>
              <select
                name="type"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                defaultValue="data"
              >
                <option value="data">Data provider</option>
                <option value="muni">Municipality</option>
                <option value="map">Mapping provider</option>
                <option value="re">Real estate organisation</option>
                <option value="pt">Proptech company</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Message
              </label>
              <textarea
                name="message"
                required
                rows={5}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                placeholder="What would you like to explore together?"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:-translate-y-0.5 hover:shadow-glow"
              >
                <Send className="h-4 w-4" />
                Send inquiry
              </button>
            </div>
          </form>
        )}
      </section>
    </MarketingPage>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}{required && <span className="text-accent"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
