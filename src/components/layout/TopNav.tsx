import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { Menu, Sparkles, X } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { getUserGreetingName } from "@/lib/auth/profile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AtlasPin } from "@/components/brand/AtlasPin";
import { BRAND } from "@/lib/brand";
import { PRIMARY_NAV_LINKS, SIGNED_IN_NAV_LINKS } from "@/lib/navigation";

interface TopNavProps {
  center?: ReactNode;
  mobileCenter?: ReactNode;
  onLogoClick?: () => void;
  subtitle?: ReactNode;
}

export function TopNav({ center, mobileCenter, onLogoClick, subtitle }: TopNavProps = {}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const greetingName = getUserGreetingName(user);
  const mapHeader = Boolean(center || mobileCenter || subtitle);

  const navLinkBase = mapHeader
    ? "relative rounded-lg px-3 py-1.5 text-[12px] font-semibold text-primary-foreground/80 transition hover:bg-primary-foreground/[0.06] hover:text-primary-foreground"
    : "relative rounded-lg px-3 py-1.5 text-[12px] font-semibold text-foreground/75 transition hover:bg-muted hover:text-foreground";
  const navLinkActive = mapHeader
    ? "text-primary-foreground after:absolute after:inset-x-2 after:-bottom-1 after:h-[2px] after:rounded-full after:bg-accent"
    : "text-foreground after:absolute after:inset-x-2 after:-bottom-1 after:h-[2px] after:rounded-full after:bg-accent";

  return (
    <header
      className={
        mapHeader
          ? "fixed inset-x-0 top-0 z-[70] border-b border-primary-foreground/10 bg-primary/95 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] shadow-panel backdrop-blur-xl md:px-6 md:pt-2"
          : "absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 text-foreground md:px-6"
      }
    >
      <div
        className={
          mapHeader ? "mx-auto flex max-w-[1600px] items-center justify-between gap-4" : "contents"
        }
      >
        <Link
          to="/"
          onClick={onLogoClick}
          className="group inline-flex h-10 w-[148px] shrink-0 items-center justify-center rounded-full border border-border/70 bg-card px-4 shadow-soft ring-1 ring-primary/5 transition hover:bg-background hover:shadow-panel md:w-[156px]"
          aria-label="Easy Erf home"
        >
          <AtlasPin
            variant="horizontal"
            className="block h-[24px] w-auto max-w-[124px] object-contain md:h-[26px] md:max-w-[132px]"
            title={BRAND.site}
          />
        </Link>

        {center && <div className="hidden min-w-0 flex-1 md:block">{center}</div>}

        <nav className="hidden shrink-0 items-center gap-0.5 md:flex" aria-label="Primary navigation">
          {PRIMARY_NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: link.to === "/" }}
              className={navLinkBase}
              activeProps={{ className: navLinkActive }}
            >
              {link.label}
            </Link>
          ))}

          {user ? (
            <>
              {SIGNED_IN_NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={navLinkBase}
                  activeProps={{ className: navLinkActive }}
                >
                  {link.label}
                </Link>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className={
                  mapHeader
                    ? "ml-1 h-8 rounded-full border border-primary-foreground/20 bg-primary-foreground/[0.06] text-[12px] font-semibold text-primary-foreground hover:bg-primary-foreground/12 hover:text-primary-foreground"
                    : "ml-1 h-8 rounded-full border border-border bg-card text-[12px] font-semibold text-foreground shadow-sm hover:bg-muted hover:text-foreground"
                }
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
                  className="h-8 rounded-full bg-accent text-[12px] font-semibold text-accent-foreground shadow-soft hover:bg-accent/90"
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  Start free
                </Button>
              </Link>
            </>
          )}
        </nav>

        <button
          onClick={() => setOpen((current) => !current)}
          className={
            mapHeader
              ? "grid h-10 w-10 place-items-center rounded-full bg-primary-foreground/[0.06] text-primary-foreground ring-1 ring-primary-foreground/15 backdrop-blur md:hidden"
              : "grid h-10 w-10 place-items-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border md:hidden"
          }
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {mapHeader && (
        <div className="mt-2 grid gap-1.5 md:hidden">
          {mobileCenter}
          {subtitle && (
            <div className="hidden rounded-xl bg-primary-foreground/[0.05] px-3 py-1.5 text-center text-[11px] font-medium text-primary-foreground/75 ring-1 ring-primary-foreground/10 sm:block">
              {subtitle}
            </div>
          )}
        </div>
      )}

      {mapHeader && subtitle && (
        <div className="mx-auto mt-1.5 hidden max-w-3xl text-center text-[12px] font-medium text-primary-foreground/75 md:block">
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
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Easy Erf
            </div>
            <ul className="grid gap-1">
              {PRIMARY_NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    onClick={() => setOpen(false)}
                    activeOptions={{ exact: link.to === "/" }}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground/85 hover:bg-muted"
                    activeProps={{ className: "bg-muted text-foreground" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {user &&
                SIGNED_IN_NAV_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground/85 hover:bg-muted"
                      activeProps={{ className: "bg-muted text-foreground" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
            </ul>

            <div className="mt-2 border-t border-border pt-3">
              {user ? (
                <div className="grid gap-2">
                  <div className="px-1 text-xs font-medium text-foreground">
                    Signed in as {greetingName}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-lg text-xs"
                    onClick={() => {
                      setOpen(false);
                      supabase.auth.signOut();
                    }}
                  >
                    Sign out
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/auth"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-border px-3 py-2 text-center text-xs font-medium"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/auth"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-accent px-3 py-2 text-center text-xs font-semibold text-accent-foreground"
                  >
                    Start free
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
