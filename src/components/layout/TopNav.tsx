import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { getUserGreetingName } from "@/lib/auth/profile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AtlasPin } from "@/components/brand/AtlasPin";

const PRIMARY_LINKS = [
  { to: "/", label: "Map" },
  { to: "/features", label: "Features" },
  { to: "/about", label: "About" },
  { to: "/pricing", label: "Pricing" },
] as const;

const MOBILE_LINKS = [
  ...PRIMARY_LINKS,
  { to: "/how-it-works", label: "How it works" },
  { to: "/for-investors", label: "For Investors" },
  { to: "/for-homeowners", label: "For Homeowners" },
  { to: "/for-developers", label: "For Developers" },
  { to: "/faq", label: "FAQ" },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/partnerships", label: "Partnerships" },
  { to: "/contact", label: "Contact" },
] as const;

export function TopNav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const greetingName = getUserGreetingName(user);

  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 md:px-6">
      <Link
        to="/"
        className="flex items-center gap-2 rounded-full bg-card/95 px-3 py-2 shadow-soft backdrop-blur ring-1 ring-border/60"
      >
        <AtlasPin className="h-6 w-auto" />
        <span className="text-sm font-semibold tracking-tight text-foreground">PropertyAtlas</span>
        <span className="ml-1 hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground lg:inline">
          Pilot · St Francis Bay
        </span>
      </Link>

      <nav className="hidden items-center gap-1 rounded-full bg-card/90 p-1.5 shadow-soft backdrop-blur md:flex">
        {PRIMARY_LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeOptions={{ exact: l.to === "/" }}
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            {l.label}
          </Link>
        ))}
        {user ? (
          <>
            <span className="px-3 py-1.5 text-xs font-medium text-foreground">
              Hello {greetingName}
            </span>
            <Link
              to="/dashboard"
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              to="/profile"
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Profile
            </Link>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-full text-xs"
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Link
              to="/auth"
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
            <Link to="/auth">
              <Button size="sm" className="h-8 rounded-full bg-gradient-brand text-xs">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Start free
              </Button>
            </Link>
          </>
        )}
      </nav>

      {/* Mobile trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid h-10 w-10 place-items-center rounded-full bg-card/95 shadow-soft ring-1 ring-border/60 backdrop-blur md:hidden"
        aria-label="Menu"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm md:hidden"
          />
          <div className="fixed inset-x-3 top-16 z-50 max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-panel md:hidden">
            <ul className="grid gap-1">
              {MOBILE_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    onClick={() => setOpen(false)}
                    activeOptions={{ exact: l.to === "/" }}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground/85 hover:bg-muted"
                    activeProps={{ className: "bg-muted text-foreground" }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center gap-2 border-t border-border pt-3">
              {user ? (
                <div className="grid w-full gap-2">
                  <div className="px-1 text-xs font-medium text-foreground">
                    Hello {greetingName}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/dashboard"
                      onClick={() => setOpen(false)}
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-xs font-medium"
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setOpen(false)}
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-xs font-medium"
                    >
                      Profile
                    </Link>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 flex-1 rounded-lg text-xs"
                    onClick={() => supabase.auth.signOut()}
                  >
                    Sign out
                  </Button>
                </div>
              ) : (
                <>
                  <Link
                    to="/auth"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-xs font-medium"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/auth"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-lg bg-gradient-brand px-3 py-2 text-center text-xs font-semibold text-primary-foreground"
                  >
                    Start free
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
