import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, FileSearch, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | Easy Erf" },
      {
        name: "description",
        content:
          "Investigate a South African property yourself for free, or order the R999 Early Access Easy Erf Property Investigation for a human-reviewed decision report.",
      },
      { property: "og:title", content: "Easy Erf pricing" },
      {
        property: "og:description",
        content:
          "Free self-serve investigation plus the R999 Early Access human-reviewed Easy Erf Property Investigation.",
      },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

const HUMAN_REVIEWED_OUTPUT = [
  "Property Truth: what the current evidence actually establishes",
  "Property Potential: what appears possible and which inputs are still assumptions",
  "Deal killers and material risks that could change the decision",
  "Conflicts between sources or property information",
  "Important unknowns that remain unresolved",
  "Clear next steps to improve confidence or move the deal forward",
];

const SELF_SERVE_INCLUDED = [
  "Find and open a property",
  "Property Overview and Guided Investigation",
  "Evidence organization and supported document uploads",
  "Working zoning and planning investigation",
  "Property checks and Market Evidence",
  "Strategy and deterministic calculators",
  "Building-area Site Potential review",
  "Living Easy Erf Report",
];

function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-32">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#C65300]">
            <Sparkles className="h-3 w-3 text-[#FF6A00]" /> Early access
          </span>
          <h1 className="mx-auto mt-4 max-w-4xl text-balance text-4xl font-semibold tracking-tight text-[#0D1B2A] md:text-5xl">
            Know what you are dealing with before you commit.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Use Easy Erf yourself, or have Easy Erf investigate the property and add human review where automation is not yet enough.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="relative overflow-hidden rounded-3xl border-2 border-[#FF6A00]/45 bg-white p-6 shadow-panel md:p-8">
            <div className="absolute right-0 top-0 rounded-bl-2xl bg-[#FF6A00] px-4 py-2 text-xs font-bold text-white">
              R999 once-off
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#C65300]">
              <UserCheck className="h-4 w-4" /> Human-reviewed property investigation
            </div>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-[#0D1B2A]">
              Easy Erf Property Investigation
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#475569]">
              Tell us what you are trying to do with the property and what you most need to know before deciding. Easy Erf uses the property file, available evidence, public sources, calculations and AI-assisted research, then a human reviewer closes the important gaps and checks the decision report.
            </p>

            <div className="mt-6 rounded-2xl bg-[#F8FAFC] p-5">
              <div className="text-sm font-semibold text-[#0D1B2A]">Your investigation report focuses on:</div>
              <ul className="mt-3 grid gap-2.5 text-sm text-[#334155]">
                {HUMAN_REVIEWED_OUTPUT.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1E9E6A]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-[#E95F00]"
              >
                Choose the property to start
              </Link>
              <span className="text-xs leading-5 text-muted-foreground">
                Early Access is one property investigation, not a subscription.
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
              Checkout is being connected to the restored R999 investigation flow. Easy Erf will not create a fake order or claim payment is live until the real payment and fulfilment path is verified.
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <FileSearch className="h-4 w-4 text-accent" /> Self-serve
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">Investigate yourself</h2>
              <span className="text-lg font-bold text-[#1E9E6A]">Free</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Build the property file yourself and use the guided investigation. Evidence availability varies by municipality, and Easy Erf keeps missing evidence visible rather than inventing answers.
            </p>
            <ul className="mt-5 grid gap-2 text-sm">
              {SELF_SERVE_INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/"
              className="mt-6 inline-flex rounded-full border border-[#0D1B2A]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[#0D1B2A] hover:bg-muted"
            >
              Find a property
            </Link>
          </section>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <h2 className="mt-3 text-lg font-semibold tracking-tight">Evidence stays honest</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Human review does not turn missing evidence into verified facts. The investigation must still distinguish official evidence, user-supplied evidence, working assumptions, conflicts and unresolved questions.
            </p>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <Sparkles className="h-5 w-5 text-accent" />
            <h2 className="mt-3 text-lg font-semibold tracking-tight">No subscription right now</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The current commercial test is simple: a R999 human-reviewed investigation for one property. Broader packages, subscriptions and professional marketplace services come later only if real customer demand justifies them.
            </p>
          </section>
        </div>

        <section className="mx-auto mt-10 max-w-3xl rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
          <h2 className="text-lg font-semibold tracking-tight">Already investigating a property?</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Keep using the same property file. The paid human-reviewed investigation is designed to build on the evidence and questions already collected rather than making you start again.
          </p>
          <Link
            to="/dashboard"
            className="mt-5 inline-flex rounded-full bg-[#0D1B2A] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#16283D]"
          >
            Open My Investigations
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
