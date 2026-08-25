import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  CircleDashed,
  FileSearch2,
  FileText,
  HardHat,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import {
  readFounderSupportUser,
  searchFounderSupportUsers,
} from "@/lib/admin/founderSupportClient";
import type {
  FounderSupportUserDetail,
  FounderSupportUserSummary,
} from "@/lib/admin/founderSupportTypes";
import { GUIDED_INVESTIGATION_STEPS } from "@/lib/investigation/guidedJourney";

export const Route = createFileRoute("/admin_/users")({
  head: () => ({
    meta: [
      { title: "User Support | Easy Erf Operations" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FounderUsersPage,
});

function FounderUsersPage() {
  return (
    <AdminGuard>
      <FounderUsers />
    </AdminGuard>
  );
}

function FounderUsers() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<FounderSupportUserSummary[]>([]);
  const [selected, setSelected] = useState<FounderSupportUserDetail | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const response = await searchFounderSupportUsers(query);
      if (!response.success) throw new Error(response.error);
      setUsers(response.users);
      if (response.users.length === 1) await openUser(response.users[0].id);
    } catch (caught) {
      setUsers([]);
      setError(caught instanceof Error ? caught.message : "Could not search users.");
    } finally {
      setSearching(false);
    }
  }

  async function openUser(userId: string) {
    setLoadingUser(true);
    setError(null);
    try {
      const response = await readFounderSupportUser(userId);
      if (!response.success) throw new Error(response.error);
      setSelected(response.detail);
    } catch (caught) {
      setSelected(null);
      setError(caught instanceof Error ? caught.message : "Could not load user support detail.");
    } finally {
      setLoadingUser(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-28 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-accent" /> Easy Erf Operations
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">User support</h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Find an Easy Erf customer and inspect the property work, processing state and commercial access already attached to their account. This screen is read-only.
            </p>
          </div>
          <a
            href="/admin"
            className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-soft hover:bg-muted"
          >
            Operations overview
          </a>
        </header>

        <section className="mt-7 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
            <label className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Email, name or exact user ID
              </span>
              <div className="mt-1.5 flex items-center rounded-xl border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search Easy Erf users"
                  className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </label>
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="self-end rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search users"}
            </button>
          </form>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Search runs through the trusted Easy Erf server boundary. The browser never receives the Supabase service-role credential.
          </p>
        </section>

        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        ) : null}

        {users.length > 0 ? (
          <section className="mt-6">
            <SectionHeading icon={<UsersRound className="h-4 w-4" />} title="Search results" />
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => void openUser(user.id)}
                  className={`rounded-2xl border p-4 text-left shadow-soft transition hover:bg-muted/40 ${
                    selected?.user.id === user.id ? "border-accent bg-accent/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {user.fullName || user.email || "Easy Erf user"}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{user.email || user.id}</div>
                    </div>
                    <UserRound className="h-4 w-4 shrink-0 text-accent" />
                  </div>
                  <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
                    <span>{user.savedPropertyCount} properties</span>
                    <span>{user.reportOrderCount} report orders</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {loadingUser ? <LoadingDetail /> : selected ? <UserDetail detail={selected} /> : null}
      </main>
      <Footer />
    </div>
  );
}

function UserDetail({ detail }: { detail: FounderSupportUserDetail }) {
  const failedAssets = detail.assets.filter((asset) => asset.status === "failed").length;
  const failedPacks = detail.designPacks.filter((pack) =>
    ["failed", "partial_failed"].includes(pack.status),
  ).length;
  const failedOrders = detail.reportOrders.filter((order) => order.status === "failed").length;
  const providerErrors = detail.providerEvents.filter((event) => event.status !== "ok").length;
  const attention = failedAssets + failedPacks + failedOrders + providerErrors;

  return (
    <div className="mt-8 space-y-8">
      <section>
        <SectionHeading icon={<UserRound className="h-4 w-4" />} title="Customer record" />
        <div className="mt-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {detail.user.fullName || detail.user.email || "Easy Erf user"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{detail.user.email || "No email in profile"}</p>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">{detail.user.id}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Info label="Account type" value={detail.user.accountType || "registered"} />
              <Info label="Joined" value={formatDate(detail.user.createdAt)} />
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Properties" value={detail.savedProperties.length} />
          <Metric label="Evidence files" value={detail.assets.length} attention={failedAssets > 0} />
          <Metric label="Site projects" value={detail.sitePotentialProjects.length} />
          <Metric label="Concept packs" value={detail.designPacks.length} attention={failedPacks > 0} />
          <Metric label="Report orders" value={detail.reportOrders.length} attention={failedOrders > 0} />
          <Metric label="Needs attention" value={attention} attention={attention > 0} />
        </div>
      </section>

      <section>
        <SectionHeading icon={<Sparkles className="h-4 w-4" />} title="Site Potential access" />
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <InfoCard
            label="Purchased credits"
            value={String(detail.entitlements.purchasedCredits?.balance ?? 0)}
            detail={
              detail.entitlements.purchasedCredits
                ? `${detail.entitlements.purchasedCredits.lifetimePurchased} purchased · ${detail.entitlements.purchasedCredits.lifetimeConsumed} consumed`
                : "No purchased-credit wallet recorded"
            }
          />
          <InfoCard
            label="Active beta credits"
            value={String(detail.entitlements.activeBetaCredits)}
            detail="Unexpired beta allowance recorded for this account"
          />
          <InfoCard
            label="Support mode"
            value="Read only"
            detail="No credit grant or restore action is exposed in this tranche"
          />
        </div>
      </section>

      <section>
        <SectionHeading icon={<FileSearch2 className="h-4 w-4" />} title="Property investigations" />
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {detail.savedProperties.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Guided position</th>
                    <th className="px-4 py-3">Identity</th>
                    <th className="px-4 py-3">Planning</th>
                    <th className="px-4 py-3">Site Potential</th>
                    <th className="px-4 py-3">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {detail.savedProperties.map((property) => {
                    const investigation = property.investigation;
                    return (
                      <tr key={property.parcelId} className="align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{property.title}</div>
                          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {property.parcelId}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {[property.erfNumber ? `Erf ${property.erfNumber}` : null, property.portion ? `Portion ${property.portion}` : null, property.municipality]
                              .filter(Boolean)
                              .join(" · ") || "Property details not recorded"}
                          </div>
                        </td>
                        <td className="px-4 py-3">{guidedPosition(investigation)}</td>
                        <td className="px-4 py-3">
                          <StateChip value={investigation?.identityStatus || "not confirmed"} />
                        </td>
                        <td className="px-4 py-3">
                          {investigation?.planning.zoneCode ? (
                            <div>
                              <div className="font-semibold text-foreground">{investigation.planning.zoneCode}</div>
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                {investigation.planning.userConfirmedZoneCode === investigation.planning.zoneCode
                                  ? "User-confirmed working zoning"
                                  : "Working zoning not confirmed"}
                              </div>
                            </div>
                          ) : (
                            "Not recorded"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StateChip value={investigation?.sitePotential.progressState || "not started"} />
                        </td>
                        <td className="px-4 py-3">{investigation?.reportStarted ? "Opened" : "Not opened"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text="No saved investigations are attached to this account." />
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SupportTable
          icon={<FileText className="h-4 w-4" />}
          title="Evidence processing"
          empty="No uploaded evidence records."
          rows={detail.assets.slice(0, 30).map((asset) => ({
            id: asset.id,
            primary: asset.fileName,
            secondary: `${asset.category.replaceAll("_", " ")} · ${asset.parcelId}`,
            state: asset.status,
            detail: formatDate(asset.updatedAt),
          }))}
        />
        <SupportTable
          icon={<HardHat className="h-4 w-4" />}
          title="Site Potential jobs"
          empty="No Site Potential project or concept-pack activity."
          rows={[
            ...detail.sitePotentialProjects.map((project) => ({
              id: project.id,
              primary: `${project.mode.replaceAll("_", " ")} project`,
              secondary: project.parcelId,
              state: project.generationStatus,
              detail: formatDate(project.updatedAt),
            })),
            ...detail.designPacks.map((pack) => ({
              id: pack.id,
              primary: `Concept pack · ${pack.completedCount}/${pack.requestedCount} complete`,
              secondary: pack.failureMessage || pack.parcelId,
              state: pack.status,
              detail: formatDate(pack.updatedAt),
            })),
          ].slice(0, 30)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SupportTable
          icon={<ReceiptText className="h-4 w-4" />}
          title="Report orders"
          empty="No paid-report order records."
          rows={detail.reportOrders.slice(0, 30).map((order) => ({
            id: order.id,
            primary: order.reportType,
            secondary: order.failureReason || `${order.providerId || "No provider"} · ${order.parcelId}`,
            state: order.status,
            detail: order.priceCents > 0 ? formatMoney(order.priceCents) : formatDate(order.createdAt),
          }))}
        />
        <SupportTable
          icon={<Boxes className="h-4 w-4" />}
          title="Recent provider activity"
          empty="No provider audit events recorded."
          rows={detail.providerEvents.slice(0, 30).map((event) => ({
            id: event.id,
            primary: `${event.provider} · ${event.action.replaceAll("_", " ")}`,
            secondary: event.errorCode || event.resourceId || "No error recorded",
            state: event.status,
            detail: `${formatDate(event.at)}${event.latencyMs == null ? "" : ` · ${event.latencyMs} ms`}`,
          }))}
        />
      </section>
    </div>
  );
}

function SupportTable({
  icon,
  title,
  empty,
  rows,
}: {
  icon: ReactNode;
  title: string;
  empty: string;
  rows: Array<{ id: string; primary: string; secondary: string; state: string; detail: string }>;
}) {
  return (
    <div>
      <SectionHeading icon={icon} title={title} />
      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {rows.length ? (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-foreground">{row.primary}</div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {row.secondary}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{row.detail}</div>
                </div>
                <StateChip value={row.state} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty text={empty} />
        )}
      </div>
    </div>
  );
}

function SectionHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-muted text-accent">{icon}</span>
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
    </div>
  );
}

function Metric({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${attention ? "text-destructive" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

function StateChip({ value }: { value: string }) {
  const normalized = value.toLowerCase().replaceAll("_", " ");
  const good = ["ready", "complete", "concepts ready", "design selected", "looks correct", "ok", "paid"].some((item) => normalized.includes(item));
  const bad = ["failed", "error", "uncertain", "partial failed"].some((item) => normalized.includes(item));
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${
        good
          ? "bg-success/10 text-success"
          : bad
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {good ? <CheckCircle2 className="h-3 w-3" /> : bad ? <AlertCircle className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
      {normalized}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-5 text-xs text-muted-foreground">{text}</div>;
}

function LoadingDetail() {
  return (
    <div className="mt-8 space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
      ))}
    </div>
  );
}

function guidedPosition(investigation: FounderSupportUserDetail["savedProperties"][number]["investigation"]) {
  if (!investigation?.investigation.startedAt) return "Not started";
  const stepId = investigation.investigation.currentStepId;
  const index = stepId ? GUIDED_INVESTIGATION_STEPS.findIndex((step) => step.id === stepId) : -1;
  if (index < 0) return "Investigation started";
  return `Step ${index + 1} of ${GUIDED_INVESTIGATION_STEPS.length} · ${GUIDED_INVESTIGATION_STEPS[index].label}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(cents / 100);
}
