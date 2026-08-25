import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Gift,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { EntitlementGrantHistory } from "@/components/admin/EntitlementGrantHistory";
import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { grantComplimentarySitePotentialCredit } from "@/lib/admin/founderSupportActionsClient";
import {
  readFounderSupportUser,
  searchFounderSupportUsers,
} from "@/lib/admin/founderSupportClient";
import type {
  FounderSupportUserDetail,
  FounderSupportUserSummary,
} from "@/lib/admin/founderSupportTypes";

export const Route = createFileRoute("/admin_/entitlements")({
  head: () => ({
    meta: [
      { title: "Entitlements | Easy Erf Operations" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FounderEntitlementsPage,
});

function FounderEntitlementsPage() {
  return (
    <AdminGuard>
      <FounderEntitlements />
    </AdminGuard>
  );
}

function FounderEntitlements() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<FounderSupportUserSummary[]>([]);
  const [selected, setSelected] = useState<FounderSupportUserDetail | null>(null);
  const [reason, setReason] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await searchFounderSupportUsers(query);
      if (!response.success) throw new Error(response.error);
      setUsers(response.users);
      if (response.users.length === 1) await selectUser(response.users[0].id);
    } catch (caught) {
      setUsers([]);
      setSelected(null);
      setError(caught instanceof Error ? caught.message : "Could not search users.");
    } finally {
      setSearching(false);
    }
  }

  async function selectUser(userId: string) {
    setLoadingUser(true);
    setError(null);
    setSuccess(null);
    setReason("");
    try {
      const response = await readFounderSupportUser(userId);
      if (!response.success) throw new Error(response.error);
      setSelected(response.detail);
    } catch (caught) {
      setSelected(null);
      setError(caught instanceof Error ? caught.message : "Could not load entitlement state.");
    } finally {
      setLoadingUser(false);
    }
  }

  async function grant(event: FormEvent) {
    event.preventDefault();
    if (!selected || granting) return;
    setGranting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await grantComplimentarySitePotentialCredit({
        targetUserId: selected.user.id,
        reason,
      });
      setSuccess(
        `Granted 1 complimentary Site Potential generation. Beta credits: ${response.grant.previousBetaCreditsRemaining} → ${response.grant.betaCreditsRemaining}.`,
      );
      setReason("");
      const refreshed = await readFounderSupportUser(selected.user.id);
      if (refreshed.success) setSelected(refreshed.detail);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not grant Site Potential access.");
    } finally {
      setGranting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-32 sm:px-6">
        <header>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-accent" /> Easy Erf Operations
          </span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Entitlements</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Grant a customer one complimentary Site Potential generation when a real support reason justifies it. Every grant records the acting admin and reason in the existing Easy Erf entitlement record.
          </p>
        </header>

        <section className="mt-7 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
            <label className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Find customer
              </span>
              <div className="mt-1.5 flex items-center rounded-xl border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Email, name or exact user ID"
                  className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </label>
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="self-end rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </form>
        </section>

        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-success/25 bg-success/5 p-4 text-sm text-success">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {success}
          </div>
        ) : null}

        {users.length > 1 ? (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-foreground">Choose customer</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => void selectUser(user.id)}
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
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {loadingUser ? (
          <div className="mt-7 h-52 animate-pulse rounded-2xl border border-border bg-card" />
        ) : selected ? (
          <>
            <section className="mt-7 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-accent">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-foreground">
                      {selected.user.fullName || selected.user.email || "Easy Erf user"}
                    </h2>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{selected.user.email || selected.user.id}</p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <EntitlementMetric
                    label="Purchased credits"
                    value={selected.entitlements.purchasedCredits?.balance ?? 0}
                  />
                  <EntitlementMetric
                    label="Beta credits"
                    value={selected.entitlements.activeBetaCredits}
                  />
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                  The complimentary grant adds one beta credit. It does not start generation automatically and does not charge the image provider until the customer later redeems an eligible Site Potential generation.
                </p>
              </div>

              <form onSubmit={grant} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                    <Gift className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Grant 1 complimentary generation</h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Use for support recovery, a goodwill exception or an approved beta allowance. A reason is required for the audit record.
                    </p>
                  </div>
                </div>

                <label className="mt-5 block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Support reason
                  </span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={4}
                    maxLength={500}
                    placeholder="Example: Restore access after a failed support workflow."
                    className="mt-1.5 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>

                <div className="mt-4 rounded-xl border border-warning/25 bg-warning/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
                  This action creates a real entitlement record. Confirm the customer and reason before granting. This tranche does not expose revoke, refund or destructive repair controls.
                </div>

                <button
                  type="submit"
                  disabled={granting || reason.trim().length < 8}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Gift className="h-3.5 w-3.5" />
                  {granting ? "Granting..." : "Grant 1 generation"}
                </button>
              </form>
            </section>
            <EntitlementGrantHistory grants={selected.entitlements.betaCreditGrants} />
          </>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}

function EntitlementMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
