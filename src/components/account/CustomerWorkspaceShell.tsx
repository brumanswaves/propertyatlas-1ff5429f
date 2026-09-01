import { Link } from "@tanstack/react-router";
import { MapPinned, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";

export type CustomerWorkspaceTab = "investigations" | "reports";

export function CustomerWorkspaceShell({
  activeTab,
  children,
}: {
  activeTab: CustomerWorkspaceTab;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-28 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3 text-accent" /> My Easy Erf
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">My Properties</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Keep your saved property investigations and done-for-you reports in one place.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
          >
            <MapPinned className="h-3.5 w-3.5" /> Find another property
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="My Properties sections">
          <Link
            to="/dashboard"
            role="tab"
            aria-selected={activeTab === "investigations"}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              activeTab === "investigations"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            My Investigations
          </Link>
          <Link
            to="/orders"
            role="tab"
            aria-selected={activeTab === "reports"}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              activeTab === "reports"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            Done-for-You Reports
          </Link>
        </div>

        <div className="mt-8" role="tabpanel">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
