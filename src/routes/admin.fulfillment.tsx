import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  PlayCircle,
  ReceiptText,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/fulfillment")({
  head: () => ({
    meta: [
      { title: "Human Review Queue | Easy Erf" },
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
};

type FulfillmentAction = "start_review" | "mark_ready" | "mark_failed";

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
        "id,user_id,parcel_id,report_type,status,status_enum,provider,payload,price_cents,pdf_storage_path,failure_reason,created_at,updated_at,completed_at",
      )
      .eq("provider", "stripe")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error("Could not load the human review queue.");
      setLoading(false);
      return;
    }

    setOrders((data ?? []) as ReportOrder[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
        ? "Human review started"
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
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: "application/pdf",
        });

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

      toast.success("Report uploaded securely and marked ready");
      await refresh();
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-28 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ReceiptText className="h-3 w-3 text-accent" /> Human review operations
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Paid investigation queue</h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Move verified Stripe orders through the human-review lifecycle. Every transition is enforced server-side and audited.
            </p>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Founder Operations
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric label="Waiting for review" value={orders.filter((order) => orderStatus(order) === "paid").length} />
          <Metric label="In human review" value={orders.filter((order) => orderStatus(order) === "processing").length} />
          <Metric label="Ready" value={orders.filter((order) => orderStatus(order) === "ready").length} />
        </div>

        <section className="mt-8 space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading paid orders…</div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <div className="text-sm font-semibold">No Stripe investigation orders</div>
              <p className="mt-1 text-xs text-muted-foreground">The queue will populate only from verified payment records.</p>
            </div>
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                busy={busyOrderId === order.id}
                onTransition={transition}
                onUploadReport={uploadReport}
              />
            ))
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

function OrderCard({
  order,
  busy,
  onTransition,
  onUploadReport,
}: {
  order: ReportOrder;
  busy: boolean;
  onTransition: (
    order: ReportOrder,
    action: FulfillmentAction,
    values?: { pdfStoragePath?: string; failureReason?: string },
  ) => Promise<void>;
  onUploadReport: (order: ReportOrder, file: File) => Promise<void>;
}) {
  const status = orderStatus(order);
  const propertyReference = payloadText(order.payload, "propertyReference");
  const customerEmail = payloadText(order.payload, "customerEmail");
  const investigationRequest = payloadText(order.payload, "investigationRequest");

  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className="font-mono text-[10px] text-muted-foreground">{order.id.slice(0, 8)}</span>
          </div>
          <h2 className="mt-3 text-base font-semibold text-foreground">
            {propertyReference ?? order.parcel_id ?? "Property reference pending"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{customerEmail ?? "Customer email unavailable"}</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums text-foreground">R{(order.price_cents / 100).toFixed(0)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleString("en-ZA")}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Info label="Canonical parcel" value={order.parcel_id ?? "Not matched"} mono />
        <Info label="Customer request" value={investigationRequest ?? "No specific request entered"} />
      </div>

      {order.failure_reason ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {order.failure_reason}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {status === "paid" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onTransition(order, "start_review")}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <PlayCircle className="h-3.5 w-3.5" /> Start human review
          </button>
        ) : null}
        {status === "processing" ? (
          <ReadyAction order={order} busy={busy} onUploadReport={onUploadReport} />
        ) : null}
        {status === "paid" || status === "processing" ? (
          <FailedAction order={order} busy={busy} onTransition={onTransition} />
        ) : null}
      </div>
    </article>
  );
}

function ReadyAction({
  order,
  busy,
  onUploadReport,
}: {
  order: ReportOrder;
  busy: boolean;
  onUploadReport: OrderCardProps["onUploadReport"];
}) {
  const [file, setFile] = useState<File | null>(null);

  if (!order.user_id) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-foreground">
        Match this paid order to a customer account before report delivery.
      </div>
    );
  }

  return (
    <div className="flex min-w-[300px] flex-1 flex-wrap items-center gap-2">
      <input
        type="file"
        accept="application/pdf,.pdf"
        disabled={busy}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-2 text-xs file:mr-2 file:border-0 file:bg-transparent file:text-xs file:font-semibold"
      />
      <button
        type="button"
        disabled={busy || !file}
        onClick={() => file && void onUploadReport(order, file)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5" /> Upload PDF & mark ready
      </button>
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
  onTransition: OrderCardProps["onTransition"];
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="flex min-w-[280px] flex-1 gap-2">
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Failure reason"
        className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-2 text-xs outline-none focus:border-accent"
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

type OrderCardProps = Parameters<typeof OrderCard>[0];

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/60 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xs text-foreground ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const Icon = status === "ready" ? CheckCircle2 : status === "failed" ? AlertCircle : status === "processing" ? CircleDashed : ReceiptText;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground">
      <Icon className="h-3 w-3 text-accent" /> {status === "paid" ? "Payment received" : status === "processing" ? "Human review" : status}
    </span>
  );
}

function orderStatus(order: ReportOrder) {
  return (order.status_enum || order.status || "pending").toLowerCase();
}

function payloadText(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
