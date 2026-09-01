import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  FileCheck2,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { HumanReviewProof } from "@/components/humanReview/HumanReviewProof";
import { supabase } from "@/integrations/supabase/client";
import {
  DONE_FOR_YOU_INVESTIGATION_NAME,
  DONE_FOR_YOU_INVESTIGATION_TAGLINE,
  HUMAN_REVIEW_CONTEXT_MAX_LENGTH,
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
      { title: "Done-for-You Property Investigation | Easy Erf" },
      {
        name: "description",
        content:
          "You choose the property. Easy Erf works through the standard property investigation for R999 once-off and delivers a Human-Reviewed Easy Erf Report.",
      },
      { property: "og:title", content: "Easy Erf Done-for-You Property Investigation" },
      {
        property: "og:description",
        content:
          "A R999 once-off done-for-you property investigation with a human-reviewed report, clear evidence, risks, unknowns and next checks.",
      },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

const SIGN_IN_REQUIRED_MESSAGE =
  "Sign in before checkout so your done-for-you investigation and completed report stay attached to your Easy Erf account.";

function PricingPage() {
  const [focus, setFocus] = useState<HumanReviewFocus | null>(null);
  const [intendedUse, setIntendedUse] = useState<HumanReviewIntendedUse | null>(null);
  const [context, setContext] = useState("");
  const [scopeAcknowledged, setScopeAcknowledged] = useState(false);
  const [parcelId, setParcelId] = useState<string | null>(null);
  const [propertyReferenceHint, setPropertyReferenceHint] = useState("");
  const [sourceSurface, setSourceSurface] = useState<string | null>(null);
  const [selectionReady, setSelectionReady] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setParcelId(params.get("parcelId")?.trim() || null);
    setPropertyReferenceHint(params.get("propertyReference")?.trim() || "");
    setSourceSurface(params.get("source"));
    setSelectionReady(true);
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setSignedInEmail(data.user?.email ?? null);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSignedInEmail(session?.user?.email ?? null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (focus !== "intended_use") setIntendedUse(null);
  }, [focus]);

  const propertyReference = propertyReferenceHint.trim() || parcelId || "";
  const hasConfirmedParcel = Boolean(parcelId);
  const selectedFocus = useMemo(
    () => HUMAN_REVIEW_FOCUS_OPTIONS.find((option) => option.id === focus) ?? null,
    [focus],
  );
  const canCheckout = Boolean(
    hasConfirmedParcel &&
      focus &&
      (focus !== "intended_use" || intendedUse) &&
      context.length <= HUMAN_REVIEW_CONTEXT_MAX_LENGTH &&
      scopeAcknowledged,
  );

  async function startHumanReviewCheckout() {
    if (!focus || !parcelId || !canCheckout) return;
    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setSignedInEmail(null);
        setCheckoutError(SIGN_IN_REQUIRED_MESSAGE);
        return;
      }

      setSignedInEmail(userData.user.email ?? null);
      const { data, error } = await supabase.functions.invoke("easy-erf-r999-checkout", {
        body: {
          focus,
          intendedUse,
          context: context.trim() || null,
          parcelId,
          propertyReferenceHint: propertyReference,
          sourceSurface,
          scopeAcknowledged,
        },
      });
      const checkoutMode = data?.mode;
      if (
        error ||
        !data?.ok ||
        (checkoutMode !== "test" && checkoutMode !== "live") ||
        typeof data?.url !== "string"
      ) {
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

  if (selectionReady && !hasConfirmedParcel) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F7FBFF]">
        <TopNav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-28 sm:px-6">
          <header className="overflow-hidden rounded-[2rem] bg-[#0D1B2A] px-5 py-8 text-white shadow-[0_28px_80px_-55px_rgba(13,27,42,0.75)] sm:px-8 sm:py-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
              <ShieldCheck className="h-3.5 w-3.5" /> {DONE_FOR_YOU_INVESTIGATION_NAME} · R999
            </div>
            <h1 className="mt-4 max-w-4xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
              {DONE_FOR_YOU_INVESTIGATION_TAGLINE}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/68 sm:text-base">
              Easy Erf works through the standard property investigation for you and delivers the Human-Reviewed Easy Erf Report. First confirm the exact property: Erf numbers repeat across South Africa, so we will not start from a typed Erf number alone.
            </p>
          </header>

          <HumanReviewProof />

          <section className="mt-6 rounded-[2rem] border border-[#0D1B2A]/10 bg-white p-6 shadow-soft sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFF3E8] text-[#B24A00]">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
                  Property confirmation required
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
                  Find the exact erf or address on the map first.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">
                  Search by address or Erf with location context. Review the highlighted parcel and official identifiers, open the correct property, then hand that confirmed parcel to Easy Erf.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["1", "Search", "Use address search or Erf search with place context."],
                ["2", "Review on map", "Check the highlighted parcel and official property details."],
                ["3", "Confirm property", "Then choose the R999 done-for-you investigation."],
              ].map(([number, title, body]) => (
                <div key={number} className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-[#0D1B2A] text-xs font-bold text-white">{number}</div>
                  <div className="mt-3 text-sm font-semibold text-[#0D1B2A]">{title}</div>
                  <p className="mt-1 text-xs leading-5 text-[#64748B]">{body}</p>
                </div>
              ))}
            </div>
            <Link
              to="/"
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-6 py-3 text-sm font-semibold text-white hover:bg-[#ff7d1f]"
            >
              Find and confirm property on map <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F7FBFF]">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-28 sm:px-6">
        <header className="overflow-hidden rounded-[2rem] bg-[#0D1B2A] px-5 py-8 text-white shadow-[0_28px_80px_-55px_rgba(13,27,42,0.75)] sm:px-8 sm:py-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFB86B]">
            <ShieldCheck className="h-3.5 w-3.5" /> {DONE_FOR_YOU_INVESTIGATION_NAME} · R999
          </div>
          <h1 className="mt-4 max-w-4xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            {DONE_FOR_YOU_INVESTIGATION_TAGLINE}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/68 sm:text-base">
            This exact parcel is confirmed. Easy Erf will reuse anything already completed, work through the standard investigation as far as the evidence allows, and have a human reviewer check the result before delivery.
          </p>
          <div className="mt-6 max-w-3xl rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Confirmed property</div>
            <div className="mt-1 text-sm font-semibold text-white">{propertyReference}</div>
            <div className="mt-1 break-all text-[11px] text-white/50">Parcel ID: {parcelId}</div>
            <p className="mt-2 text-xs leading-5 text-white/55">
              The done-for-you investigation is locked to this parcel. If this is not the correct property, change it before payment.
            </p>
            <Link to="/" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#FFB86B] hover:text-white">
              Change property on map <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <HumanReviewProof />

        <section className="mt-6 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white px-5 py-4 shadow-soft sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-[#0D1B2A]">Your investigation stays in your Easy Erf account</div>
              <p className="mt-1 text-xs leading-5 text-[#64748B]">
                {signedInEmail
                  ? `Signed in as ${signedInEmail}. Your paid investigation, progress and completed report will stay in this account.`
                  : "Sign in before payment so the paid done-for-you investigation, progress and completed report remain attached to the same account."}
              </p>
            </div>
            {authReady && !signedInEmail ? (
              <Link to="/auth" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-[#0D1B2A]/10 bg-[#F7FBFF] px-4 py-2 text-sm font-semibold text-[#0D1B2A] hover:border-[#FF6A00]/40">
                Sign in / create account
              </Link>
            ) : null}
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-soft sm:p-7">
          <div className="max-w-3xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">Step 1 · Tell us what matters most</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0D1B2A]">Where should the reviewer put extra attention?</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              Every R999 order includes the standard Easy Erf investigation. This choice sets the emphasis; it does not reduce the work to one narrow question.
            </p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {HUMAN_REVIEW_FOCUS_OPTIONS.map((option) => {
              const selected = focus === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFocus(option.id)}
                  className={selected ? "rounded-[1.35rem] border-2 border-[#FF6A00] bg-[#FFF7ED] p-5 text-left shadow-sm" : "rounded-[1.35rem] border border-[#0D1B2A]/10 bg-white p-5 text-left transition hover:border-[#FF6A00]/40 hover:bg-[#fffaf2]"}
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
              <div className="text-sm font-semibold text-[#0D1B2A]">Choose the intended use to emphasize</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {HUMAN_REVIEW_INTENDED_USE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setIntendedUse(option.id)}
                    className={intendedUse === option.id ? "rounded-2xl border border-[#FF6A00] bg-white px-4 py-3 text-left text-sm font-semibold text-[#0D1B2A] ring-2 ring-[#FF6A00]/10" : "rounded-2xl border border-[#D9E6F2] bg-white px-4 py-3 text-left text-sm font-semibold text-[#0D1B2A] hover:border-[#FF6A00]/40"}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-soft sm:p-7">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">Step 2 · Optional context</div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#0D1B2A]">Tell the reviewer what you are considering.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">
            Example: “I’m considering buying this vacant erf and eventually building a family home.” This helps prioritize the investigation but does not create professional-advice scope.
          </p>
          <textarea
            value={context}
            onChange={(event) => setContext(event.target.value)}
            maxLength={HUMAN_REVIEW_CONTEXT_MAX_LENGTH}
            rows={5}
            placeholder="Optional situation context"
            className="mt-4 w-full resize-y rounded-[1.25rem] border border-[#D9E6F2] bg-[#F7FBFF] px-4 py-3 text-sm leading-6 text-[#0D1B2A] outline-none focus:border-[#FF6A00]"
          />
          <div className="mt-1 text-right text-[10px] text-[#64748B]">{context.length}/{HUMAN_REVIEW_CONTEXT_MAX_LENGTH}</div>
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
              <div key={item} className="rounded-2xl border border-[#F59E0B]/20 bg-white/80 px-4 py-3 text-xs leading-5 text-[#0D1B2A]/72">{item}</div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-[#92400E]">
            Easy Erf may use builder/QS/customer-supplied costs in deterministic scenario calculations, but the R999 investigation does not invent a construction quotation or per-m² build-cost estimate.
          </p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#F59E0B]/25 bg-white/90 p-4">
            <input type="checkbox" checked={scopeAcknowledged} onChange={(event) => setScopeAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF6A00]" />
            <span className="text-sm leading-6 text-[#0D1B2A]"><strong>Required:</strong> {HUMAN_REVIEW_SCOPE_ACKNOWLEDGEMENT}</span>
          </label>
        </section>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-[#FF6A00]/30 bg-white shadow-soft">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.55fr)]">
            <div className="p-5 sm:p-7">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">Your investigation brief</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0D1B2A]">{selectedFocus?.label ?? "Choose an emphasis above"}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748B]">Confirmed property: {propertyReference}</p>
              <p className="mt-1 break-all text-[11px] text-[#64748B]">Parcel ID: {parcelId}</p>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#0D1B2A]">
                The standard Easy Erf investigation is included. The selected option tells the reviewer where to spend extra attention.
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
                {checkoutLoading ? "Opening secure checkout…" : "Investigate this property for me · R999"}
                <ArrowUpRight className="h-4 w-4" />
              </button>
              {!focus ? <p className="mt-2 text-xs text-[#64748B]">Choose what matters most first.</p> : null}
              {focus === "intended_use" && !intendedUse ? <p className="mt-2 text-xs text-[#64748B]">Choose the intended use first.</p> : null}
              {focus && (focus !== "intended_use" || intendedUse) && !scopeAcknowledged ? <p className="mt-2 text-xs text-[#64748B]">Acknowledge the investigation scope before checkout.</p> : null}
              {checkoutError ? <p className="mt-2 text-xs font-medium text-destructive">{checkoutError}</p> : null}
              {checkoutError === SIGN_IN_REQUIRED_MESSAGE ? (
                <Link to="/auth" className="mt-2 inline-flex text-xs font-semibold text-[#0D1B2A] underline decoration-[#FF6A00]/40 underline-offset-4">Sign in, then return to this property</Link>
              ) : null}
              <p className="mt-3 text-[11px] leading-5 text-[#64748B]">
                One-time R999 payment. No recurring subscription. Stripe handles payment only. Your confirmed property and investigation brief stay in Easy Erf. After payment you return to My Reports.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white p-5">
          <FileCheck2 className="h-5 w-5 text-[#FF6A00]" />
          <h2 className="mt-3 text-lg font-semibold text-[#0D1B2A]">Already started the investigation yourself?</h2>
          <p className="mt-2 text-sm leading-6 text-[#64748B]">
            We do not throw that work away. The done-for-you service uses the same confirmed parcel and property file, reviews what is already complete, then continues the standard investigation from there.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
