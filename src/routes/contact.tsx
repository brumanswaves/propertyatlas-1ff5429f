import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MarketingPage, SectionHeading } from "@/components/layout/MarketingPage";
import { LifeBuoy, Handshake, Database, AlertTriangle, ShieldCheck, Newspaper, MessageSquare, Send } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact PropertyAtlas" },
      { name: "description", content: "Get in touch with PropertyAtlas — support, partnerships, data providers, corrections, privacy requests, and media." },
      { property: "og:title", content: "Contact PropertyAtlas" },
      { property: "og:description", content: "We respond to every legitimate inquiry." },
    ],
  }),
  component: Contact,
});

const TOPICS = [
  { icon: MessageSquare, label: "General Questions", value: "general" },
  { icon: LifeBuoy, label: "Support", value: "support" },
  { icon: Handshake, label: "Partnerships", value: "partnerships" },
  { icon: Database, label: "Data Providers", value: "data" },
  { icon: AlertTriangle, label: "Corrections", value: "corrections" },
  { icon: ShieldCheck, label: "Privacy Requests", value: "privacy" },
  { icon: Newspaper, label: "Media", value: "media" },
];

function Contact() {
  const [topic, setTopic] = useState("general");
  const [sent, setSent] = useState(false);

  return (
    <MarketingPage
      eyebrow="Contact"
      title="Talk to PropertyAtlas."
      subtitle="We respond to every legitimate inquiry."
      intro="Whether you're a homeowner with a question, a journalist with a story, or a data provider exploring a partnership — we'd like to hear from you."
    >
      <section>
        <SectionHeading title="What's this about?" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TOPICS.map((t) => {
            const active = topic === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setTopic(t.value)}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-primary bg-primary/5 shadow-soft"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <span className={`inline-grid h-9 w-9 place-items-center rounded-xl ${active ? "bg-gradient-brand text-primary-foreground" : "bg-muted text-foreground"}`}>
                  <t.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-foreground">{t.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <SectionHeading eyebrow="Get in touch" title="Send us a message" />
        {sent ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-sm text-foreground">
            Thanks — your message has been received. We'll be in touch.
          </div>
        ) : (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <Field label="Your name" name="name" required />
            <Field label="Email" name="email" type="email" required />
            <input type="hidden" name="topic" value={topic} />
            <div className="sm:col-span-2">
              <Field label="Subject" name="subject" required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Message</label>
              <textarea
                name="message"
                required
                rows={6}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                placeholder="How can we help?"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                By submitting this form you agree to our Privacy Policy. We will only use your information to respond to your inquiry.
              </p>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:-translate-y-0.5 hover:shadow-glow"
              >
                <Send className="h-4 w-4" />
                Send message
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
