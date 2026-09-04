import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileSearch2,
  ListChecks,
  PlayCircle,
  ReceiptText,
  RotateCcw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { FounderHumanReviewEditor } from "@/components/admin/FounderHumanReviewEditor";
import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { supabase } from "@/integrations/supabase/client";
import {
  isHumanReviewInvestigationChecklistResolved,
  isHumanReviewReportContentComplete,
  parseHumanReviewInvestigationChecklist,
} from "@/lib/humanReview/reportContent";
import {
  DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY,
  DONE_FOR_YOU_STANDARD_INVESTIGATION_ITEMS,
  humanReviewFocusLabel,
  humanReviewIntendedUseLabel,
} from "@/lib/humanReview/scope";
import { buildSavedParcelMapHref } from "@/lib/parcels/officialParcelId";

export const Route = createFileRoute("/admin_/fulfillment")({
  head: () => ({
    meta: [
      { title: "Done-for-You Investigation Queue | Easy Erf" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FounderFulfillmentPage,
});

type ReportOrder = {
  id: string;
  user_id: string | null;
  parcel_id: string | null;
  report_type: string;
  status: string;
  status_enum: string | null;
  provider: string;
  payload: unknown;
  price_cents: number;
  pdf_storage_path: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  review_focus: string | null;
  intended_use: string | null;
  review_context: string | null;
  review_content: unknown;
  review_content_updated_at: string | null;
};

type FulfillmentAction = "start_review" | "reopen_review" | "mark_ready" | "mark_failed";

function FounderFulfillmentPage() {
  return (
    <AdminGuard>
      <FounderFulfillmentQueue />
    </AdminGuard>
  );
}

function FounderFulfillmentQueue() {
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("report_orders")
      .select(
        "id,user_id,parcel_id,report_type,status,status_enum,provider,payload,price_cents,pdf_storage_path,failure_reason,created_at,updated_at,completed_at,review_focus,intended_use,review_context,review_content,review_content_updated_at",
      )
      .eq("provider", "stripe")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error("Could not load the done-for-you investigation queue.");
      setLoading(false);
      return;
    }

    setOrders((data ?? []) as ReportOrder[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (loading || typeof window === "undefined" || !window.location.hash.startsWith("#order-")) return;
    const id = window.location.hash.slice(1);
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [loading, orders]);

  async function transition(
    order: ReportOrder,
    action: FulfillmentAction,
    values: { pdfStoragePath?: string; failureReason?: string } = {},
  ) {
    setBusyOrderId(order.id);
    const { data, error } = await supabase.functions.invoke("easy-erf-founder-fulfillment", {
      body: {
        orderId: order.id,
        action,
        ...(values.pdfStoragePath ? { pdfStoragePath: values.pdfStoragePath } : {}),
        ...(values.failureReason ? { failureReason: values.failureReason } : {}),
      },
    });
    setBusyOrderId(null);

    if (error || !data?.ok) {
      toast.error(data?.error ?? error?.message ?? "Fulfillment action failed.");
      return;
    }

    toast.success(
      action === "start_review"
        ? "Done-for-you investigation started"
        : action === "reopen_review"
          ? "Investigation reopened"
          : action === "mark_ready"
            ? "Report marked ready"
            : "Order marked failed",
    );
    await refresh();
  }

  async function uploadReport(order: ReportOrder, file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Select a PDF report file.");
      return;
    }
    if (file.size <= 0 || file.size > 25 * 1024 * 1024) {
      toast.error("The report PDF must be between 1 byte and 25 MB.");
      return;
    }

    setBusyOrderId(order.id);
    try {
      const { data: prepared, error: prepareError } = await supabase.functions.invoke(
        "easy-erf-founder-report-upload",
        { body: { orderId: order.id, sizeBytes: file.size } },
      );

      if (prepareError || !prepared?.ok || !prepared?.path || !prepared?.token) {
        toast.error(prepared?.error ?? prepareError?.message ?? "Could not prepare secure report upload.");
        return;
      }

      const { error: uploadError } = await supabase.storage
        .from("erf-files")
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: "application/pdf" });

      if (uploadError) {
        toast.error(uploadError.message || "Report upload failed.");
        return;
      }

      const { data: completed, error: completeError } = await supabase.functions.invoke(
        "easy-erf-founder-fulfillment",
        {
          body: {
            orderId: order.id,
            action: "mark_ready",
            pdfStoragePath: prepared.path,
          },
        },
      );

      if (completeError || !completed?.ok) {
        toast.error(completed?.error ?? completeError?.message ?? "Report uploaded but could not be marked ready.");
        return;
      }

      toast.success("PDF export uploaded securely and report marked ready");
      await refresh();
    } finally {
      setBusyOrderId(null);
    }
  }

  const prioritizedOrders = useMemo(
    () => [...orders].sort((a, b) => orderPriority(a) - orderPriority(b) || Date.parse(a.created_at) - Date.parse(b.created_at)),
    [orders],
  );
  const needsAction = useMemo(
    () => prioritizedOrders.filter((order) => orderStatus(order) !== "ready"),
    [prioritizedOrders],
  );
  const completed = useMemo(
    () => prioritizedOrders.filter((order) => orderStatus(order) === "ready"),
    [prioritizedOrders],
  );
  const nextOrder = needsAction[0] ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-[#F7FBFF]">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-28 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
              <ReceiptText className="h-3 w-3 text-[#FF8A33]" /> Done-for-You Operations
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0D1B2A] md:text-3xl">
              Property investigation work queue
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#64748B]">
              This is not a quick final-check queue. For each paid property, complete or review the standard Easy Erf investigation, then human-review the findings and deliver the structured report.
            </p>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:bg-[#fff8ec]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Founder Operations
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric label="Waiting to start" value={orders.filter((order) => orderStatus(order) === "paid").length} />
          <Metric label="Investigation in progress" value={orders.filter((order) => orderStatus(order) === "processing").length} />
          <Metric label="Reports delivered" value={orders.filter((order) => orderStatus(order) === "ready").length} />
        </div>

        {!loading ? <NextWorkPanel order={nextOrder} /> : null}

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">Needs action</div>
              <h2 className="mt-1 text-xl font-semibold text-[#0D1B2A]">Do these property investigations first</h2>
              <p className="mt-1 text-xs leading-5 text-[#64748B]">
                Start the investigation, open the canonical property file, work through the standard checklist, write all report sections, save, then mark the web report ready.
              </p>
            </div>
            <div className="rounded-full bg-[#0D1B2A] px-3 py-1 text-xs font-semibold text-white">{needsAction.length} open</div>
          </div>

          <div className="mt-4 space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-[#0D1B2A]/10 bg-white p-6 text-sm text-[#64748B]">Loading paid investigations…</div>
            ) : needsAction.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50 p-6 text-center">
                <div className="text-sm font-semibold text-[#0D1B2A]">No done-for-you investigations need action right now</div>
                <p className="mt-1 text-xs text-[#64748B]">New verified Stripe payments will appear here automatically.</p>
              </div>
            ) : (
              needsAction.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  busy={busyOrderId === order.id}
                  onTransition={transition}
                  onUploadReport={uploadReport}
                  onRefresh={refresh}
                />
              ))
            )}
          </div>
        </section>

        {completed.length > 0 ? (
          <details className="mt-10 rounded-[2rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-soft sm:p-6">
            <summary className="cursor-pointer list-none text-sm font-semibold text-[#0D1B2A]">
              Delivered Done-for-You Investigations · {completed.length}
            </summary>
            <p className="mt-1 text-xs text-[#64748B]">
              Completed reports are kept here for correction/replacement work without cluttering the active queue.
            </p>
            <div className="mt-4 space-y-4">
              {completed.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  busy={busyOrderId === order.id}
                  onTransition={transition}
                  onUploadReport={uploadReport}
                  onRefresh={refresh}
                />
              ))}
            </div>
          </details>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}

function NextWorkPanel({ order }: { order: ReportOrder | null }) {
  if (!order) {
    return (
      <div className="mt-6 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-50 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Nothing is waiting for you
        </div>
      </div>
    );
  }

  const status = orderStatus(order);
  const propertyReference = payloadText(order.payload, "propertyReference") ?? order.parcel_id ?? "Property reference pending";
  const action =
    status === "paid"
      ? "Start the investigation, open the canonical property file, then work through the standard Easy Erf checklist."
      : status === "processing"
        ? "Finish the standard investigation and evidence review, complete the five-part report, save it, then mark the web report ready."
        : "Resolve the failure before this customer can receive a report.";

  return (
    <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-[#FF6A00]/30 bg-white shadow-soft">
      <div className="grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
        <div className="bg-[#FF6A00] px-5 py-4 text-white lg:self-stretch lg:py-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Start here</div>
          <div className="mt-1 text-lg font-semibold">Next founder action</div>
        </div>
        <div className="px-5 py-4">
          <div className="text-sm font-semibold text-[#0D1B2A]">{propertyReference}</div>
          <p className="mt-1 text-xs leading-5 text-[#64748B]">{action}</p>
        </div>
        <a href={`#order-${order.id}`} className="mx-5 mb-4 inline-flex min-h-10 items-center justify-center rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white lg:mx-5 lg:mb-0">
          Go to this investigation
        </a>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  busy,
  onTransition,
  onUploadReport,
  onRefresh,
}: {
  order: ReportOrder;
  busy: boolean;
  onTransition: (order: ReportOrder, action: FulfillmentAction, values?: { pdfStoragePath?: string; failureReason?: string }) => Promise<void>;
  onUploadReport: (order: ReportOrder, file: File) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const status = orderStatus(order);
  const propertyReference = payloadText(order.payload, "propertyReference");
  const customerEmail = payloadText(order.payload, "customerEmail");
  const legacyRequest = payloadText(order.payload, "investigationRequest");
  const propertyHref = order.parcel_id ? buildSavedParcelMapHref(order.parcel_id) : null;

  return (
    <article id={`order-${order.id}`} className="scroll-mt-28 rounded-[2rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className="font-mono text-[10px] text-[#64748B]">{order.id.slice(0, 8)}</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-[#0D1B2A]">{propertyReference ?? order.parcel_id ?? "Property reference pending"}</h2>
          <p className="mt-1 text-xs text-[#64748B]">{customerEmail ?? "Customer email unavailable"}</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums text-[#0D1B2A]">R{(order.price_cents / 100).toFixed(0)}</div>
          <div className="mt-1 text-[10px] text-[#64748B]">{new Date(order.created_at).toLocaleString("en-ZA")}</div>
        </div>
      </div>

      <FounderActionGuide status={status} propertyHref={propertyHref} />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Info label="Canonical parcel" value={order.parcel_id ?? "Not matched"} mono />
        <Info label="Customer emphasis" value={order.review_focus ? humanReviewFocusLabel(order.review_focus) : "Legacy order — no emphasis recorded"} />
        {humanReviewIntendedUseLabel(order.intended_use) ? <Info label="Intended use" value={humanReviewIntendedUseLabel(order.intended_use)!} /> : null}
        <Info label="Situation context" value={order.review_context ?? legacyRequest ?? "No situation context supplied"} />
      </div>

      {!order.review_focus ? (
        <div className="mt-4 rounded-2xl border border-[#F59E0B]/25 bg-[#fffbeb] p-3 text-xs leading-5 text-[#92400E]">
          This is a legacy paid order. Any old free-text checkout note is context only and must not be treated as authority to provide legal, engineering, valuation, build-cost or investment advice.
        </div>
      ) : null}

      {order.failure_reason ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {order.failure_reason}
        </div>
      ) : null}

      {status === "processing" || status === "ready" ? (
        <FounderHumanReviewEditor
          orderId={order.id}
          initialContent={order.review_content}
          disabled={busy || status === "ready"}
          defaultOpen={status === "processing"}
          onSaved={onRefresh}
        />
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {status === "paid" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onTransition(order, "start_review")}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            <PlayCircle className="h-3.5 w-3.5" /> Start Done-for-You Investigation
          </button>
        ) : null}
        {status === "processing" ? <ReadyAction order={order} busy={busy} onUploadReport={onUploadReport} onTransition={onTransition} /> : null}
        {status === "ready" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onTransition(order, "reopen_review")}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#FF6A00]/35 bg-[#FFF7ED] px-4 py-2 text-xs font-semibold text-[#0D1B2A] disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#FF6A00]" /> Reopen / replace report
          </button>
        ) : null}
        {status === "paid" || status === "processing" ? <FailedAction order={order} busy={busy} onTransition={onTransition} /> : null}
      </div>
    </article>
  );
}

function FounderActionGuide({ status, propertyHref }: { status: string; propertyHref: string | null }) {
  const statusIntro =
    status === "paid"
      ? "Start this order, then complete/review the full standard investigation before writing the final report."
      : status === "processing"
        ? "The investigation is underway. Work through every applicable item below, then write and deliver the final report."
        : status === "failed"
          ? "Resolve the failure before continuing the investigation."
          : "Delivered. Reopen only when you intend to correct or replace the report.";

  return (
    <div className="mt-5 rounded-[1.25rem] border border-[#FF6A00]/20 bg-[#FFF7ED] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0D1B2A]">
            <ListChecks className="h-4 w-4 text-[#FF6A00]" /> Standard done-for-you investigation checklist
          </div>
          <p className="mt-1 text-xs leading-5 text-[#64748B]">{statusIntro}</p>
        </div>
        {propertyHref ? (
          <a href={propertyHref} className="inline-flex items-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] hover:border-[#FF6A00]/35">
            <FileSearch2 className="h-3.5 w-3.5 text-[#FF6A00]" /> Open full property investigation <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      <ol className="mt-4 grid gap-2 md:grid-cols-2">
        {DONE_FOR_YOU_STANDARD_INVESTIGATION_ITEMS.map((step, index) => (
          <li key={step} className="flex gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs leading-5 text-[#0D1B2A]/72">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0D1B2A] text-[10px] font-bold text-white">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-3 rounded-xl border border-[#F59E0B]/25 bg-[#fffbeb] px-3 py-2 text-[11px] leading-5 text-[#92400E]">
        <strong>Included property-data-report rule:</strong> {DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY} If Lightstone or another branded provider is used internally, do not attach or redistribute the provider PDF unless the applicable provider/report terms allow it.
      </div>
    </div>
  );
}

function ReadyAction({
  order,
  busy,
  onUploadReport,
  onTransition,
}: {
  order: ReportOrder;
  busy: boolean;
  onUploadReport: (order: ReportOrder, file: File) => Promise<void>;
  onTransition: (order: ReportOrder, action: FulfillmentAction, values?: { pdfStoragePath?: string; failureReason?: string }) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const reportReady = isHumanReviewReportContentComplete(order.review_content);
  const checklist = parseHumanReviewInvestigationChecklist(order.review_content);
  const checklistReady = Boolean(
    checklist && isHumanReviewInvestigationChecklistResolved(checklist),
  );
  const deliveryReady = reportReady && checklistReady;
  const deliveryBlocker = !reportReady
    ? "Complete and save the reviewed bottom line plus all five report sections first."
    : !checklistReady
      ? "Resolve and save every standard investigation checklist item first."
      : null;

  if (!order.user_id) {
    return <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-[#0D1B2A]">Match this paid order to a customer account before report delivery.</div>;
  }

  return (
    <div className="min-w-[300px] flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !deliveryReady}
          onClick={() => void onTransition(order, "mark_ready")}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          title={deliveryBlocker ?? "Deliver the structured Human-Reviewed web report"}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Mark web report ready
        </button>
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy || !deliveryReady}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="min-w-0 flex-1 rounded-full border border-[#D9E6F2] bg-[#F7FBFF] px-3 py-2 text-xs file:mr-2 file:border-0 file:bg-transparent file:text-xs file:font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          disabled={busy || !file || !deliveryReady}
          onClick={() => file && void onUploadReport(order, file)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          title={deliveryBlocker ?? "Upload the optional PDF and deliver the report"}
        >
          <Upload className="h-3.5 w-3.5" /> Upload optional Easy Erf PDF & mark ready
        </button>
      </div>
      {deliveryBlocker ? (
        <p className="mt-2 text-[11px] leading-5 text-amber-800">{deliveryBlocker}</p>
      ) : (
        <p className="mt-2 text-[11px] leading-5 text-emerald-700">
          The structured report and every applicable checklist item are resolved. Delivery controls are enabled.
        </p>
      )}
    </div>
  );
}

function FailedAction({
  order,
  busy,
  onTransition,
}: {
  order: ReportOrder;
  busy: boolean;
  onTransition: (order: ReportOrder, action: FulfillmentAction, values?: { failureReason?: string }) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="flex min-w-[280px] flex-1 gap-2">
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Failure reason"
        className="min-w-0 flex-1 rounded-full border border-[#D9E6F2] bg-white px-3 py-2 text-xs outline-none focus:border-[#FF6A00]"
      />
      <button
        type="button"
        disabled={busy || !reason.trim()}
        onClick={() => void onTransition(order, "mark_failed", { failureReason: reason.trim() })}
        className="rounded-full border border-destructive/30 px-4 py-2 text-xs font-semibold text-destructive disabled:opacity-50"
      >
        Mark failed
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#0D1B2A]/10 bg-white p-4 shadow-soft">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-[#0D1B2A]">{value}</div>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-[#F7FBFF] p-3 ring-1 ring-[#D9E6F2]/80">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">{label}</div>
      <div className={mono ? "mt-1 break-all font-mono text-[11px] text-[#0D1B2A]" : "mt-1 text-xs leading-5 text-[#0D1B2A]"}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const Icon = status === "ready" ? CheckCircle2 : status === "failed" ? AlertCircle : status === "processing" ? CircleDashed : ReceiptText;
  const label = status === "paid" ? "Payment received · waiting to start" : status === "processing" ? "Investigation underway" : status === "ready" ? "Report delivered" : status;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
      <Icon className="h-3 w-3 text-[#FF8A33]" /> {label}
    </span>
  );
}

function orderStatus(order: ReportOrder) {
  const status = (order.status_enum || order.status || "pending").toLowerCase();
  return status === "fulfilling" ? "processing" : status === "complete" ? "ready" : status;
}

function orderPriority(order: ReportOrder) {
  const status = orderStatus(order);
  return status === "paid" ? 0 : status === "processing" ? 1 : status === "failed" ? 2 : 3;
}

function payloadText(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
