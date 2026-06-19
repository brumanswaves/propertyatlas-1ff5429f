import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  ArrowLeft,
  CircleCheck,
  CircleDashed,
  CircleAlert,
  CircleSlash,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { AdminGuard } from "@/components/admin/AdminGuard";
import {
  PROVIDER_READINESS,
  type ReadinessStatus,
} from "@/lib/providers/readiness";

export const Route = createFileRoute("/admin/readiness")({
  head: () => ({
    meta: [
      { title: "Provider Readiness — PropertyAtlas" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReadinessPage,
});

const STATUS_META: Record<
  ReadinessStatus,
  { label: string; tone: string; Icon: typeof CircleCheck }
> = {
  done: { label: "Done", tone: "bg-emerald-100 text-emerald-700", Icon: CircleCheck },
  partial: { label: "Partial", tone: "bg-amber-100 text-amber-800", Icon: CircleAlert },
  todo: { label: "Todo", tone: "bg-muted text-muted-foreground", Icon: CircleDashed },
  blocked: { label: "Blocked", tone: "bg-rose-100 text-rose-700", Icon: CircleSlash },
};

function ReadinessPage() {
  return (
    <AdminGuard>
      <ReadinessContent />
    </AdminGuard>
  );
}

function ReadinessContent() {
  const totals = PROVIDER_READINESS.map((p) => {
    const done = p.items.filter((i) => i.status === "done").length;
    return { id: p.provider, done, total: p.items.length };
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16 pt-28">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to admin
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-primary" /> Admin
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Provider integration readiness
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Per-provider checklist tying the data-integration plan to concrete
          schema tables and code modules. A provider is production-ready when
          every item is <span className="font-medium text-emerald-700">Done</span>.
        </p>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {totals.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t.id}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {t.done}/{t.total}
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${(t.done / t.total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Shared schema &amp; API modules
          </h2>
          <ul className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            {[
              ["Schema → provider_cache", "Server-side TTL cache for provider responses."],
              ["Schema → provider_audit_log", "POPIA-grade audit trail (user, action, latency)."],
              ["Schema → provider_settings", "Per-provider enable / active flags."],
              ["Schema → report_orders.status_enum", "Typed status: pending → complete."],
              ["Code → src/lib/providers/types.ts", "Normalized data model + MultiPolygon geometry."],
              ["Code → src/lib/providers/errors.ts", "ProviderError envelope (code + retryable)."],
              ["Code → src/lib/providers/PropertyProvider.ts", "Adapter contract every provider implements."],
              ["Code → src/lib/geo/reproject.ts", "Hartebeesthoek94 LO ↔ WGS84 reprojection."],
            ].map(([title, desc]) => (
              <li
                key={title}
                className="rounded-xl border border-border bg-card px-3 py-2"
              >
                <div className="font-medium">{title}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 space-y-6">
          {PROVIDER_READINESS.map((p) => (
            <div
              key={p.provider}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="border-b border-border bg-muted/40 px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.legal}</div>
                  </div>
                  <code className="rounded bg-background px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {p.provider}
                  </code>
                </div>
              </div>
              <ul className="divide-y divide-border">
                {p.items.map((i) => {
                  const meta = STATUS_META[i.status];
                  const Icon = meta.Icon;
                  return (
                    <li
                      key={i.id}
                      className="flex items-start gap-3 px-5 py-3 text-sm"
                    >
                      <span
                        className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{i.label}</div>
                        {i.ref ? (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            <code className="rounded bg-muted px-1 py-0.5">{i.ref}</code>
                            {i.note ? <span className="ml-2">{i.note}</span> : null}
                          </div>
                        ) : i.note ? (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {i.note}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
