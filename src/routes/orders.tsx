import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, CircleDashed, ReceiptText } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "My Human-Reviewed Investigations | Easy Erf" },
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
};

function CustomerOrdersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("report_orders")
        .select(
          "id,parcel_id,report_type,status,status_enum,payload,price_cents,pdf_storage_path,failure_reason,created_at,completed_at",
        )
        .eq("user_id", user.id)
        .eq("provider", "stripe")
        .order("created_at", { ascending: false });
      if (!active) return;
      setOrders((data ?? []) as ReportOrder[]);
      setLoadingOrders(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-28 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ReceiptText className="h-3 w-3 text-accent" /> Human-reviewed investigations
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Your review status</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Follow each paid Easy Erf investigation from payment receipt through human review and report completion.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> My Investigations
          </Link>
        </div>

        <section className="mt-8 space-y-4">
          {loadingOrders ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading review status…</div>
          ) : orders.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
              <div className="text-sm font-semibold text-foreground">No paid human-reviewed investigations yet</div>
              <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">
                When a payment is verified, its status will appear here automatically.
              </p>
            </div>
          ) : (
            orders.map((order) => <CustomerOrderCard key={order.id} order={order} />)
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

function CustomerOrderCard({ order }: { order: ReportOrder }) {
  const status = orderStatus(order);
  const propertyReference = payloadText(order.payload, "propertyReference") ?? order.parcel_id ?? "Property reference pending";
  const request = payloadText(order.payload, "investigationRequest");
  const steps = [
    { key: "paid", label: "Payment received", done: ["paid", "processing", "ready"].includes(status) },
    { key: "processing", label: "Human review", done: ["processing", "ready"].includes(status) },
    { key: "ready", label: "Report ready", done: status === "ready" },
  ];

  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <StatusBadge status={status} />
          <h2 className="mt-3 text-base font-semibold text-foreground">{propertyReference}</h2>
          {request ? <p className="mt-1 text-xs text-muted-foreground">{request}</p> : null}
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums text-foreground">R{(order.price_cents / 100).toFixed(0)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">Paid investigation</div>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {steps.map((step) => (
          <div key={step.key} className="rounded-2xl bg-muted/60 p-3">
            <div className="flex items-center gap-2">
              {step.done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <CircleDashed className="h-4 w-4 text-muted-foreground" />}
              <span className="text-xs font-semibold text-foreground">{step.label}</span>
            </div>
          </div>
        ))}
      </div>

      {status === "ready" ? (
        <div className="mt-4 rounded-2xl border border-success/20 bg-success/5 p-4 text-xs text-foreground">
          <div className="font-semibold">Your human-reviewed investigation is ready.</div>
          <p className="mt-1 text-muted-foreground">Easy Erf has recorded the completed report. Secure report delivery is the next connection before launch.</p>
        </div>
      ) : null}

      {status === "failed" ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Your investigation needs attention.</div>
            <p className="mt-1">{order.failure_reason ?? "Easy Erf will review the issue before continuing."}</p>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const Icon = status === "ready" ? CheckCircle2 : status === "failed" ? AlertCircle : status === "processing" ? CircleDashed : ReceiptText;
  const label = status === "paid" ? "Payment received" : status === "processing" ? "Human review underway" : status === "ready" ? "Report ready" : status;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground">
      <Icon className="h-3 w-3 text-accent" /> {label}
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
