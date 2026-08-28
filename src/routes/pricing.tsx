import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, FileText, Sparkles, WandSparkles } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | Easy Erf" },
      {
        name: "description",
        content:
          "Start an Easy Erf property investigation without a subscription, or choose the R999 Early Access human-reviewed Property Investigation. Optional third-party evidence remains separate.",
      },
      { property: "og:title", content: "Easy Erf pricing" },
      {
        property: "og:description",
        content:
          "Start investigating without a subscription. Early Access customers can choose a R999 human-reviewed Easy Erf Property Investigation when secure checkout is available.",
      },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

const INCLUDED = [
  "Find and open a property",
  "Property Overview and Guided Investigation",
  "Evidence organization and supported document uploads",
  "Planning investigation where reviewed sources are available",
  "Property checks and Market Evidence workspace",
  "Strategy and deterministic calculators",
  "Living Easy Erf Report",
  "Ask Easy Erf where the configured AI service is available",
];

const EARLY_ACCESS_INCLUDED = [
  "Property Truth: identity, evidence and important known facts",
  "Property Potential: planning, constraints and plausible opportunities",
  "Deal killers and key risks that deserve attention",
  "Conflicts, unknowns and evidence still worth obtaining",
  "Clear next steps and professional confirmation points",
  "Strategy and financial analysis where it is relevant to your question",
];

function configuredEarlyAccessPaymentLink() {
  const value = import.meta.env.VITE_EASY_ERF_R999_PAYMENT_LINK?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "buy.stripe.com") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function PricingPage() {
  const earlyAccessPaymentLink = configuredEarlyAccessPaymentLink();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-32">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" /> Pricing
          </span>
          <h1 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Start investigating without a subscription.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Use the core investigation yourself, or choose Early Access when you want Easy Erf to do more of the investigation with human review.
          </p>
        </div>

        <section className="mt-12 overflow-hidden rounded-3xl border border-accent/35 bg-gradient-to-br from-accent/10 via-card to-primary/5 shadow-panel">
          <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-border/70 p-7 lg:border-b-0 lg:border-r">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                Early Access
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Easy Erf Property Investigation
              </h2>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight">R999</span>
                <span className="pb-1 text-xs text-muted-foreground">
                  one property, introductory price
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Tell us what you are trying to do with the property and what you most want to know. Easy Erf uses the investigation already attached to the property, available public and official sources, AI-assisted research and human review to produce a clearer answer.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                This is deliberately human-assisted while we validate what customers value most. Anything we cannot verify is labelled as unresolved rather than presented as fact.
              </p>

              {earlyAccessPaymentLink ? (
                <a
                  href={earlyAccessPaymentLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-soft hover:bg-accent/90"
                >
                  Start R999 Investigation
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : (
                <div className="mt-6">
                  <button
                    type="button"
                    disabled
                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-muted px-5 py-2.5 text-sm font-semibold text-muted-foreground"
                  >
                    Secure checkout is being connected
                  </button>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
                    Easy Erf will only enable this button when the verified Stripe-hosted checkout is configured. No payment is collected by this page while checkout is unavailable.
                  </p>
                </div>
              )}
            </div>

            <div className="p-7">
              <div className="text-sm font-semibold">Your reviewed investigation includes</div>
              <ul className="mt-4 grid gap-3 text-sm">
                {EARLY_ACCESS_INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-2xl border border-border bg-background/70 p-4 text-xs leading-relaxed text-muted-foreground">
                Early Access is not a zoning certificate, title opinion, valuation, approved building plan or professional sign-off. Easy Erf should make the investigation easier, show its evidence and tell you exactly where professional confirmation is still appropriate.
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <section className="flex flex-col rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-6 shadow-panel lg:col-span-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              Core Easy Erf investigation
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight">Start free</span>
              <span className="text-xs text-muted-foreground">No recurring plan required</span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Use Easy Erf to build and understand the property file yourself. Coverage and provider availability vary by municipality, so missing evidence remains visible instead of being replaced with unsupported data.
            </p>
            <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/"
              className="mt-7 inline-flex w-fit items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
            >
              Find a Property
            </Link>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <FileText className="h-5 w-5 text-accent" />
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Optional paid evidence
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Third-party reports</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A Lightstone, WinDeed or other provider report can strengthen ownership, deed, valuation, transfer or comparable evidence when that information is needed.
            </p>
            <div className="mt-4 rounded-2xl bg-muted/60 p-4 text-xs leading-relaxed text-muted-foreground">
              Easy Erf does not currently operate a live in-app paid report checkout. Where the workflow supports a provider report, Easy Erf can guide you to obtain it and upload it back to the same property file. Provider fees, if any, are separate.
            </div>
          </section>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <WandSparkles className="h-5 w-5 text-accent" />
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Site Potential
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              Build envelope, not generated house concepts
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Site Potential uses the parcel map and a street-side view to show the potential build lines and envelope supported by the current evidence and assumptions. The active product does not generate house designs, facades or AI building concepts.
            </p>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <Sparkles className="h-5 w-5 text-accent" />
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Commercial model
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">No subscription right now</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Easy Erf is not selling a recurring monthly subscription in the current MVP. The R999 Early Access investigation is a once-off introductory offer for one property. Future bundles or subscriptions are not part of the current purchase decision.
            </p>
          </section>
        </div>

        <section className="mx-auto mt-10 max-w-3xl rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
          <h2 className="text-lg font-semibold tracking-tight">What happens when something costs money?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Easy Erf should tell you before you pay, explain what you receive, and keep optional evidence separate from the core investigation. If a payment workflow is not live, Easy Erf should say so rather than showing a fake checkout or invented price.
          </p>
          <Link
            to="/how-it-works"
            className="mt-5 inline-flex rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            See how the investigation works
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
