import { useState } from "react";
import { FileText, Lock, ShoppingCart, Check } from "lucide-react";
import { REPORT_CATALOG, formatPrice } from "@/lib/reports/catalog";
import { ComplianceNotice } from "@/components/common/ComplianceNotice";
import { SourceBadge } from "@/components/data/SourceBadge";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ReportsTab({ parcelId, summary }: { parcelId: string; summary: string }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, setPending] = useState(false);

  function startOrder(id: string) {
    if (!user) { toast.message("Sign in to order a report"); return; }
    setSelected(id); setStep(2);
  }

  async function confirm() {
    const def = REPORT_CATALOG.find((r) => r.id === selected);
    if (!def || !user) return;
    setPending(true);
    const { error } = await supabase.from("report_orders").insert({
      user_id: user.id,
      parcel_id: parcelId,
      report_type: def.id,
      status: "pending",
      price_cents: def.priceCents,
      provider: "lightstone",
      payload: { placeholder: true, summary, createdAt: new Date().toISOString() },
    });
    setPending(false);
    if (error) { toast.error(error.message); return; }
    setStep(3);
    toast.success("Order placed (pending)");
  }

  function reset() { setSelected(null); setStep(1); }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Property reports</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Order official third-party reports when you need verified data.
        </p>
      </div>

      {step === 1 && (
        <div className="grid gap-3">
          {REPORT_CATALOG.map((r) => (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-brand text-white">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{r.name}</div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{r.description}</p>
                    <div className="mt-1 text-[10px] text-muted-foreground">{r.providerHint} · {r.estTurnaround}</div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13px] font-semibold tabular-nums">{formatPrice(r.priceCents)}</div>
                  {r.available ? (
                    <button onClick={() => startOrder(r.id)}
                      className="mt-1 inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-semibold text-background hover:opacity-90">
                      <ShoppingCart className="h-3 w-3" /> Order
                    </button>
                  ) : (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Lock className="h-2.5 w-2.5" /> Coming Soon
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {step === 2 && selected && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Step 2 of 3 · Confirm property</div>
          <h4 className="mt-1 text-base font-semibold">{REPORT_CATALOG.find((r) => r.id === selected)?.name}</h4>
          <p className="mt-2 text-xs text-muted-foreground">For property: <span className="font-medium text-foreground">{summary}</span></p>
          <div className="mt-3 rounded-xl bg-muted/60 p-3 text-[11px] text-muted-foreground">
            Reports are provided by third-party data providers. PropertyAtlas does not alter official report data.
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={reset} className="rounded-full border border-border px-3 py-1.5 text-xs">Back</button>
            <button onClick={confirm} disabled={pending}
              className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-60">
              {pending ? "Placing order…" : "Proceed to checkout"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && selected && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-200">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Check className="h-4 w-4" /> Order placed — status: Pending
          </div>
          <p className="mt-1 text-xs">
            We've logged your order for the {REPORT_CATALOG.find((r) => r.id === selected)?.name}. You'll be notified once the
            provider integration is live and the report is generated. No payment has been processed at this stage.
          </p>
          <button onClick={reset} className="mt-3 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90">
            Order another report
          </button>
        </div>
      )}

      <ComplianceNotice />
      <SourceBadge source="lightstone" />
    </div>
  );
}
