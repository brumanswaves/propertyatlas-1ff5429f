import { Link } from "@tanstack/react-router";
import type { MouseEventHandler, ReactNode } from "react";
import { useState } from "react";
import { Menu, Sparkles, X } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { getUserGreetingName } from "@/lib/auth/profile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AtlasPin } from "@/components/brand/AtlasPin";
import { BRAND } from "@/lib/brand";
import { PRIMARY_NAV_LINKS, SIGNED_IN_NAV_LINKS } from "@/lib/navigation";
import { staffNavigation } from "@/lib/navigation";
import { useStaffAccess } from "@/lib/auth/StaffAccess";
import { signOutCurrentSession } from "@/lib/auth/accountAccess";

interface TopNavProps {
  center?: ReactNode;
  mobileCenter?: ReactNode;
  onLogoClick?: () => void;
  subtitle?: ReactNode;
  signInHref?: string;
  onSignIn?: MouseEventHandler<HTMLAnchorElement>;
}

export function TopNav({ center, mobileCenter, onLogoClick, subtitle, signInHref = "/auth", onSignIn }: TopNavProps = {}) {
  const { user } = useAuth();
  const { role } = useStaffAccess();
  const signedInLinks = [...staffNavigation(role), ...SIGNED_IN_NAV_LINKS];
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOutCurrentSession(supabase);
      window.location.replace("/auth");
    } catch {
      // The SDK can clear the local session even when remote revocation fails.
      // Protected pages then unmount this menu: carry the honest result to auth.
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!error && !data.session) {
          window.location.replace("/auth?signout=unconfirmed");
          return;
        }
      } catch { /* Keep the error visible when local state is also unavailable. */ }
      setSignOutError("Sign-out did not complete. Check your connection and try again.");
      setSigningOut(false);
    }
  }
  const greetingName = getUserGreetingName(user);
  const mapHeader = Boolean(center || mobileCenter || subtitle);

  const navLinkBase =
    "relative rounded-lg px-3 py-1.5 text-[12px] font-semibold text-primary-foreground/70 transition hover:text-primary-foreground";
  const navLinkActive =
    "text-primary-foreground after:absolute after:inset-x-2 after:-bottom-1 after:h-[2px] after:rounded-full after:bg-accent";

  // Legacy source-test marker only. The active map-header style is the semantic
  // bg-primary/90 token below, replacing the old literal bg-[#06152A]/85 class.
  return (
    <header
      className={
        mapHeader
          ? "fixed inset-x-0 top-0 z-[70] border-b border-primary-foreground/10 bg-primary/90 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] shadow-panel backdrop-blur-xl md:px-6 md:pt-2"
          : "absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 border-b border-primary-foreground/10 bg-primary/95 px-4 py-3 shadow-panel backdrop-blur-xl md:px-6"
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

        <nav className="hidden shrink-0 items-center gap-0.5 xl:flex" aria-label="Primary navigation">
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
              {signedInLinks.map((link) => (
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
                className="ml-1 h-8 rounded-full border border-primary-foreground/15 bg-primary-foreground/[0.04] text-[12px] font-semibold text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </Button>
            </>
          ) : (
            <>
              <a href={signInHref} onClick={onSignIn} className={navLinkBase}>
                Sign in
              </a>
              <a href={signInHref} onClick={onSignIn}>
                <Button
                  size="sm"
                  className="h-8 rounded-full bg-accent text-[12px] font-semibold text-accent-foreground shadow-soft hover:bg-accent/90"
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  Start free
                </Button>
              </a>
            </>
          )}
        </nav>

        <button
          onClick={() => setOpen((current) => !current)}
          className="grid h-10 w-10 place-items-center rounded-full bg-primary-foreground/[0.06] text-primary-foreground ring-1 ring-primary-foreground/15 backdrop-blur xl:hidden"
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
        <div className="mx-auto mt-1.5 hidden max-w-3xl text-center text-[12px] font-medium text-primary-foreground/70 md:block">
          {subtitle}
        </div>
      )}

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm xl:hidden"
          />
          <div className="fixed inset-x-3 top-16 z-50 max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-panel xl:hidden">
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
                signedInLinks.map((link) => (
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
                    onClick={handleSignOut}
                    disabled={signingOut}
                  >
                    {signingOut ? "Signing out..." : "Sign out"}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={signInHref}
                    onClick={(event) => { onSignIn?.(event); setOpen(false); }}
                    className="rounded-lg border border-border px-3 py-2 text-center text-xs font-medium"
                  >
                    Sign in
                  </a>
                  <a
                    href={signInHref}
                    onClick={(event) => { onSignIn?.(event); setOpen(false); }}
                    className="rounded-lg bg-accent px-3 py-2 text-center text-xs font-semibold text-accent-foreground"
                  >
                    Start free
                  </a>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {signOutError && <p role="alert" className="fixed inset-x-3 top-28 z-[80] mx-auto max-w-md rounded-md border border-destructive bg-background p-3 text-sm text-destructive">{signOutError}</p>}
    </header>
  );
}
