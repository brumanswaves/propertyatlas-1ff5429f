import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ExternalLink,
  FileSearch2,
  ListChecks,
  LockKeyhole,
  PlayCircle,
  ReceiptText,
  RotateCcw,
  TestTube2,
  Upload,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { AdminGuard, useOperationsAccess } from "@/components/admin/AdminGuard";
import { OrderInvestigationWorkspace } from "@/components/humanReview/OrderInvestigationWorkspace";
import { FounderHumanReviewEditor } from "@/components/admin/FounderHumanReviewEditor";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { supabase } from "@/integrations/supabase/client";
import {
  buildFocusedOrderHash,
  founderDeliveryResult,
  founderOrderReviewReasons,
  isLegacyFounderOrder,
  parseFocusedOrderId,
  reportOrderMode,
} from "@/lib/humanReview/founderQueueSafety";
import {
  isLegacyFounderSummary,
  type FounderOrderDetail as ReportOrder,
  type FounderQueueSummary,
} from "@/lib/humanReview/founderQueueData";
import { useFounderOrderData } from "@/lib/humanReview/useFounderOrderData";
import {
  isHumanReviewInvestigationChecklistResolved,
  isHumanReviewReportContentComplete,
  parseHumanReviewInvestigationChecklist,
} from "@/lib/humanReview/reportContent";
import {
  DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY,
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

type FulfillmentAction = "start_review" | "reopen_review" | "mark_ready" | "mark_failed";

type TransitionValues = {
  pdfStoragePath?: string;
  failureReason?: string;
};

function FounderFulfillmentPage() {
  return (
    <AdminGuard allowAssignedInvestigations>
      <FounderFulfillmentQueue />
    </AdminGuard>
  );
}

function FounderFulfillmentQueue() {
  const { isAdmin } = useOperationsAccess();
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [focusedOrderId, setFocusedOrderId] = useState<string | null>(null);
  const { orders, loading, queueError, focusedOrder, detailLoading, refresh } = useFounderOrderData(focusedOrderId, !isAdmin);
  const mutationInFlight = useRef(false);
  const [deliveryNotice, setDeliveryNotice] = useState<{ orderId: string; message: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFocus = () => {
      setDeliveryNotice(null);
      setFocusedOrderId(parseFocusedOrderId(window.location.hash));
    };
    syncFocus();
    window.addEventListener("hashchange", syncFocus);
    return () => window.removeEventListener("hashchange", syncFocus);
  }, []);

  function focusOrder(orderId: string) {
    if (typeof window === "undefined") return;
    const hash = buildFocusedOrderHash(orderId);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
    setFocusedOrderId(orderId.toLowerCase());
    setDeliveryNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exitFocus() {
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setFocusedOrderId(null);
    setDeliveryNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function transition(
    order: ReportOrder,
    action: FulfillmentAction,
    values: TransitionValues = {},
  ) {
    if (mutationInFlight.current || parseFocusedOrderId(window.location.hash) !== order.id.toLowerCase()) return;
    mutationInFlight.current = true;
    setBusyOrderId(order.id);
    try {
    const { data, error } = await supabase.functions.invoke("easy-erf-founder-fulfillment", {
      body: {
        orderId: order.id,
        action,
        ...(values.pdfStoragePath ? { pdfStoragePath: values.pdfStoragePath } : {}),
        ...(values.failureReason ? { failureReason: values.failureReason } : {}),
      },
    });
    if (error || !data?.ok) {
      toast.error(data?.error ?? error?.message ?? "Fulfillment action failed.");
      return;
    }

    if (action === "mark_ready") {
      setDeliveryNotice({ orderId: order.id, message: showDeliveryResult(data.notification) });
    } else {
      toast.success(
        action === "start_review"
          ? "Done-for-You investigation started"
          : action === "reopen_review"
            ? "Investigation reopened and ready to continue"
            : "Investigation stopped. It can be reopened from this order.",
      );
    }

    await refresh();
    } catch {
      toast.error("The fulfillment result could not be confirmed. Refresh this order before retrying.");
    } finally {
      mutationInFlight.current = false;
      setBusyOrderId(null);
    }
  }

  async function uploadReport(order: ReportOrder, file: File) {
    if (mutationInFlight.current || parseFocusedOrderId(window.location.hash) !== order.id.toLowerCase()) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Select a PDF report file.");
      return;
    }
    if (file.size <= 0 || file.size > 25 * 1024 * 1024) {
      toast.error("The report PDF must be between 1 byte and 25 MB.");
      return;
    }

    mutationInFlight.current = true;
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

      setDeliveryNotice({ orderId: order.id, message: showDeliveryResult(completed.notification, true) });
      await refresh();
    } catch {
      toast.error("The upload or delivery result could not be confirmed. Refresh this order before retrying.");
    } finally {
      mutationInFlight.current = false;
      setBusyOrderId(null);
    }
  }

  const prioritizedOrders = useMemo(
    () => [...orders].sort((a, b) => orderPriority(a) - orderPriority(b) || Date.parse(a.created_at) - Date.parse(b.created_at)),
    [orders],
  );
  const currentOrders = useMemo(
    () => prioritizedOrders.filter((order) => !isLegacyFounderSummary(order)),
    [prioritizedOrders],
  );
  const legacyOrders = useMemo(
    () => prioritizedOrders.filter((order) => isLegacyFounderSummary(order)),
    [prioritizedOrders],
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#F7FBFF]">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-36 sm:px-6">
        {queueError ? (
          <section role="alert" className="space-y-3">
            <h1 className="text-xl font-semibold">Investigation queue unavailable</h1>
            <p>Could not load the Done-for-You investigation queue.</p>
            <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded border px-3 py-2">
              <RotateCcw className="h-4 w-4" /> Retry queue
            </button>
          </section>
        ) : focusedOrderId ? (
          <FocusedOrderWorkbench
            key={focusedOrderId}
            order={focusedOrder}
            deliveryNotice={deliveryNotice?.orderId === focusedOrderId ? deliveryNotice.message : null}
            loading={detailLoading}
            busy={Boolean(focusedOrder && busyOrderId === focusedOrder.id)}
            onExit={exitFocus}
            onTransition={transition}
            onUploadReport={uploadReport}
            onRefresh={refresh}
          />
        ) : (
          <QueueOverview
            loading={loading}
            currentOrders={currentOrders}
            legacyOrders={legacyOrders}
            onFocus={focusOrder}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}

function QueueOverview({
  loading,
  currentOrders,
  legacyOrders,
  onFocus,
}: {
  loading: boolean;
  currentOrders: FounderQueueSummary[];
  legacyOrders: FounderQueueSummary[];
  onFocus: (orderId: string) => void;
}) {
  const openCurrent = currentOrders.filter((order) => orderStatus(order) !== "ready");
  const deliveredCurrent = currentOrders.filter((order) => orderStatus(order) === "ready");
  const nextOrder = openCurrent[0] ?? null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            <ReceiptText className="h-3 w-3 text-[#FF8A33]" /> Done-for-You Operations
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0D1B2A] md:text-3xl">
            Property investigation queue
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#64748B]">
            Start with the orange UP NEXT card. It tells you which customer investigation needs attention and gives one clear action.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/users"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#FF6A00]/25 bg-[#FFF7ED] px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:border-[#FF6A00]/50"
          >
            <UsersRound className="h-3.5 w-3.5 text-[#FF6A00]" /> Users & investigators
          </Link>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:bg-[#fff8ec]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Founder Operations
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Waiting to start" value={currentOrders.filter((order) => orderStatus(order) === "paid").length} />
        <Metric label="In progress" value={currentOrders.filter((order) => orderStatus(order) === "processing").length} />
        <Metric label="Needs recovery" value={currentOrders.filter((order) => orderStatus(order) === "failed").length} />
        <Metric label="Delivered" value={deliveredCurrent.length} />
        <Metric label="Legacy format" value={legacyOrders.length} />
      </div>

      {!loading ? <NextWorkPanel order={nextOrder} onFocus={onFocus} /> : null}

      <QueueSection
        title="Current Done-for-You investigations"
        description="Each card represents one customer order. Use its plain-language action to start, continue, recover or view it."
        orders={currentOrders}
        loading={loading}
        empty="No current-format investigations are in the queue."
        onFocus={onFocus}
      />

      {legacyOrders.length > 0 ? (
        <details className="mt-8 rounded-[2rem] border border-amber-300/50 bg-amber-50/60 p-5 sm:p-6">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[#0D1B2A]">
            Legacy-format orders, excluded from the automatic next-action queue · {legacyOrders.length}
          </summary>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[#92400E]">
            These older records may have incomplete property labels or no current investigation brief. Open one only when intentionally correcting or closing that exact order.
          </p>
          <div className="mt-4 space-y-3">
            {legacyOrders.map((order) => (
              <CompactOrderCard key={order.id} order={order} legacy onFocus={onFocus} />
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

function QueueSection({
  title,
  description,
  orders,
  loading,
  empty,
  onFocus,
}: {
  title: string;
  description: string;
  orders: FounderQueueSummary[];
  loading: boolean;
  empty: string;
  onFocus: (orderId: string) => void;
}) {
  return (
    <section className="mt-8">
      <div>
        <h2 className="text-lg font-semibold text-[#0D1B2A]">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[#64748B]">{description}</p>
      </div>
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-[#0D1B2A]/10 bg-white p-6 text-sm text-[#64748B]">Loading paid investigations…</div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50 p-6 text-center text-sm font-semibold text-[#0D1B2A]">
            {empty}
          </div>
        ) : (
          orders.map((order) => <CompactOrderCard key={order.id} order={order} onFocus={onFocus} />)
        )}
      </div>
    </section>
  );
}

function orderActionLabel(status: string) {
  if (status === "paid") return "Start investigation";
  if (status === "processing") return "Continue investigation";
  if (status === "failed") return "Recover investigation";
  if (status === "ready") return "View delivered report";
  return "Open investigation";
}

function CompactOrderCard({
  order,
  legacy = false,
  onFocus,
}: {
  order: FounderQueueSummary;
  legacy?: boolean;
  onFocus: (orderId: string) => void;
}) {
  const propertyReference = order.parcel_id ?? "Property reference pending";
  const mode = order.payment_mode;
  const status = orderStatus(order);

  return (
    <article className="rounded-2xl border border-[#0D1B2A]/10 bg-white p-4 shadow-soft">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <ModeBadge mode={mode} />
            {legacy ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-900">Legacy format</span> : null}
          </div>
          <div className="mt-3 break-all text-sm font-semibold text-[#0D1B2A]">{propertyReference}</div>
          <div className="mt-1 text-xs text-[#64748B]">{status === "failed" ? "This investigation was stopped and can be reopened without deleting its evidence." : "Open this order to continue its exact customer investigation."}</div>
          <div className="mt-2 break-all font-mono text-[10px] text-[#64748B]">Order {order.id}</div>
          <div className="mt-1 break-all font-mono text-[10px] text-[#64748B]">Parcel {order.parcel_id ?? "not matched"}</div>
        </div>
        <button
          type="button"
          onClick={() => onFocus(order.id)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0D1B2A] px-5 py-2 text-xs font-semibold text-white"
        >
          {orderActionLabel(status)} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function NextWorkPanel({ order, onFocus }: { order: FounderQueueSummary | null; onFocus: (orderId: string) => void }) {
  if (!order) {
    return (
      <div className="mt-6 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-50 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> No Done-for-You investigation is waiting for action
        </div>
      </div>
    );
  }

  const propertyReference = order.parcel_id ?? "Property reference pending";
  const status = orderStatus(order);

  return (
    <div className="mt-6 overflow-hidden rounded-[1.5rem] border-2 border-[#FF6A00]/45 bg-white shadow-soft" data-up-next-investigation>
      <div className="grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
        <div className="bg-[#FF6A00] px-5 py-4 text-white lg:self-stretch lg:py-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/80">UP NEXT</div>
          <div className="mt-1 text-lg font-semibold">{orderActionLabel(status)}</div>
        </div>
        <div className="min-w-0 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={status} /><ModeBadge mode={order.payment_mode} /></div>
          <div className="mt-2 break-all text-sm font-semibold text-[#0D1B2A]">{propertyReference}</div>
          <div className="mt-1 text-xs text-[#64748B]">{status === "failed" ? "Reopen this order and continue from the evidence already saved." : "This is the next current-format customer investigation in the queue."}</div>
        </div>
        <button
          type="button"
          onClick={() => onFocus(order.id)}
          className="mx-5 mb-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[#0D1B2A] px-5 py-2 text-xs font-semibold text-white lg:mx-5 lg:mb-0"
        >
          {orderActionLabel(status)}
        </button>
      </div>
    </div>
  );
}

function FocusedOrderWorkbench({
  order,
  deliveryNotice,
  loading,
  busy,
  onExit,
  onTransition,
  onUploadReport,
  onRefresh,
}: {
  order: ReportOrder | null;
  deliveryNotice: string | null;
  loading: boolean;
  busy: boolean;
  onExit: () => void;
  onTransition: (order: ReportOrder, action: FulfillmentAction, values?: TransitionValues) => Promise<void>;
  onUploadReport: (order: ReportOrder, file: File) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const { isAdmin } = useOperationsAccess();
  if (loading) {
    return <div className="rounded-2xl border border-[#0D1B2A]/10 bg-white p-6 text-sm text-[#64748B]">Loading the exact order…</div>;
  }

  if (!order) {
    return (
      <div className="rounded-[2rem] border border-rose-300 bg-rose-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-rose-700" />
          <div>
            <h1 className="text-lg font-semibold text-[#0D1B2A]">The requested order was not found</h1>
            <p className="mt-1 text-sm text-rose-900">No other order has been opened or made actionable.</p>
            <button type="button" onClick={onExit} className="mt-4 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white">Return to queue</button>
          </div>
        </div>
      </div>
    );
  }

  const status = orderStatus(order);
  const propertyReference = payloadText(order.payload, "propertyReference") ?? order.parcel_id ?? "Property reference pending";
  const customerEmail = payloadText(order.payload, "customerEmail") ?? "Customer email unavailable";
  const legacyRequest = payloadText(order.payload, "investigationRequest");
  const propertyHref = order.parcel_id ? buildSavedParcelMapHref(order.parcel_id) : null;
  const mode = reportOrderMode(order.payload);
  const legacy = isLegacyFounderOrder(order);

  return (
    <>
      <header aria-label="Selected order identity" className="sticky top-2 z-40 rounded-lg border-2 border-[#0D1B2A] bg-white p-3 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to investigation queue
          </button>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
            <LockKeyhole className="h-4 w-4" /> One customer order selected
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              <ModeBadge mode={mode} />
              {legacy ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-900">Legacy format</span> : null}
            </div>
            <h1 className="mt-2 text-base font-semibold text-[#0D1B2A]">{propertyReference}</h1>
            <p className="mt-1 break-all text-xs text-[#64748B]">{customerEmail}</p>
            <p className="mt-1 break-all font-mono text-[11px]">Order {order.id}</p>
            <p className="mt-1 break-all font-mono text-[11px]">Canonical parcel: {order.parcel_id ?? "Not matched"}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold tabular-nums text-[#0D1B2A]">R{(order.price_cents / 100).toFixed(0)}</div>
            <div className="mt-1 text-[10px] text-[#64748B]">{new Date(order.created_at).toLocaleString("en-ZA")}</div>
          </div>
        </div>
      </header>

      <section aria-label="Exact order workbench" data-order-id={order.id} className="mt-4 rounded-lg border border-[#0D1B2A]/15 bg-white p-4 sm:p-6">
        <details>
          <summary className="cursor-pointer text-xs font-semibold">Customer request and context</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Info label="Customer emphasis" value={order.review_focus ? humanReviewFocusLabel(order.review_focus) : "Legacy order, no current emphasis"} />
          <Info label="Situation context" value={order.review_context ?? legacyRequest ?? "No situation context supplied"} />
          {humanReviewIntendedUseLabel(order.intended_use) ? <Info label="Intended use" value={humanReviewIntendedUseLabel(order.intended_use)!} /> : null}
          </div>
        </details>

        {legacy ? (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
            This is a legacy-format order. It is excluded from automatic queue prioritization. Verify the property, parcel, customer and existing report state before any action.
            <ul className="mt-2 list-inside list-disc">{founderOrderReviewReasons(order).map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </div>
        ) : null}

        <FounderActionGuide status={status} propertyHref={status === "processing" || !isAdmin ? null : propertyHref} />
        {deliveryNotice ? <p role="status" className="mt-4 rounded-lg border p-3 text-sm">{deliveryNotice}</p> : null}

        {order.failure_reason ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-950">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span><strong>Why it was stopped:</strong> {order.failure_reason}</span>
          </div>
        ) : null}

        {status === "processing" ? <OrderInvestigationWorkspace orderId={order.id} onApproved={onRefresh} /> : null}
        {status === "ready" ? (
          <FounderHumanReviewEditor
            key={`${order.id}:${order.review_content_updated_at ?? order.updated_at}:${status}`}
            orderId={order.id}
            initialContent={order.review_content}
            disabled={busy || status === "ready"}
            defaultOpen={false}
            onSaved={onRefresh}
          />
        ) : null}

        {isAdmin && <div className="mt-5 flex flex-wrap gap-2">
          {status === "paid" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onTransition(order, "start_review")}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <PlayCircle className="h-3.5 w-3.5" /> Start this investigation
            </button>
          ) : null}
          {status === "processing" ? <ReadyAction order={order} busy={busy} onUploadReport={onUploadReport} onTransition={onTransition} /> : null}
          {status === "failed" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button type="button" disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  <RotateCcw className="h-3.5 w-3.5" /> Reopen and continue investigation
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="z-[100] max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
                <AlertDialogTitle>Reopen this investigation?</AlertDialogTitle>
                <AlertDialogDescription>
                  This returns the exact order to investigation status and clears the active failure label. Saved evidence and audit history stay intact. Nothing is delivered or emailed.
                </AlertDialogDescription>
                <dl className="space-y-2 break-all text-sm">
                  <div><dt className="font-semibold">Property</dt><dd>{propertyReference}</dd></div>
                  <div><dt className="font-semibold">Customer</dt><dd>{customerEmail}</dd></div>
                  <div><dt className="font-semibold">Order</dt><dd>{order.id}</dd></div>
                </dl>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep stopped</AlertDialogCancel>
                  <AlertDialogAction disabled={busy} onClick={() => void onTransition(order, "reopen_review")}>Reopen investigation</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          {status === "ready" ? (
            <AlertDialog>
            <AlertDialogTrigger asChild><button
              type="button"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#FF6A00]/35 bg-[#FFF7ED] px-4 py-2 text-xs font-semibold text-[#0D1B2A] disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#FF6A00]" /> Reopen this exact report
            </button></AlertDialogTrigger>
            <AlertDialogContent className="z-[100] max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
              <AlertDialogTitle>Reopen this exact report?</AlertDialogTitle>
              <AlertDialogDescription>The report will return to investigation status. This action applies only to the order identified below.</AlertDialogDescription>
              <dl className="space-y-2 break-all text-sm">
                <div><dt className="font-semibold">Full order ID</dt><dd>{order.id}</dd></div>
                <div><dt className="font-semibold">Property</dt><dd>{propertyReference}</dd></div>
                <div><dt className="font-semibold">Customer</dt><dd>{customerEmail}</dd></div>
                <div><dt className="font-semibold">Canonical parcel</dt><dd>{order.parcel_id ?? "Not matched"}</dd></div>
                <div><dt className="font-semibold">Mode</dt><dd>{mode}</dd></div>
              </dl>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep delivered</AlertDialogCancel>
                <AlertDialogAction disabled={busy} onClick={() => void onTransition(order, "reopen_review")}>Reopen this exact report</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
          ) : null}
          {status === "paid" || status === "processing" ? <FailedAction order={order} busy={busy} onTransition={onTransition} /> : null}
        </div>}
      </section>
    </>
  );
}

function FounderActionGuide({ status, propertyHref }: { status: string; propertyHref: string | null }) {
  const statusIntro =
    status === "paid"
      ? "Start this customer investigation, then work through the standard Easy Erf checks and final reviewed report."
      : status === "processing"
        ? "Continue this customer investigation from the saved evidence. Complete the applicable checks, then approve the final reviewed report."
        : status === "failed"
          ? "This investigation was stopped. Reopen it to continue from the evidence already saved. The failure record remains in the audit history."
          : "Delivered. Reopen only when intentionally correcting or replacing this exact report.";

  return (
    <div className="mt-5 rounded-[1.25rem] border border-[#FF6A00]/20 bg-[#FFF7ED] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0D1B2A]">
            <ListChecks className="h-4 w-4 text-[#FF6A00]" /> Investigation and delivery
          </div>
          <p className="mt-1 text-xs leading-5 text-[#64748B]">{statusIntro}</p>
        </div>
        {propertyHref ? (
          <a href={propertyHref} className="inline-flex items-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] hover:border-[#FF6A00]/35">
            <FileSearch2 className="h-3.5 w-3.5 text-[#FF6A00]" /> Open full property investigation <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      <div className="mt-3 rounded-xl border border-[#F59E0B]/25 bg-[#fffbeb] px-3 py-2 text-[11px] leading-5 text-[#92400E]">
        <strong>Included property-data-report rule:</strong> {DONE_FOR_YOU_PROPERTY_DATA_REPORT_COPY} If Lightstone or another branded provider is used internally, do not attach or redistribute the provider PDF unless the applicable provider or report terms allow it.
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
  onTransition: (order: ReportOrder, action: FulfillmentAction, values?: TransitionValues) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const reportReady = isHumanReviewReportContentComplete(order.review_content);
  const checklist = parseHumanReviewInvestigationChecklist(order.review_content);
  const checklistReady = Boolean(checklist && isHumanReviewInvestigationChecklistResolved(checklist));
  const rawContent = order.review_content;
  const hasCombinedVersion = Boolean(rawContent && typeof rawContent === "object" && !Array.isArray(rawContent)
    && "combinedReviewVersionId" in rawContent && typeof rawContent.combinedReviewVersionId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawContent.combinedReviewVersionId));
  const deliveryReady = hasCombinedVersion && reportReady && checklistReady;
  const deliveryBlocker = !hasCombinedVersion
    ? "Complete the investigation and approve one reviewed report version first. AI is not required."
    : !reportReady
    ? "Complete and save the reviewed bottom line plus all five report sections first."
    : !checklistReady
      ? "Resolve and save every standard investigation checklist item first."
      : null;

  if (!order.user_id) {
    return <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-[#0D1B2A]">Match this exact paid order to a customer account before report delivery.</div>;
  }

  return (
    <div className="min-w-0 basis-full">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !deliveryReady}
          onClick={() => void onTransition(order, "mark_ready")}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          title={deliveryBlocker ?? "Deliver this exact structured report and trigger its customer email"}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Mark this exact report ready
        </button>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold">Optional PDF delivery</summary>
        <div className="mt-2 flex flex-wrap gap-2"><input
          type="file"
          aria-label="Optional report PDF for this order"
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
          title={deliveryBlocker ?? "Upload the optional PDF and deliver this exact report"}
        >
          <Upload className="h-3.5 w-3.5" /> Upload PDF and deliver this exact report
        </button>
        </div>
      </details>
      {deliveryBlocker ? (
        <p role="status" className="mt-2 text-[11px] leading-5 text-amber-800">Delivery blocked: {deliveryBlocker}</p>
      ) : (
        <p className="mt-2 text-[11px] leading-5 text-emerald-700">
          An approved reviewed report version is saved. Delivery will recheck the evidence revision and reviewer authority before proceeding.
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
  onTransition: (order: ReportOrder, action: FulfillmentAction, values?: TransitionValues) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  return (
    <details className="mt-4 min-w-0 basis-full rounded-xl border border-destructive/15 bg-destructive/5 p-3">
      <summary className="cursor-pointer text-xs font-semibold text-destructive">Stop this investigation (rare)</summary>
      <p className="mt-2 max-w-3xl text-[11px] leading-5 text-[#64748B]">
        Use this only when the order genuinely cannot continue. This does not delete evidence and the order can be reopened later. A confirmation is required.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          aria-label="Reason for stopping this exact investigation"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why this investigation cannot continue"
          className="min-w-0 flex-1 rounded-full border border-[#D9E6F2] bg-white px-3 py-2 text-xs outline-none focus:border-[#FF6A00]"
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button type="button" disabled={busy || !reason.trim()} className="rounded-full border border-destructive/30 bg-white px-4 py-2 text-xs font-semibold text-destructive disabled:opacity-50">
              Review stop action
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="z-[100] max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
            <AlertDialogTitle>Stop this investigation?</AlertDialogTitle>
            <AlertDialogDescription>
              The order will show Needs recovery and cannot continue until an admin reopens it. Saved evidence is retained and this stop remains in the audit history.
            </AlertDialogDescription>
            <p className="rounded-md bg-muted p-3 text-sm"><strong>Reason:</strong> {reason.trim()}</p>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={busy || !reason.trim()} onClick={() => void onTransition(order, "mark_failed", { failureReason: reason.trim() })}>
                Stop this investigation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </details>
  );
}

function showDeliveryResult(notification: unknown, uploadedPdf = false) {
  const result = founderDeliveryResult(notification);
  const message = `${uploadedPdf ? "PDF uploaded. " : ""}${result.message}`;
  if (result.success) toast.success(message);
  else toast.error(message);
  return message;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#0D1B2A]/10 bg-white p-4 shadow-soft">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-[#0D1B2A]">{value}</div>
    </div>
  );
}

function Info({ label, value, mono = false, strong = false }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  const valueClass = mono
    ? "mt-1 break-all font-mono text-[11px] text-[#0D1B2A]"
    : "mt-1 text-xs leading-5 text-[#0D1B2A]";
  return (
    <div className={`rounded-2xl p-3 ring-1 ${strong ? "bg-[#FFF7ED] ring-[#FF6A00]/25" : "bg-[#F7FBFF] ring-[#D9E6F2]/80"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">{label}</div>
      <div className={valueClass}>{value}</div>
    </div>
  );
}

function ModeBadge({ mode }: { mode: ReturnType<typeof reportOrderMode> }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${mode === "LIVE" ? "bg-rose-100 text-rose-900" : "bg-sky-100 text-sky-900"}`}>
      <TestTube2 className="h-3 w-3" /> {mode}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const Icon = status === "ready" ? CheckCircle2 : status === "failed" ? AlertCircle : status === "processing" ? CircleDashed : ReceiptText;
  const label = status === "paid" ? "Waiting to start" : status === "processing" ? "In progress" : status === "ready" ? "Delivered" : status === "failed" ? "Needs recovery" : status;
  const tone = status === "failed" ? "bg-amber-700" : "bg-[#0D1B2A]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white ${tone}`}>
      <Icon className="h-3.5 w-3.5 text-[#FFB166]" /> {label}
    </span>
  );
}

function orderStatus(order: Pick<ReportOrder, "status" | "status_enum">) {
  const status = (order.status_enum || order.status || "pending").toLowerCase();
  return status === "fulfilling" ? "processing" : status === "complete" ? "ready" : status;
}

function orderPriority(order: Pick<ReportOrder, "status" | "status_enum">) {
  const status = orderStatus(order);
  return status === "paid" ? 0 : status === "failed" ? 1 : status === "processing" ? 2 : 3;
}

function payloadText(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
