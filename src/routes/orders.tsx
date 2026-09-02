import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Download,
  ListChecks,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { CustomerWorkspaceShell } from "@/components/account/CustomerWorkspaceShell";
import { HumanReviewedReport } from "@/components/humanReview/HumanReviewedReport";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import {
  customerReportStatus,
  partitionCustomerReportOrders,
  type FinishedCustomerReport,
} from "@/lib/humanReview/customerReportPresentation";
import {
  DONE_FOR_YOU_INVESTIGATION_NAME,
  humanReviewFocusLabel,
  humanReviewIntendedUseLabel,
} from "@/lib/humanReview/scope";
import {
  parseHumanReviewReportContent,
  type HumanReviewReportContent,
} from "@/lib/humanReview/reportContent";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "My Properties | Easy Erf" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomerOrdersPage,
});

type ReportOrder = {
  id: string;
  parcel_id: string | null;
  report_type: string;
  status: string;
  status_enum: string | null;
  payload: unknown;
  price_cents: number;
  pdf_storage_path: string | null;
  failure_reason: string | null;
  created_at: string;
  completed_at: string | null;
  review_focus: string | null;
  intended_use: string | null;
  review_context: string | null;
  review_content: unknown;
};

function CustomerOrdersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(readSelectedReportId);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setPaymentReceived(params.get("payment") === "received");
  }, []);

  useEffect(() => {
    const syncSelectedReport = () => setSelectedReportId(readSelectedReportId());
    window.addEventListener("popstate", syncSelectedReport);
    return () => window.removeEventListener("popstate", syncSelectedReport);
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("report_orders")
        .select(
          "id,parcel_id,report_type,status,status_enum,payload,price_cents,pdf_storage_path,failure_reason,created_at,completed_at,review_focus,intended_use,review_context,review_content",
        )
        .eq("user_id", user.id)
        .eq("provider", "stripe")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) toast.error("Could not load your done-for-you property investigations.");
      setOrders((data ?? []) as ReportOrder[]);
      setLoadingOrders(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const newestOrder = useMemo(() => orders[0] ?? null, [orders]);
  const groupedOrders = useMemo(() => partitionCustomerReportOrders(orders), [orders]);
  const selectedReport = useMemo(
    () => groupedOrders.finished.find(({ order }) => order.id === selectedReportId) ?? null,
    [groupedOrders.finished, selectedReportId],
  );

  const selectReport = (orderId: string | null) => {
    setSelectedReportId(orderId);
    if (typeof window === "undefined") return;
    const nextUrl = new URL(window.location.href);
    if (orderId) nextUrl.searchParams.set("report", orderId);
    else nextUrl.searchParams.delete("report");
    window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  };

  if (!user) return null;

  return (
    <CustomerWorkspaceShell activeTab="reports">
      <section aria-label="Done-for-You Reports">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            <ShieldCheck className="h-3 w-3 text-[#FF8A33]" /> Done for You
          </span>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-[#0D1B2A] md:text-2xl">
            Done-for-You Reports
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#64748B]">
            Track paid property investigations here, then choose a finished Human-Reviewed Easy Erf Report to open.
          </p>
        </div>

        {paymentReceived ? <PaymentReceivedPanel order={newestOrder} loading={loadingOrders} /> : null}

        <section className="mt-8 space-y-6">
          {loadingOrders ? (
            <div className="rounded-2xl border border-[#0D1B2A]/10 bg-white p-6 text-sm text-[#64748B]">
              Loading investigation status…
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-[2rem] border border-[#0D1B2A]/10 bg-white p-8 text-center shadow-soft">
              <div className="text-sm font-semibold text-[#0D1B2A]">
                No paid done-for-you investigations yet
              </div>
              <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-[#64748B]">
                Confirm a property first, then hand the same Easy Erf property file to us without losing any work already gathered.
              </p>
              <Link
                to="/pricing"
                className="mt-5 inline-flex rounded-full bg-[#FF6A00] px-5 py-2.5 text-sm font-semibold text-white"
              >
                See Done-for-You · R999
              </Link>
            </div>
          ) : selectedReport ? (
            <OpenedReport report={selectedReport} onClose={() => selectReport(null)} />
          ) : (
            <>
              <OrderSection title="In progress" orders={groupedOrders.inProgress} />
              <FinishedOrderSection reports={groupedOrders.finished} onOpenReport={selectReport} />
            </>
          )}
        </section>
      </section>
    </CustomerWorkspaceShell>
  );
}

function PaymentReceivedPanel({ order, loading }: { order: ReportOrder | null; loading: boolean }) {
  const propertyReference = order ? orderPropertyReference(order) : null;
  const focus = order?.review_focus ? humanReviewFocusLabel(order.review_focus) : null;

  return (
    <section className="mt-7 overflow-hidden rounded-[2rem] border border-emerald-500/25 bg-white shadow-soft">
      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.9fr)]">
        <div className="bg-[#0D1B2A] p-6 text-white sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" /> Payment received
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">
            Easy Erf has taken over the property investigation.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
            Your R999 payment, confirmed parcel and emphasis are attached to this account. You do not need to repeat the property search, rebuild the investigation or answer the same questions again.
          </p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            {loading ? (
              <div className="text-sm text-white/65">Confirming the new order in your account…</div>
            ) : order ? (
              <>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                  Investigation we received
                </div>
                <div className="mt-1 text-sm font-semibold text-white">{propertyReference}</div>
                <div className="mt-1 text-xs text-white/58">
                  {focus ?? DONE_FOR_YOU_INVESTIGATION_NAME} · R
                  {(order.price_cents / 100).toFixed(0)} paid
                </div>
              </>
            ) : (
              <div className="text-sm text-white/65">
                Payment returned successfully. If the order does not appear below shortly, refresh My Reports once before contacting support.
              </div>
            )}
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B24A00]">
            <ListChecks className="h-4 w-4" /> What happens next
          </div>
          <div className="mt-4 space-y-3">
            {[
              [
                "1",
                "Payment and parcel attached",
                "Done. This paid investigation is tied to your account and exact property.",
              ],
              [
                "2",
                "Easy Erf works through the investigation",
                "We reuse completed work, work through the standard property investigation and review a third-party property data report during Early Access where available.",
              ],
              [
                "3",
                "Human reviewer checks the file",
                "The reviewer checks the evidence, contradictions, uncertainty and the emphasis you selected.",
              ],
              [
                "4",
                "Report appears here",
                "The finished Human-Reviewed Easy Erf Report replaces the progress card below when it is ready.",
              ],
            ].map(([number, title, body]) => (
              <div
                key={number}
                className="flex gap-3 rounded-2xl bg-[#F7FBFF] p-3 ring-1 ring-[#D9E6F2]/80"
              >
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0D1B2A] text-xs font-bold text-white">
                  {number}
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#0D1B2A]">{title}</div>
                  <p className="mt-1 text-xs leading-5 text-[#64748B]">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-[#FF6A00]/20 bg-[#FFF7ED] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
              <Clock3 className="h-4 w-4 text-[#FF6A00]" /> Current early-access target: about 3 business days
            </div>
            <p className="mt-2 text-xs leading-5 text-[#64748B]">
              You do not need to do anything now. If a critical piece of evidence cannot be obtained or verified, the final report will make that explicit rather than silently guessing.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function OrderSection({ title, orders }: { title: string; orders: ReportOrder[] }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-3 text-sm font-semibold text-[#0D1B2A]">{title}</h3>
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#0D1B2A]/15 bg-white p-4 text-xs text-[#64748B]">
          No {title.toLowerCase()} yet.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <CustomerOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </section>
  );
}

function FinishedOrderSection({
  reports,
  onOpenReport,
}: {
  reports: FinishedCustomerReport<ReportOrder>[];
  onOpenReport: (orderId: string) => void;
}) {
  return (
    <section aria-label="Finished reports">
      <h3 className="mb-3 text-sm font-semibold text-[#0D1B2A]">Finished reports</h3>
      {reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#0D1B2A]/15 bg-white p-4 text-xs text-[#64748B]">
          No finished reports yet.
        </div>
      ) : (
        <>
          <div className="mb-3 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] px-4 py-3 text-xs leading-5 text-[#64748B]">
            Each card below is a separate paid order. The same property can appear more than once when it was ordered more than once. Open each card independently.
          </div>
          <div className="space-y-4">
            {reports.map((report) => (
              <FinishedReportCard
                key={report.order.id}
                report={report}
                onOpen={() => onOpenReport(report.order.id)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function FinishedReportCard({
  report,
  onOpen,
}: {
  report: FinishedCustomerReport<ReportOrder>;
  onOpen: () => void;
}) {
  const { order } = report;
  const propertyReference = orderPropertyReference(order);
  const intendedUse = humanReviewIntendedUseLabel(order.intended_use);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open order ${formatOrderReference(order.id)} for ${propertyReference}`}
      className="group w-full rounded-2xl border border-emerald-500/25 bg-white p-5 text-left shadow-soft transition hover:border-[#FF6A00]/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] focus-visible:ring-offset-2 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <StatusBadge status="ready" label="Finished" />
          <h3 className="mt-3 text-lg font-semibold text-[#0D1B2A]">{propertyReference}</h3>
          <p className="mt-1 text-xs text-[#64748B]">
            {order.review_focus
              ? humanReviewFocusLabel(order.review_focus)
              : DONE_FOR_YOU_INVESTIGATION_NAME}
            {intendedUse ? ` · ${intendedUse}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#64748B]">
            <span className="rounded-full bg-[#F7FBFF] px-2.5 py-1 ring-1 ring-[#D9E6F2]">
              Ordered {formatReportDate(order.created_at)}
            </span>
            <span className="rounded-full bg-[#F7FBFF] px-2.5 py-1 font-semibold text-[#0D1B2A] ring-1 ring-[#D9E6F2]">
              Order reference {formatOrderReference(order.id)}
            </span>
            <span className="rounded-full bg-[#F7FBFF] px-2.5 py-1 ring-1 ring-[#D9E6F2]">
              {finishedDeliveryLabel(report)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3">
          <div className="text-xs text-[#64748B]">
            Finished {formatReportDate(order.completed_at)}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white transition group-hover:bg-[#142944]">
            Open order <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

function OpenedReport({
  report,
  onClose,
}: {
  report: FinishedCustomerReport<ReportOrder>;
  onClose: () => void;
}) {
  const { order } = report;

  return (
    <section aria-label="Opened finished report">
      <button
        type="button"
        onClick={onClose}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] hover:bg-[#fff8ec]"
      >
        Back to reports
      </button>
      <div className="mb-4 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] px-4 py-3 text-xs leading-5 text-[#64748B]">
        <span className="font-semibold text-[#0D1B2A]">
          Separate paid order · {formatOrderReference(order.id)}
        </span>{" "}
        · Ordered {formatReportDate(order.created_at)}. {report.kind === "structured"
          ? "This order opens as an interactive web report. Any attached PDF is a secondary export."
          : "This earlier completed order remains separate from any newer report for the same property. Open its attached PDF below when available."}
      </div>
      <CustomerOrderCard
        order={order}
        expanded
        contentOverride={report.kind === "structured" ? report.content : undefined}
      />
    </section>
  );
}

function CustomerOrderCard({
  order,
  expanded = false,
  contentOverride,
}: {
  order: ReportOrder;
  expanded?: boolean;
  contentOverride?: HumanReviewReportContent;
}) {
  const [downloading, setDownloading] = useState(false);
  const status = orderStatus(order);
  const propertyReference = orderPropertyReference(order);
  const legacyRequest = payloadText(order.payload, "investigationRequest");
  const content = contentOverride ?? parseHumanReviewReportContent(order.review_content);

  async function downloadReport() {
    if (!order.pdf_storage_path) {
      toast.error("The completed PDF export is not attached yet.");
      return;
    }
    setDownloading(true);
    const { data, error } = await supabase.storage
      .from("erf-files")
      .createSignedUrl(order.pdf_storage_path, 300, { download: true });
    setDownloading(false);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Could not create a secure report download.");
      return;
    }
    window.location.assign(data.signedUrl);
  }

  const downloadButton = order.pdf_storage_path ? (
    <button
      type="button"
      disabled={downloading}
      onClick={() => void downloadReport()}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" /> {downloading ? "Preparing PDF…" : "Download PDF"}
    </button>
  ) : null;

  if (status === "ready" && content && expanded) {
    return (
      <HumanReviewedReport
        propertyReference={propertyReference}
        focus={order.review_focus}
        intendedUse={order.intended_use}
        context={order.review_context}
        content={content}
        completedAt={order.completed_at}
        downloadAction={downloadButton}
      />
    );
  }

  const steps = [
    {
      key: "paid",
      label: "Payment received",
      done: ["paid", "processing", "ready"].includes(status),
    },
    {
      key: "processing",
      label: "Investigation underway",
      done: ["processing", "ready"].includes(status),
    },
    { key: "ready", label: "Report ready", done: status === "ready" },
  ];

  return (
    <article className="rounded-[2rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <StatusBadge status={status} />
          <h2 className="mt-3 text-lg font-semibold text-[#0D1B2A]">{propertyReference}</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            {order.review_focus
              ? humanReviewFocusLabel(order.review_focus)
              : DONE_FOR_YOU_INVESTIGATION_NAME}
            {humanReviewIntendedUseLabel(order.intended_use)
              ? ` · ${humanReviewIntendedUseLabel(order.intended_use)}`
              : ""}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-[#64748B]">
            Order reference {formatOrderReference(order.id)} · Ordered {formatReportDate(order.created_at)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums text-[#0D1B2A]">
            R{(order.price_cents / 100).toFixed(0)}
          </div>
          <div className="mt-1 text-[10px] text-[#64748B]">One property</div>
        </div>
      </div>

      {order.review_context ? (
        <div className="mt-4 rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] p-4 text-xs leading-5 text-[#0D1B2A]/72">
          <strong className="text-[#0D1B2A]">Situation context:</strong>{" "}
          {order.review_context}
        </div>
      ) : legacyRequest ? (
        <div className="mt-4 rounded-2xl border border-[#F59E0B]/25 bg-[#fffbeb] p-4 text-xs leading-5 text-[#0D1B2A]/72">
          <strong className="text-[#0D1B2A]">Earlier checkout note:</strong>{" "}
          {legacyRequest}. This note does not expand the current investigation into professional advice.
        </div>
      ) : null}

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {steps.map((step) => (
          <div key={step.key} className="rounded-2xl bg-[#F7FBFF] p-3 ring-1 ring-[#D9E6F2]/80">
            <div className="flex items-center gap-2">
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <CircleDashed className="h-4 w-4 text-[#94A3B8]" />
              )}
              <span className="text-xs font-semibold text-[#0D1B2A]">{step.label}</span>
            </div>
          </div>
        ))}
      </div>

      {status === "paid" ? (
        <div className="mt-4 rounded-2xl border border-[#FF6A00]/20 bg-[#FFF7ED] p-4 text-xs leading-5 text-[#0D1B2A]">
          <div className="font-semibold">
            Payment is confirmed and this property is waiting for Easy Erf to start the investigation.
          </div>
          <p className="mt-1 text-[#64748B]">
            Current early-access target: about 3 business days. You do not need to resubmit anything.
          </p>
        </div>
      ) : null}

      {status === "processing" ? (
        <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-50 p-4 text-xs leading-5 text-[#0D1B2A]">
          <div className="font-semibold">
            Easy Erf is working through the property investigation now.
          </div>
          <p className="mt-1 text-[#64748B]">
            The standard investigation is being completed/reviewed and a human reviewer will check the final evidence-backed report before delivery.
          </p>
        </div>
      ) : null}

      {status === "ready" ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-50 p-4 text-xs text-[#0D1B2A]">
          <div className="font-semibold">This paid property investigation is complete.</div>
          <p className="mt-1 leading-5 text-[#0D1B2A]/65">
            {order.pdf_storage_path
              ? "This earlier completed order includes a PDF report. It remains separate from any other paid order for the same property."
              : "This earlier completed order remains visible as a separate purchase, but no downloadable PDF is currently attached."}
          </p>
          {downloadButton ? <div className="mt-3">{downloadButton}</div> : null}
        </div>
      ) : null}

      {status === "failed" ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Your investigation needs attention.</div>
            <p className="mt-1">
              {order.failure_reason ?? "Easy Erf will review the issue before continuing."}
            </p>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function StatusBadge({ status, label: labelOverride }: { status: string; label?: string }) {
  const Icon =
    status === "ready"
      ? CheckCircle2
      : status === "failed"
        ? AlertCircle
        : status === "processing"
          ? CircleDashed
          : ReceiptText;
  const label =
    labelOverride ??
    (status === "paid"
      ? "Payment received"
      : status === "processing"
        ? "Investigation underway"
        : status === "ready"
          ? "Report ready"
          : status);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
      <Icon className="h-3 w-3 text-[#FF8A33]" /> {label}
    </span>
  );
}

function orderStatus(order: ReportOrder) {
  return customerReportStatus(order);
}

function orderPropertyReference(order: ReportOrder) {
  return (
    payloadText(order.payload, "propertyReference") ??
    order.parcel_id ??
    "Property reference pending"
  );
}

function payloadText(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readSelectedReportId() {
  if (typeof window === "undefined") return null;
  const reportId = new URLSearchParams(window.location.search).get("report");
  return reportId?.trim() || null;
}

function formatOrderReference(orderId: string) {
  const compact = orderId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  return `EE-${compact || "ORDER"}`;
}

function finishedDeliveryLabel(report: FinishedCustomerReport<ReportOrder>) {
  if (report.kind === "structured") return "Interactive web report";
  return report.order.pdf_storage_path ? "PDF report" : "Completed order record";
}

function formatReportDate(value: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "date not recorded";
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
