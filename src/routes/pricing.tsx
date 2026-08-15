import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, FileText, Sparkles, WandSparkles } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | Easy Erf" },
      {
        name: "description",
        content:
          "Start an Easy Erf property investigation without a subscription. Optional third-party evidence and beta Site Potential allowances may have separate costs or access rules.",
      },
      { property: "og:title", content: "Easy Erf pricing" },
      {
        property: "og:description",
        content: "Start investigating without a subscription. Pay only when optional evidence or paid capabilities are actually needed and available.",
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

function PricingPage() {
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
            Easy Erf is keeping the MVP commercial model simple. Start with the core property investigation. Optional third-party evidence or beta capabilities only matter when your property actually needs them.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <section className="flex flex-col rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-6 shadow-panel lg:col-span-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              Core Easy Erf investigation
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight">Start free</span>
              <span className="text-xs text-muted-foreground">No recurring plan required</span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Use Easy Erf to build and understand the property file. Coverage and provider availability vary by municipality, so missing evidence remains visible instead of being replaced with unsupported data.
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
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Beta allowance, not a public price plan</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Site Potential concept generation is currently controlled by beta availability, runtime readiness and generation allowances or credits. Easy Erf does not publish a normal paid Site Potential price yet. If your account has access, the product shows the real allowance and generation status.
            </p>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <Sparkles className="h-5 w-5 text-accent" />
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Commercial model
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">No subscription right now</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Easy Erf is not selling a recurring monthly subscription in the current MVP. Multi-property bundles, professional volume packages or subscriptions may be evaluated later when real usage proves they are useful. They are not part of the current purchase decision.
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
