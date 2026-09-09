import { Link, useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LockKeyhole } from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { investigationClient } from "@/lib/investigation/investigationClient";

const OperationsAccess = createContext({ isAdmin: false });
export function useOperationsAccess() { return useContext(OperationsAccess); }

export function AdminGuard({ children, allowAssignedInvestigations = false }: { children: ReactNode; allowAssignedInvestigations?: boolean }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [access, setAccess] = useState<{ userId: string; isAdmin: boolean; assigned: boolean } | null>(null);
  const currentAccess = access?.userId === user?.id ? access : null;
  const isAdmin = currentAccess?.isAdmin ?? null;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setAccess(null);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        let assigned = false;
        if (!data && !error && allowAssignedInvestigations) {
          const result = await investigationClient.rpc("list_assigned_investigation_queue", {});
          assigned = !result.error && Array.isArray(result.data) && result.data.length > 0;
        }
        if (!cancelled) setAccess({ userId: user.id, isAdmin: !error && Boolean(data), assigned });
      });
    return () => {
      cancelled = true;
    };
  }, [user, allowAssignedInvestigations]);

  if (loading || !user || isAdmin === null) return null;

  if (!isAdmin && !currentAccess?.assigned) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <TopNav />
        <main className="mx-auto grid w-full max-w-2xl flex-1 place-items-center px-4 py-28 sm:px-6">
          <section className="w-full rounded-2xl border border-border bg-card p-6 shadow-soft">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">
              Founder Operations access required
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Easy Erf Operations is limited to accounts with the admin role. Normal customer
              investigations and account tools remain available below.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Signed in as {user.email}</p>
            <div className="mt-5 flex flex-wrap gap-2">
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
    <OperationsAccess.Provider value={{ isAdmin }}>
      {isAdmin && <nav
        aria-label="Founder Operations"
        className="absolute left-1/2 top-20 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 gap-1 overflow-x-auto rounded-full border border-border bg-card/95 p-1 shadow-panel backdrop-blur"
      >
        <OperationsLink href="/admin">Overview</OperationsLink>
        <OperationsLink href="/admin/users">Users</OperationsLink>
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
