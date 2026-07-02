import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { Sparkles, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { getUserGreetingName } from "@/lib/auth/profile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AtlasPin } from "@/components/brand/AtlasPin";
import { BRAND } from "@/lib/brand";

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

interface TopNavProps {
  center?: ReactNode;
  mobileCenter?: ReactNode;
  subtitle?: ReactNode;
}

export function TopNav({ center, mobileCenter, subtitle }: TopNavProps = {}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const greetingName = getUserGreetingName(user);
  const mapHeader = Boolean(center || mobileCenter || subtitle);

  return (
    <header
      className={
        mapHeader
          ? "fixed inset-x-0 top-0 z-[70] border-b border-[#0D1B2A]/10 bg-[#fbf8f1]/94 px-3 py-2 shadow-[0_16px_42px_-34px_rgba(13,27,42,0.55)] backdrop-blur-xl md:px-5"
          : "absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 md:px-6"
      }
    >
      <div className={mapHeader ? "flex items-center justify-between gap-3" : "contents"}>
      <Link
        to="/"
        className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-white/82 px-2.5 py-1.5 ring-1 ring-[#0D1B2A]/8 shadow-[0_8px_22px_-14px_rgba(13,27,42,0.28)] backdrop-blur-md transition hover:bg-white hover:ring-[#0D1B2A]/15"
        aria-label="ErfStoep — home"
      >
        <AtlasPin variant="horizontal" className="h-5 w-auto md:h-6" title={BRAND.site} />
      </Link>

      {center && <div className="hidden min-w-0 flex-1 md:block">{center}</div>}

      <nav className="hidden shrink-0 items-center gap-1 rounded-full bg-card/90 p-1.5 shadow-soft backdrop-blur md:flex">
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
      </div>

      {mapHeader && (
        <div className="mt-2 grid gap-1.5 md:hidden">
          {mobileCenter}
          {subtitle && (
            <div className="rounded-xl bg-white/78 px-3 py-2 text-center text-xs font-medium text-[#0D1B2A]/70 ring-1 ring-[#0D1B2A]/8">
              {subtitle}
            </div>
          )}
        </div>
      )}

      {mapHeader && subtitle && (
        <div className="mx-auto mt-1 hidden max-w-3xl text-center text-[11px] font-medium text-[#0D1B2A]/62 md:block">
          {subtitle}
        </div>
      )}

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
