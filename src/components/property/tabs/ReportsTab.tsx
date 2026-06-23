import { useEffect, useState } from "react";
import { FileText, Lock, BellRing, BookmarkPlus, Check, ExternalLink } from "lucide-react";
import { REPORT_CATALOG, formatPrice } from "@/lib/reports/catalog";
import { ComplianceNotice } from "@/components/common/ComplianceNotice";
import { SourceBadge } from "@/components/data/SourceBadge";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { openExternalUrl } from "@/lib/external";
import type { SgDocumentResult } from "@/lib/research/sgDocument";
import { CSG_OFFICIAL_URL } from "@/lib/external-urls";
import { toast } from "sonner";

type InterestKind = "notify" | "save";

export function ReportsTab({
  parcelId,
  summary,
  sgDoc,
}: {
  parcelId: string;
  summary: string;
  sgDoc?: SgDocumentResult;
}) {
  const { user } = useAuth();
  const [interests, setInterests] = useState<Record<string, InterestKind>>({});
  const reportCatalog = REPORT_CATALOG.filter(
    (report) => report.id !== "sg_diagram" || sgDoc?.shown,
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`pa.reportInterests.${parcelId}`);
      if (raw) setInterests(JSON.parse(raw));
    } catch {
      // Ignore malformed local-only report interest cache.
    }
  }, [parcelId]);

  function persist(next: Record<string, InterestKind>) {
    setInterests(next);
    try {
      window.localStorage.setItem(`pa.reportInterests.${parcelId}`, JSON.stringify(next));
    } catch {
      // Ignore local storage write failures; Supabase persistence still runs for signed-in users.
    }
  }

  async function record(reportId: string, kind: InterestKind) {
    const next = { ...interests, [reportId]: kind };
    persist(next);
    if (user) {
      try {
        await supabase.from("report_orders").insert({
          user_id: user.id,
          parcel_id: parcelId,
          report_type: reportId,
          status: kind === "notify" ? "interest_notify" : "interest_saved",
          price_cents: 0,
          provider: "placeholder",
          payload: { placeholder: true, kind, summary, createdAt: new Date().toISOString() },
        });
      } catch {
        // Keep report interest UX non-blocking while provider/order capture is placeholder-only.
      }
    }
    toast.success(
      kind === "notify" ? "We'll notify you when this is live." : "Saved to your report interests.",
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Property reports</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Official deeds, valuation and SG diagram reports. No payment is taken — provider
          integrations are in progress.
        </p>
      </div>

      <div className="grid gap-3">
        {reportCatalog.map((r) => {
          const interest = interests[r.id];
          const isSg = r.id === "sg_diagram";
          return (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-brand text-white">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{r.name}</div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{r.description}</p>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {r.providerHint} · {r.estTurnaround}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13px] font-semibold tabular-nums text-muted-foreground">
                    {isSg ? "Official source" : formatPrice(r.priceCents)}
                  </div>
                  {!isSg && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      <Lock className="h-2.5 w-2.5" /> Coming Soon
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-2.5">
                {isSg ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => openExternalUrl(sgDoc!.url, e)}
                      className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background hover:opacity-90"
                    >
                      <ExternalLink className="h-3 w-3" /> Open SG Document List
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => record(r.id, "notify")}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
                    >
                      <BellRing className="h-3 w-3" /> Notify me
                    </button>
                    <button
                      type="button"
                      onClick={() => record(r.id, "save")}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
                    >
                      <BookmarkPlus className="h-3 w-3" /> Save report interest
                    </button>
                    {interest && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                        <Check className="h-2.5 w-2.5" />{" "}
                        {interest === "notify" ? "Notify requested" : "Saved"}
                      </span>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground">
        Placeholder only. No payment will be processed. Lightstone and WinDeed integrations will
        activate once their commercial connections are live.
        {!sgDoc?.shown && (
          <button
            type="button"
            onClick={(e) => openExternalUrl(CSG_OFFICIAL_URL, e)}
            className="ml-2 inline-flex items-center gap-1 font-semibold text-foreground hover:underline"
          >
            Open CSG official fallback <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>

      <ComplianceNotice />
      <SourceBadge source="lightstone" />
    </div>
  );
}
