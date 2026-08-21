import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, FileSearch, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | Easy Erf" },
      {
        name: "description",
        content:
          "Get an Early Access Easy Erf Property Investigation for R999 once-off, combining Easy Erf research, official/public evidence, analysis and human review.",
      },
      { property: "og:title", content: "Easy Erf Property Investigation - R999" },
      {
        property: "og:description",
        content:
          "A human-reviewed Easy Erf property investigation covering property truth, potential, risks, conflicts, unknowns and next steps.",
      },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

const INCLUDED = [
  "Property identity and official/public-source evidence review",
  "Planning and zoning evidence review where sources are available",
  "SG diagram and uploaded-document review where readable evidence is available",
  "Property potential and practical development considerations",
  "Deal killers, material risks and conflicting evidence",
  "Unknowns that still need confirmation",
  "Clear recommended next steps",
  "A human-reviewed Easy Erf report saved with the investigation",
];

function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-32">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
            <Sparkles className="h-3 w-3" /> Early Access
          </span>
          <h1 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Get the property investigated before you make the expensive decision.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Easy Erf combines property research, public and official evidence, structured analysis and human review into one practical investigation.
          </p>
        </div>

        <section className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-panel">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-7 sm:p-9">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                Easy Erf Property Investigation
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="text-5xl font-semibold tracking-tight">R999</span>
                <span className="pb-1 text-sm font-medium text-muted-foreground">once-off</span>
              </div>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                Built for buyers, owners and investors who want a second set of eyes on an erf before committing more money or time. There is no subscription required for this investigation.
              </p>

              <div className="mt-6 rounded-2xl border border-accent/20 bg-accent/[0.05] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-accent" /> Human-reviewed before delivery
                </div>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  Easy Erf does as much of the evidence gathering and analysis as the available sources allow. A human review checks the investigation before the customer report is delivered.
                </p>
              </div>

              <Link
                to="/"
                className="mt-7 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition hover:bg-accent/90"
              >
                Start an investigation
              </Link>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                Easy Erf will not invent a checkout or payment state. The purchase step will only be shown when the connected payment flow is live.
              </p>
            </div>

            <div className="border-t border-border bg-primary/[0.035] p-7 sm:p-9 lg:border-l lg:border-t-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-accent" /> What you receive
              </div>
              <ul className="mt-5 grid gap-3 text-sm">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span className="leading-5">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <div className="mx-auto mt-6 grid max-w-4xl gap-5 md:grid-cols-2">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <FileSearch className="h-5 w-5 text-accent" />
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              The report answers
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">What is true, what matters, and what is still unknown?</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The report is organized around Property Truth, Property Potential, key risks or deal killers, conflicts in the evidence, unresolved unknowns and the next actions worth taking.
            </p>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Evidence first
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Missing evidence stays visible.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Municipal and provider coverage varies. Easy Erf should show what is verified, what is user-confirmed, what is inferred and what still needs a planner, surveyor, conveyancer or other professional to confirm.
            </p>
          </section>
        </div>

        <section className="mx-auto mt-8 max-w-4xl rounded-3xl border border-border bg-card p-6 text-center shadow-soft sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight">Need more after the investigation?</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Where the report identifies a real gap, Easy Erf can guide the next step, such as a title or deeds check, zoning confirmation, town planner, land surveyor, architect, conveyancer, engineer, builder, valuation or deeper feasibility work. Those are follow-on services, not reasons to complicate the first investigation.
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
