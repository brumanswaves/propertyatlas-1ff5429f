import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { LockKeyhole } from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(null);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(Boolean(data));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || !user || isAdmin === null) return null;

  if (!isAdmin) {
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

  return <>{children}</>;
}
