import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Database,
  FileText,
  Gauge,
  HardHat,
  HeartPulse,
  ReceiptText,
  ShieldCheck,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { listProviders } from "@/lib/providers/registry";
import { AdminGuard } from "@/components/admin/AdminGuard";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Founder Operations | Easy Erf" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type ReportOrderRow = {
  id: string;
  user_id: string | null;
  parcel_id: string | null;
  report_type: string;
  status: string;
  status_enum: string | null;
  provider_id: string | null;
  provider: string;
  payload: unknown;
  price_cents: number;
  created_at: string;
  updated_at: string;
  failure_reason: string | null;
  completed_at: string | null;
};

type ProviderAuditRow = {
  id: string;
  user_id: string | null;
  provider: string;
  action: string;
  resource_id: string | null;
  status: string;
  error_code: string | null;
  latency_ms: number | null;
  at: string;
};

type ProviderSettingRow = {
  provider: string;
  enabled: boolean;
  is_active: boolean;
  last_health: string | null;
  last_checked_at: string | null;
};

type ProviderHealth = {
  status: string;
  message?: string;
};

function AdminPage() {
  return (
    <AdminGuard>
      <FounderOperations />
    </AdminGuard>
  );
}

function FounderOperations() {
  const [orders, setOrders] = useState<ReportOrderRow[]>([]);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [auditRows, setAuditRows] = useState<ProviderAuditRow[]>([]);
  const [providerSettings, setProviderSettings] = useState<ProviderSettingRow[]>([]);
  const [providerHealth, setProviderHealth] = useState<Record<string, ProviderHealth>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void (async () => {
      const [countResult, orderResult, auditResult, settingsResult] = await Promise.all([
        supabase.from("report_orders").select("id", { count: "exact", head: true }),
        supabase
          .from("report_orders")
          .select(
            "id,user_id,parcel_id,report_type,status,status_enum,provider_id,provider,payload,price_cents,created_at,updated_at,failure_reason,completed_at",
          )
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("provider_audit_log")
          .select("id,user_id,provider,action,resource_id,status,error_code,latency_ms,at")
          .order("at", { ascending: false })
          .limit(60),
        supabase
          .from("provider_settings")
          .select("provider,enabled,is_active,last_health,last_checked_at")
          .order("provider", { ascending: true }),
      ]);

      if (cancelled) return;

      const firstError =
        countResult.error ?? orderResult.error ?? auditResult.error ?? settingsResult.error ?? null;

      setOrderCount(countResult.count ?? 0);
      setOrders((orderResult.data ?? []) as ReportOrderRow[]);
      setAuditRows((auditResult.data ?? []) as ProviderAuditRow[]);
      setProviderSettings((settingsResult.data ?? []) as ProviderSettingRow[]);
      setLoadError(firstError?.message ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      listProviders().map(async (provider) => [provider.meta.id, await provider.health()] as const),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, ProviderHealth> = {};
      for (const [id, health] of entries) {
        next[id] = { status: health.status, message: health.message };
      }
      setProviderHealth(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const operationalSummary = useMemo(() => {
    const recentErrors = auditRows.filter((row) => row.status !== "ok").length;
    const failedOrders = orders.filter((order) => orderStatus(order) === "failed").length;
    const users = new Set<string>();
    for (const order of orders) if (order.user_id) users.add(order.user_id);
    for (const row of auditRows) if (row.user_id) users.add(row.user_id);
    const enabledProviders = providerSettings.filter((provider) => provider.enabled).length;

    return {
      recentErrors,
      failedOrders,
      recentUsers: users.size,
      enabledProviders,
    };
  }, [auditRows, orders, providerSettings]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-28 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-accent" /> Easy Erf Operations
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Founder Operations
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Operational truth for report orders, provider activity and system health. This first
              console is deliberately read-first so support visibility grows without bypassing Easy
              Erf authorization or inventing business controls.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/fulfillment"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
            >
              <ReceiptText className="h-3.5 w-3.5" /> Human-review fulfillment
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-soft hover:bg-muted"
            >
              My Investigations <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <nav className="mt-6 flex gap-2 overflow-x-auto pb-1 text-xs font-semibold">
          <Anchor href="#overview">Overview</Anchor>
          <Anchor href="#orders">Orders</Anchor>
          <Anchor href="#provider-activity">Provider activity</Anchor>
          <Anchor href="#system-health">System health</Anchor>
          <Anchor href="#support-boundary">Support coverage</Anchor>
        </nav>

        {loadError ? (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Some operations data could not be loaded</div>
              <p className="mt-1 text-xs opacity-80">{loadError}</p>
            </div>
          </div>
        ) : null}

        <section id="overview" className="scroll-mt-28 pt-8">
          <SectionHeading
            icon={<Gauge className="h-4 w-4" />}
            title="Overview"
            description="Live operational signals from the data this admin role is already authorized to read."
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              icon={<ReceiptText className="h-4 w-4" />}
              label="Report orders tracked"
              value={loading ? "..." : String(orderCount ?? 0)}
            />
            <MetricCard
              icon={<AlertCircle className="h-4 w-4" />}
              label="Failed recent orders"
              value={loading ? "..." : String(operationalSummary.failedOrders)}
              attention={operationalSummary.failedOrders > 0}
              detail={`Within the ${orders.length} most recent loaded orders`}
            />
            <MetricCard
              icon={<Activity className="h-4 w-4" />}
              label="Provider errors"
              value={loading ? "..." : String(operationalSummary.recentErrors)}
              attention={operationalSummary.recentErrors > 0}
              detail={`Within the ${auditRows.length} most recent provider events`}
            />
            <MetricCard
              icon={<UsersRound className="h-4 w-4" />}
              label="Users in recent ops activity"
              value={loading ? "..." : String(operationalSummary.recentUsers)}
              detail="Not total registered users"
            />
            <MetricCard
              icon={<Database className="h-4 w-4" />}
              label="Enabled provider configs"
              value={loading ? "..." : String(operationalSummary.enabledProviders)}
              detail={`${providerSettings.length} provider records visible`}
            />
          </div>
        </section>

        <section id="orders" className="scroll-mt-28 pt-10">
          <SectionHeading
            icon={<FileText className="h-4 w-4" />}
            title="Investigation and report orders"
            description="Read-only payment and fulfilment truth from the secured order ledger."
          />
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {loading ? (
              <LoadingRows />
            ) : orders.length === 0 ? (
              <EmptyOperationalState
                title="No report orders recorded"
                body="Easy Erf has no report-order records visible to this admin account yet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-left text-xs">
                  <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Property</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((order) => (
                      <tr key={order.id} className="align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{order.report_type}</div>
                          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {shortId(order.id)}
                          </div>
                          {order.failure_reason ? (
                            <div className="mt-2 max-w-xs text-[11px] leading-relaxed text-destructive">
                              {order.failure_reason}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-foreground">
                          {order.parcel_id ??
                            orderPayloadText(order, "propertyReference") ??
                            "Property reference pending"}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                          {order.user_id
                            ? shortId(order.user_id)
                            : orderPayloadText(order, "customerEmail") ?? "Unmatched"}
                        </td>
                        <td className="px-4 py-3">
                          {readableLabel(order.provider || order.provider_id || "Not recorded")}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip status={orderStatus(order)} />
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {order.price_cents > 0 ? formatMoney(order.price_cents) : "No charge recorded"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDateTime(order.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section id="provider-activity" className="scroll-mt-28 pt-10">
          <SectionHeading
            icon={<Activity className="h-4 w-4" />}
            title="Provider activity"
            description="The most recent provider audit events, including latency and failures where recorded."
          />
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {loading ? (
              <LoadingRows />
            ) : auditRows.length === 0 ? (
              <EmptyOperationalState
                title="No provider activity recorded"
                body="No provider audit events are visible to this admin account yet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[940px] w-full text-left text-xs">
                  <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Resource</th>
                      <th className="px-4 py-3">Latency</th>
                      <th className="px-4 py-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-semibold text-foreground">{row.provider}</td>
                        <td className="px-4 py-3">{readableLabel(row.action)}</td>
                        <td className="px-4 py-3">
                          <StatusChip status={row.status} />
                          {row.error_code ? (
                            <div className="mt-1 font-mono text-[10px] text-destructive">
                              {row.error_code}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                          {row.user_id ? shortId(row.user_id) : "System"}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                          {row.resource_id ? shortId(row.resource_id) : "None"}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {row.latency_ms == null ? "Not recorded" : `${row.latency_ms} ms`}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDateTime(row.at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section id="system-health" className="scroll-mt-28 pt-10">
          <SectionHeading
            icon={<HeartPulse className="h-4 w-4" />}
            title="System health"
            description="Configured provider status and live provider checks. Developer diagnostics remain separated below."
          />

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <OperationalPanel title="Configured providers" icon={<Database className="h-4 w-4" />}>
              {providerSettings.length === 0 ? (
                <p className="text-xs text-muted-foreground">No provider settings are visible.</p>
              ) : (
                <div className="divide-y divide-border">
                  {providerSettings.map((provider) => (
                    <div key={provider.provider} className="flex items-start justify-between gap-4 py-3">
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          {readableLabel(provider.provider)}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {provider.last_checked_at
                            ? `Last checked ${formatDateTime(provider.last_checked_at)}`
                            : "No health check time recorded"}
                        </div>
                        {provider.last_health ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {provider.last_health}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <BooleanChip label={provider.enabled ? "Enabled" : "Disabled"} active={provider.enabled} />
                        {provider.is_active ? <BooleanChip label="Active" active /> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </OperationalPanel>

            <OperationalPanel title="Live provider checks" icon={<HeartPulse className="h-4 w-4" />}>
              <div className="divide-y divide-border">
                {listProviders().map((provider) => {
                  const health = providerHealth[provider.meta.id];
                  const healthy = health?.status === "active";
                  return (
                    <div key={provider.meta.id} className="flex items-start justify-between gap-4 py-3">
                      <div>
                        <div className="text-xs font-semibold text-foreground">{provider.meta.name}</div>
                        <div className="mt-1 max-w-md text-[11px] leading-relaxed text-muted-foreground">
                          {health?.message ?? provider.meta.description}
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                          !health
                            ? "bg-muted text-muted-foreground"
                            : healthy
                              ? "bg-success/10 text-success"
                              : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {!health ? (
                          <CircleDashed className="h-3 w-3" />
                        ) : healthy ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        {health?.status ? readableLabel(health.status) : "Checking"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </OperationalPanel>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                <HardHat className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground">Developer and provider diagnostics</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  These tools are useful for diagnosing upstream data and configuration. They are not business controls and remain separate from customer support actions.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/admin/readiness"
                    className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted"
                  >
                    Provider readiness
                  </Link>
                  <Link
                    to="/admin/public-data-debug"
                    className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted"
                  >
                    Public data debug
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="support-boundary" className="scroll-mt-28 pt-10">
          <SectionHeading
            icon={<UserRoundSearch className="h-4 w-4" />}
            title="Support coverage"
            description="What Founder Operations can safely inspect today and what still needs a trusted support boundary."
          />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <OperationalPanel title="Available now" icon={<CheckCircle2 className="h-4 w-4" />}>
              <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <li>Report-order status, provider linkage and recorded failures.</li>
                <li>Provider audit activity, errors and latency where recorded.</li>
                <li>Provider configuration health that the existing admin role may read.</li>
                <li>Existing readiness and public-data diagnostics.</li>
              </ul>
            </OperationalPanel>
            <OperationalPanel title="Next trusted support layer" icon={<ShieldCheck className="h-4 w-4" />}>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Cross-user property investigations, uploaded evidence, Site Potential jobs, entitlements and intervention history are not exposed here by pretending the browser is privileged. The next operations tranche should add a narrowly authorized support boundary with an audit trail before those customer-support tools appear.
              </p>
              <p className="mt-3 text-xs font-medium text-foreground">
                No refund, credit-grant, destructive repair or impersonation control is shown until a real trusted action exists behind it.
              </p>
            </OperationalPanel>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Anchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-foreground hover:bg-muted"
    >
      {children}
    </a>
  );
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-accent">
        {icon}
      </span>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  attention = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  attention?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={attention ? "text-destructive" : "text-accent"}>{icon}</span>
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${attention ? "text-destructive" : "text-foreground"}`}>
        {value}
      </div>
      {detail ? <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function OperationalPanel({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function EmptyOperationalState({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-6 text-center">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2 p-4">
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-12 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const positive = ["ok", "active", "complete", "paid"].includes(normalized);
  const negative = ["failed", "error", "down", "cancelled"].includes(normalized);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
        positive
          ? "bg-success/10 text-success"
          : negative
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {positive ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : negative ? (
        <AlertCircle className="h-3 w-3" />
      ) : (
        <CircleDashed className="h-3 w-3" />
      )}
      {readableLabel(status)}
    </span>
  );
}

function BooleanChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
        active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

function orderPayloadText(order: ReportOrderRow, key: string) {
  if (!order.payload || typeof order.payload !== "object" || Array.isArray(order.payload)) {
    return null;
  }
  const value = (order.payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function orderStatus(order: ReportOrderRow) {
  return order.status_enum ?? order.status ?? "unknown";
}

function readableLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortId(value: string) {
  return value.length <= 14 ? value : `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not available";
  return date.toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
