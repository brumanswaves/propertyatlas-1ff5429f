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

  const navLinkBase =
    "relative rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white/70 transition hover:text-white";
  const navLinkActive =
    "text-white after:absolute after:inset-x-2 after:-bottom-1 after:h-[2px] after:rounded-full after:bg-[#FF6A00] after:shadow-[0_0_12px_rgba(255,106,0,0.7)]";

  return (
    <header
      className={
        mapHeader
          ? "fixed inset-x-0 top-0 z-[70] border-b border-white/5 bg-[#06152A]/85 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] shadow-[0_18px_42px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl md:px-6 md:pt-2"
          : "absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 md:px-6"
      }
    >
      <div
        className={
          mapHeader ? "mx-auto flex max-w-[1600px] items-center justify-between gap-4" : "contents"
        }
      >
        <Link
          to="/"
          className="group inline-flex shrink-0 items-center gap-2 rounded-xl px-1 py-1 transition hover:opacity-90"
          aria-label="Easy Erf — home"
        >
          <AtlasPin variant="white" className="h-5 w-auto md:h-6" title={BRAND.site} />
        </Link>

        {center && <div className="hidden min-w-0 flex-1 md:block">{center}</div>}

        <nav className="hidden shrink-0 items-center gap-0.5 md:flex">
          {PRIMARY_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.to === "/" }}
              className={navLinkBase}
              activeProps={{ className: navLinkActive }}
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <span className="px-3 py-1.5 text-[12px] font-semibold text-white/85">
                Hello {greetingName}
              </span>
              <Link
                to="/dashboard"
                className={navLinkBase}
                activeProps={{ className: navLinkActive }}
              >
                Dashboard
              </Link>
              <Link
                to="/profile"
                className={navLinkBase}
                activeProps={{ className: navLinkActive }}
              >
                Profile
              </Link>
              <Button
                size="sm"
                variant="ghost"
                className="ml-1 h-8 rounded-full border border-white/15 bg-white/[0.04] text-[12px] font-semibold text-white hover:bg-white/[0.1] hover:text-white"
                onClick={() => supabase.auth.signOut()}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth" className={navLinkBase}>
                Sign in
              </Link>
              <Link to="/auth">
                <Button
                  size="sm"
                  className="h-8 rounded-full bg-[#FF6A00] text-[12px] font-semibold text-white shadow-[0_10px_28px_-10px_rgba(255,106,0,0.75)] hover:bg-[#ff7a1a]"
                >
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
          className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-white ring-1 ring-white/15 backdrop-blur md:hidden"
          aria-label="Menu"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {mapHeader && (
        <div className="mt-2 grid gap-1.5 md:hidden">
          {mobileCenter}
          {subtitle && (
            <div className="hidden rounded-xl bg-white/[0.05] px-3 py-1.5 text-center text-[11px] font-medium text-white/75 ring-1 ring-white/10 sm:block">
              {subtitle}
            </div>
          )}
        </div>
      )}

      {mapHeader && subtitle && (
        <div className="mx-auto mt-1.5 hidden max-w-3xl text-center text-[12px] font-medium text-white/70 md:block">
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
