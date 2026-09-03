import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  CircleX,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/launch-readiness")({
  head: () => ({
    meta: [
      { title: "R999 Launch Readiness | Easy Erf" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FounderLaunchReadinessPage,
});

type LaunchCheck = {
  id: string;
  label: string;
  status: "pass" | "fail" | "unknown";
  detail: string;
  blocking: boolean;
  inspectable: boolean;
};

type LaunchReadinessResponse = {
  ok: true;
  observedAt: string;
  requestId: string;
  state:
    | "invalid_configuration"
    | "test_mode"
    | "live_disarmed_blocked"
    | "live_disarmed_preflight_passed"
    | "live_armed_blocked"
    | "live_armed_preflight_passed";
  checkoutMode: "test" | "live" | "invalid";
  liveArmed: boolean;
  liveCheckoutGateOpen: boolean;
  inspectablePreflightPassed: boolean;
  readyForControlledSignatureTest: boolean;
  signatureSecretMatch: "not_verified";
  checks: LaunchCheck[];
};

function FounderLaunchReadinessPage() {
  return (
    <AdminGuard>
      <FounderLaunchReadiness />
    </AdminGuard>
  );
}

function FounderLaunchReadiness() {
  const [readiness, setReadiness] = useState<LaunchReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runPreflight = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke(
      "easy-erf-founder-launch-readiness",
      { body: {} },
    );

    if (invokeError || !data?.ok) {
      setReadiness(null);
      setError(data?.error ?? invokeError?.message ?? "Launch preflight could not be completed.");
      setLoading(false);
      return;
    }

    setReadiness(data as LaunchReadinessResponse);
    setLoading(false);
  }, []);

  useEffect(() => {
    void runPreflight();
  }, [runPreflight]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F7FBFF]">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-28 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
              <ShieldCheck className="h-3.5 w-3.5 text-[#FF8A33]" /> Founder launch control
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0D1B2A] md:text-3xl">
              R999 live-launch preflight
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#64748B]">
              Read-only inspection of the Easy Erf checkout, Stripe account, Payment Link and webhook configuration. This screen cannot arm checkout, change a secret, create an order or charge a customer.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runPreflight()}
              disabled={loading}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142941] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Run preflight
            </button>
            <Link
              to="/admin"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:bg-[#fff8ec]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Founder Operations
            </Link>
          </div>
        </div>

        {loading ? (
          <section className="mt-7 rounded-[2rem] border border-[#0D1B2A]/10 bg-white p-7 shadow-soft">
            <div className="flex items-center gap-3 text-sm font-semibold text-[#0D1B2A]">
              <RefreshCw className="h-4 w-4 animate-spin text-[#FF6A00]" /> Inspecting safe runtime signals
            </div>
            <p className="mt-2 text-xs leading-5 text-[#64748B]">
              No secret values or customer records are returned.
            </p>
          </section>
        ) : error ? (
          <section className="mt-7 rounded-[2rem] border border-rose-300 bg-rose-50 p-7">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-900">
              <CircleX className="h-4 w-4" /> Preflight unavailable
            </div>
            <p className="mt-2 text-xs leading-5 text-rose-800">{error}</p>
            <p className="mt-3 text-[11px] leading-5 text-rose-700">
              This does not prove checkout is safe or unsafe. It means the founder-only preflight itself could not produce evidence.
            </p>
          </section>
        ) : readiness ? (
          <>
            <ReadinessBanner readiness={readiness} />

            <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Runtime mode"
                value={readiness.checkoutMode.toUpperCase()}
                detail={readiness.checkoutMode === "live" ? "Live configuration selected" : "Live launch not selected"}
              />
              <Metric
                label="Arming flag"
                value={readiness.liveArmed ? "ON" : "OFF"}
                detail={readiness.liveArmed ? "Live gate may be open" : "Required during preflight"}
                danger={readiness.liveArmed}
              />
              <Metric
                label="Inspectable checks"
                value={readiness.inspectablePreflightPassed ? "PASSED" : "BLOCKED"}
                detail="Excludes signing-secret match proof"
              />
              <Metric
                label="Signature match"
                value="NOT VERIFIED"
                detail="Requires a controlled signed event"
              />
            </section>

            <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#0D1B2A]/10 bg-white shadow-soft">
              <div className="border-b border-[#0D1B2A]/8 bg-[#FBF8F1] px-5 py-4 sm:px-6">
                <h2 className="text-sm font-semibold text-[#0D1B2A]">Launch gates</h2>
                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  A failed or unknown blocking item prevents a truthful live-launch approval.
                </p>
              </div>
              <div className="divide-y divide-[#0D1B2A]/8">
                {readiness.checks.map((item) => (
                  <CheckRow key={item.id} check={item} />
                ))}
              </div>
            </section>

            <section className="mt-7 rounded-[2rem] border border-[#0D1B2A]/10 bg-[#0D1B2A] p-6 text-white sm:p-7">
              <h2 className="text-lg font-semibold">Controlled next-step boundary</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <BoundaryStep
                  number="1"
                  title="Resolve preflight failures"
                  body="Correct only the specific failed configuration or Stripe business-profile items shown above."
                />
                <BoundaryStep
                  number="2"
                  title="Prove webhook signing"
                  body="Send one separately approved signed test event and verify the existing webhook accepts it without creating a paid order."
                />
                <BoundaryStep
                  number="3"
                  title="Approve live arming and canary"
                  body="Only after independent evidence, separately approve the arming flag and one controlled real R999 purchase."
                />
              </div>
              <p className="mt-5 text-[11px] leading-5 text-white/55">
                Repository merge, Supabase deployment, Stripe profile edits, secret changes, live arming and a real charge remain separate owner-controlled actions.
              </p>
            </section>

            <p className="mt-4 text-[10px] text-[#64748B]">
              Observed {formatObservedAt(readiness.observedAt)} · Request {readiness.requestId}
            </p>
          </>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}

function ReadinessBanner({ readiness }: { readiness: LaunchReadinessResponse }) {
  if (readiness.liveCheckoutGateOpen) {
    return (
      <section className="mt-7 rounded-[2rem] border border-rose-400 bg-rose-50 p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
          <div>
            <h2 className="text-lg font-semibold text-rose-950">Live checkout gate appears open</h2>
            <p className="mt-2 text-sm leading-6 text-rose-800">
              The runtime is in LIVE mode, the arming flag is ON and a live R999 Payment Link passed the checkout contract. This is a risk signal, not proof that fulfillment is launch ready.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (readiness.readyForControlledSignatureTest) {
    return (
      <section className="mt-7 rounded-[2rem] border border-emerald-400 bg-emerald-50 p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <h2 className="text-lg font-semibold text-emerald-950">
              Inspectable preflight passed while live checkout remains disarmed
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              The next valid action is a separately approved signed-webhook test. This is not live-launch approval and does not authorize a real payment.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-7 rounded-[2rem] border border-amber-300 bg-amber-50 p-6 sm:p-7">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <h2 className="text-lg font-semibold text-amber-950">Live launch remains blocked</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Resolve the failed inspectable gates below. Unknown evidence must remain unknown, and the signing-secret match still requires a controlled test.
          </p>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
  danger = false,
}: {
  label: string;
  value: string;
  detail: string;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-white p-4 ${danger ? "border-rose-300" : "border-[#0D1B2A]/10"}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#64748B]">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${danger ? "text-rose-700" : "text-[#0D1B2A]"}`}>
        {value}
      </div>
      <p className="mt-1 text-[11px] leading-4 text-[#64748B]">{detail}</p>
    </div>
  );
}

function CheckRow({ check }: { check: LaunchCheck }) {
  const Icon = check.status === "pass" ? CheckCircle2 : check.status === "fail" ? CircleX : CircleHelp;
  const tone = check.status === "pass"
    ? "bg-emerald-100 text-emerald-800"
    : check.status === "fail"
      ? "bg-rose-100 text-rose-800"
      : "bg-slate-100 text-slate-700";

  return (
    <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
      <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${tone}`}>
        <Icon className="h-3 w-3" /> {check.status}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-[#0D1B2A]">{check.label}</h3>
          {check.blocking ? (
            <span className="rounded-full border border-[#0D1B2A]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#64748B]">
              Launch gate
            </span>
          ) : null}
          {!check.inspectable ? (
            <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600">
              Separate proof required
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-5 text-[#64748B]">{check.detail}</p>
      </div>
    </div>
  );
}

function BoundaryStep({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <div className="grid h-7 w-7 place-items-center rounded-full bg-[#FF6A00] text-xs font-bold text-white">
        {number}
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-white/65">{body}</p>
    </div>
  );
}

function formatObservedAt(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "unknown time" : parsed.toLocaleString("en-ZA");
}
