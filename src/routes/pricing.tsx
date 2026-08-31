import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  FileCheck2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import {
  HUMAN_REVIEW_CONTEXT_MAX_LENGTH,
  HUMAN_REVIEW_CORE_QUESTIONS,
  HUMAN_REVIEW_FOCUS_OPTIONS,
  HUMAN_REVIEW_INTENDED_USE_OPTIONS,
  HUMAN_REVIEW_NOT_INCLUDED,
  HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT,
  HUMAN_REVIEW_SCOPE_BOUNDARY,
  type HumanReviewFocus,
  type HumanReviewIntendedUse,
} from "@/lib/humanReview/scope";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Human Review | Easy Erf" },
      {
        name: "description",
        content:
          "Choose one controlled R999 Easy Erf Human Review focus. Every review covers what is known, what appears possible, risks, unknowns and what should be verified next.",
      },
      { property: "og:title", content: "Easy Erf Human Review" },
      {
        property: "og:description",
        content:
          "A scoped, human-reviewed property investigation for one South African erf.",
      },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [focus, setFocus] = useState<HumanReviewFocus | null>(null);
  const [intendedUse, setIntendedUse] = useState<HumanReviewIntendedUse | null>(null);
  const [context, setContext] = useState("");
  const [scopeAcknowledged, setScopeAcknowledged] = useState(false);
  const [parcelId, setParcelId] = useState<string | null>(null);
  const [propertyReferenceHint, setPropertyReferenceHint] = useState<string | null>(null);
  const [sourceSurface, setSourceSurface] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setParcelId(params.get("parcelId"));
    setPropertyReferenceHint(params.get("propertyReference"));
    setSourceSurface(params.get("source"));
  }, []);

  useEffect(() => {
    if (focus !== "intended_use") setIntendedUse(null);
  }, [focus]);

  const canCheckout = Boolean(
    focus &&
      (focus !== "intended_use" || intendedUse) &&
      context.length <= HUMAN_REVIEW_CONTEXT_MAX_LENGTH &&
      scopeAcknowledged,
  );

  const selectedFocus = useMemo(
    () => HUMAN_REVIEW_FOCUS_OPTIONS.find((option) => option.id === focus) ?? null,
    [focus],
  );

  async function startHumanReviewCheckout() {
    if (!focus || !canCheckout) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const { data, error } = await supabase.functions.invoke("easy-erf-r999-checkout", {
        body: {
          focus,
          intendedUse,
          context: context.trim() || null,
          parcelId,
          propertyReferenceHint,
          sourceSurface,
          scopeAcknowledged,
        },
      });
      if (error || !data?.ok || data?.mode !== "test" || typeof data?.url !== "string") {
        throw new Error(data?.error ?? error?.message ?? "Secure checkout is unavailable.");
      }
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.hostname !== "buy.stripe.com") {
        throw new Error("Secure checkout returned an invalid destination.");
      }
      window.location.assign(url.toString());
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Secure checkout is unavailable.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F7FBFF]">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-28 sm:px-6">
        <header className="overflow-hidden rounded-[2rem] bg-[#0D1B2A] px-5 py-8 text-white shadow-[0_28px_80px_-55px_rgba(13,27,42,0.75)] sm:px-8 sm:py-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
            <ShieldCheck className="h-3.5 w-3.5" /> Human Review · R999
          </div>
          <h1 className="mt-4 max-w-4xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            Hand the property investigation to Easy Erf for a focused Human Review.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/68 sm:text-base">
            Choose one controlled investigation focus. Easy Erf reviews the property evidence already gathered, records what is supported, separates uncertainty from fact, and tells you what still needs verification.
          </p>
          {propertyReferenceHint || parcelId ? (
            <div className="mt-6 max-w-2xl rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
                Property carried from your investigation
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {propertyReferenceHint ?? parcelId}
              </div>
              <p className="mt-1 text-xs leading-5 text-white/55">
                Your existing Easy Erf property work remains attached. Human Review is a takeover of the investigation, not a restart.
              </p>
            </div>
          ) : null}
        </header>

        <section className="mt-6 rounded-[2rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-soft sm:p-7">
          <div className="max-w-3xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
              Step 1 · Choose one investigation focus
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
              What are you trying to understand about this property?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              Choose the property question Easy Erf should investigate. Your optional context helps the reviewer understand your situation, but it cannot expand the review into professional advice.
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {HUMAN_REVIEW_FOCUS_OPTIONS.map((option) => {
              const selected = focus === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFocus(option.id)}
                  className={
                    selected
                      ? "rounded-[1.35rem] border-2 border-[#FF6A00] bg-[#FFF7ED] p-5 text-left shadow-sm"
                      : "rounded-[1.35rem] border border-[#0D1B2A]/10 bg-white p-5 text-left transition hover:border-[#FF6A00]/40 hover:bg-[#fffaf2]"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[#0D1B2A]">{option.label}</div>
                      <p className="mt-2 text-sm leading-6 text-[#64748B]">{option.description}</p>
                    </div>
                    <span className={selected ? "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#FF6A00] text-white" : "grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#0D1B2A]/15 text-transparent"}>
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {focus === "intended_use" ? (
            <div className="mt-5 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-5">
              <div className="text-sm font-semibold text-[#0D1B2A]">Choose the intended use to check</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {HUMAN_REVIEW_INTENDED_USE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setIntendedUse(option.id)}
                    className={
                      intendedUse === option.id
                        ? "rounded-2xl border border-[#FF6A00] bg-white px-4 py-3 text-left text-sm font-semibold text-[#0D1B2A] ring-2 ring-[#FF6A00]/10"
                        : "rounded-2xl border border-[#D9E6F2] bg-white px-4 py-3 text-left text-sm font-semibold text-[#0D1B2A] hover:border-[#FF6A00]/40"
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
          <div className="rounded-[2rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-soft sm:p-7">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
              Step 2 · Optional context
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#0D1B2A]">
              Tell us about your situation — not a new question.
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              Example: “I’m considering buying this vacant erf and eventually building a family home.” This helps the reviewer understand your situation but does not change the selected investigation scope.
            </p>
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              maxLength={HUMAN_REVIEW_CONTEXT_MAX_LENGTH}
              rows={5}
              placeholder="Optional situation context"
              className="mt-4 w-full resize-y rounded-[1.25rem] border border-[#D9E6F2] bg-[#F7FBFF] px-4 py-3 text-sm leading-6 text-[#0D1B2A] outline-none focus:border-[#FF6A00]"
            />
            <div className="mt-1 text-right text-[10px] text-[#64748B]">
              {context.length}/{HUMAN_REVIEW_CONTEXT_MAX_LENGTH}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-soft sm:p-7">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
              Every R999 Human Review answers
            </div>
            <ol className="mt-4 space-y-2">
              {HUMAN_REVIEW_CORE_QUESTIONS.map((question, index) => (
                <li key={question} className="flex gap-3 rounded-2xl bg-[#F7FBFF] px-4 py-3 text-sm font-semibold text-[#0D1B2A]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0D1B2A] text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  {question}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#F59E0B]/30 bg-[#fffbeb] p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#92400E]" />
            <div>
              <h2 className="text-lg font-semibold text-[#0D1B2A]">Clear scope boundary</h2>
              <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/72">{HUMAN_REVIEW_SCOPE_BOUNDARY}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {HUMAN_REVIEW_NOT_INCLUDED.map((item) => (
              <div key={item} className="rounded-2xl border border-[#F59E0B]/20 bg-white/80 px-4 py-3 text-xs leading-5 text-[#0D1B2A]/72">
                {item}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-[#92400E]">
            Build-cost rule: Easy Erf may use a builder/QS/customer-supplied cost in deterministic scenario calculations, but Human Review does not invent a construction quotation or per-m² build-cost estimate.
          </p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#F59E0B]/25 bg-white/90 p-4">
            <input
              type="checkbox"
              checked={scopeAcknowledged}
              onChange={(event) => setScopeAcknowledged(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF6A00]"
            />
            <span className="text-sm leading-6 text-[#0D1B2A]">
              <strong>Required:</strong> {HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT}
            </span>
          </label>
        </section>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-[#FF6A00]/30 bg-white shadow-soft">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.55fr)]">
            <div className="p-5 sm:p-7">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
                Your controlled brief
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
                {selectedFocus?.label ?? "Choose a focus above"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748B]">
                {selectedFocus?.description ?? "Easy Erf will not open checkout until the investigation scope is defined."}
              </p>
              {focus === "intended_use" && intendedUse ? (
                <p className="mt-3 rounded-2xl bg-[#F7FBFF] px-4 py-3 text-sm font-semibold text-[#0D1B2A]">
                  Intended use: {HUMAN_REVIEW_INTENDED_USE_OPTIONS.find((option) => option.id === intendedUse)?.label}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col justify-center border-t border-[#0D1B2A]/10 bg-[#F7FBFF] p-5 lg:border-l lg:border-t-0 sm:p-7">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight text-[#0D1B2A]">R999</span>
                <span className="pb-1 text-xs text-[#64748B]">once-off · one property · no subscription</span>
              </div>
              <button
                type="button"
                disabled={!canCheckout || checkoutLoading}
                onClick={() => void startHumanReviewCheckout()}
                className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff7d1f] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {checkoutLoading ? "Opening secure checkout…" : "Continue to secure checkout"}
                <ArrowUpRight className="h-4 w-4" />
              </button>
              {!focus ? <p className="mt-2 text-xs text-[#64748B]">Choose one investigation focus first.</p> : null}
              {focus === "intended_use" && !intendedUse ? <p className="mt-2 text-xs text-[#64748B]">Choose the intended use first.</p> : null}
              {focus && (focus !== "intended_use" || intendedUse) && !scopeAcknowledged ? (
                <p className="mt-2 text-xs text-[#64748B]">Acknowledge the Human Review scope before checkout.</p>
              ) : null}
              {checkoutError ? <p className="mt-2 text-xs font-medium text-destructive">{checkoutError}</p> : null}
              <p className="mt-3 text-[11px] leading-5 text-[#64748B]">
                Secure Stripe-hosted checkout. Current launch configuration remains TEST mode until the separate live-launch approval.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white p-5">
            <FileCheck2 className="h-5 w-5 text-[#FF6A00]" />
            <h2 className="mt-3 text-lg font-semibold text-[#0D1B2A]">Already doing it yourself?</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              Keep going. Human Review remains available inside the investigation, dossier and report so you can hand the property over later without losing your work.
            </p>
            <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#0D1B2A] hover:text-[#FF6A00]">
              Investigate it myself <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white p-5">
            <Sparkles className="h-5 w-5 text-[#FF6A00]" />
            <h2 className="mt-3 text-lg font-semibold text-[#0D1B2A]">One report methodology</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              Self-service and Human Review use the same property evidence. Human Review adds reviewer conclusions and a controlled five-part report rather than creating a separate disconnected property file.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
