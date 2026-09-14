import { Link, useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { LockKeyhole } from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { useStaffAccess } from "@/lib/auth/StaffAccess";

const OperationsAccess = createContext({ isAdmin: false, accessToken: null as string | null });
export function useOperationsAccess() { return useContext(OperationsAccess); }

export function AdminGuard({ children, allowAssignedInvestigations = false, redirectInvestigator = false }: { children: ReactNode; allowAssignedInvestigations?: boolean; redirectInvestigator?: boolean }) {
  const { user, session, loading, role, checking, unavailable } = useStaffAccess();
  const navigate = useNavigate();
  const isAdmin = role === "founder";
  const isInvestigator = role === "investigator";

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: `${window.location.pathname}${window.location.search}${window.location.hash}` } });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (redirectInvestigator && isInvestigator) navigate({ to: "/investigator", replace: true, hash: window.location.hash.slice(1) });
  }, [redirectInvestigator, isInvestigator, navigate]);

  if (loading || !user || checking || (redirectInvestigator && isInvestigator)) return null;

  if (!isAdmin && !(allowAssignedInvestigations && isInvestigator)) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <TopNav />
        <main className="mx-auto grid w-full max-w-2xl flex-1 place-items-center px-4 py-28 sm:px-6">
          <section className="w-full rounded-2xl border border-border bg-card p-6 shadow-soft">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">
              {unavailable ? "Staff access could not be verified" : allowAssignedInvestigations ? "Investigator access required" : "Founder Operations access required"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {unavailable ? "Your session or staff access could not be confirmed. Sign in again or refresh to check your current access."
                : "This area is limited to authorised staff. Customer investigations and account tools remain available."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Signed in as {user.email}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {isInvestigator && <Link to="/investigator" className="rounded border border-border px-4 py-2 text-xs font-semibold">Back to Investigator Dashboard</Link>}
              <Link
                to="/"
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Find a Property
              </Link>
              <Link
                to="/dashboard"
                className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                My Investigations
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <OperationsAccess.Provider key={`${user.id}:${role}`} value={{ isAdmin, accessToken: session?.access_token ?? null }}>
      {isAdmin && <nav
        aria-label="Founder Operations"
        className="absolute left-1/2 top-20 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 gap-1 overflow-x-auto rounded-full border border-border bg-card/95 p-1 shadow-panel backdrop-blur"
      >
        <OperationsLink href="/admin">Founder Dashboard</OperationsLink>
        <OperationsLink href="/admin/users">Users & Investigators</OperationsLink>
        <OperationsLink href="/investigator">Investigator Dashboard</OperationsLink>
        <OperationsLink href="/admin/entitlements">Entitlements</OperationsLink>
        <OperationsLink href="/admin/launch-readiness">Launch</OperationsLink>
        <OperationsLink href="/admin/readiness">Providers</OperationsLink>
        <OperationsLink href="/admin/public-data-debug">Data debug</OperationsLink>
      </nav>}
      {children}
    </OperationsAccess.Provider>
  );
}

function OperationsLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </a>
  );
}
