import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStaffAccess } from "@/lib/auth/StaffAccess";
import { authCallbackUrl, safeReturnPath } from "@/lib/navigation";
import { AtlasPin } from "@/components/brand/AtlasPin";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { resolveGoogleAuthTransport } from "@/lib/auth/googleAuthTransport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { BRAND } from "@/lib/brand";
import { GOOGLE_ACCOUNT_CHOICE, requestPasswordRecovery } from "@/lib/auth/accountAccess";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; signout?: "unconfirmed" } => ({
    redirect: safeReturnPath(search.redirect) ?? undefined,
    signout: search.signout === "unconfirmed" ? "unconfirmed" : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Sign in - ${BRAND.site}` },
      { name: "description", content: `Sign in or create your ${BRAND.site} account.` },
      { property: "og:url", content: "/auth" },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect, signout } = Route.useSearch();
  const { user, role, checking, unavailable } = useStaffAccess();
  const [mode, setMode] = useState<"signin" | "signup" | "recovery">("signin");
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || checking || unavailable || !role) return;
    const destination = redirect ?? (role === "founder" ? "/admin" : role === "investigator" ? "/investigator" : "/");
    // A validated same-origin path preserves explicit property/order links.
    window.location.replace(destination);
  }, [user, role, checking, unavailable, redirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      if (mode === "recovery") {
        await requestPasswordRecovery(supabase, email, window.location.origin);
        setNotice("If an account can receive a reset link, it will arrive by email. Check your inbox and spam folder.");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: authCallbackUrl(window.location.origin, redirect),
          },
        });
        if (error) throw error;
        setNotice("Check your email to confirm your account. Already used Google? Sign in with Google, then set a password in Account.");
        // Staff role resolution chooses the default landing after sign-in.
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Preserve the requested destination through the shared auth state.
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const redirectTo = authCallbackUrl(window.location.origin, redirect);

      if (resolveGoogleAuthTransport() === "supabase") {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, queryParams: GOOGLE_ACCOUNT_CHOICE },
        });
        if (error || !data.url) throw new Error("Google sign-in did not start.");
        return;
      }

      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectTo, extraParams: GOOGLE_ACCOUNT_CHOICE });
      if (result.error) throw result.error;
      if (!result.redirected) navigate({ to: "/auth", search: { redirect } });
    } catch {
      toast.error("Google sign-in could not start. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-brand p-10 text-white md:flex">
        <Link
          to="/"
          aria-label="Easy Erf home"
          className="inline-flex h-10 w-[156px] items-center justify-center rounded-full border border-white/20 bg-[#FCFAF6] px-4 shadow-panel ring-1 ring-black/5"
        >
          <AtlasPin
            variant="horizontal"
            className="block h-[26px] w-auto max-w-[132px] object-contain"
            title={BRAND.site}
          />
        </Link>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            {BRAND.copy.shortPitch}
          </h2>
          <p className="mt-3 text-sm text-white/75">
            Click an erf, organize public-source evidence, run your assumptions, and decide what to verify next.
          </p>
        </div>
        <div className="text-xs text-white/60">© Easy Erf · Pilot region: St Francis Bay</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            aria-label="Easy Erf home"
            className="mb-8 inline-flex h-10 w-[148px] items-center justify-center rounded-full border border-border/70 bg-[#FCFAF6] px-4 shadow-soft ring-1 ring-primary/5 md:hidden"
          >
            <AtlasPin
              variant="horizontal"
              className="block h-[24px] w-auto max-w-[124px] object-contain"
              title={BRAND.site}
            />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "recovery" ? "Reset your password" : mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "recovery" ? "Enter your Easy Erf account email." : mode === "signin" ? "Sign in to continue exploring." : "Free forever. Upgrade anytime."}
          </p>
          {user && unavailable && <p role="alert" className="mt-3 text-sm text-destructive">Your current access could not be verified. Sign in again to continue.</p>}
          {signout === "unconfirmed" && <p role="alert" className="mt-3 text-sm text-destructive">This browser session was cleared, but server sign-out could not be confirmed. Other devices have not been signed out.</p>}

          <Button
            type="button"
            variant="outline"
            className="mt-6 h-10 w-full rounded-full"
            onClick={handleGoogle}
            disabled={loading}
          >
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
            </div>
            {mode !== "recovery" && <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1" />
            </div>}
            <Button type="submit" className="h-10 w-full rounded-full bg-gradient-brand" disabled={loading}>
              {loading ? "Please wait…" : mode === "recovery" ? "Send reset link" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
          {mode === "signin" && <button type="button" className="mt-4 text-sm underline" onClick={() => { setMode("recovery"); setNotice(null); setPassword(""); }}>Forgot password?</button>}

          <button
            type="button"
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setNotice(null); setPassword(""); }}
          >
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>

          <div className="mt-6 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/disclaimer" className="hover:text-foreground">Disclaimer</Link>
            <Link to="/data-sources" className="hover:text-foreground">Data Sources</Link>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
          </div>

          <Toaster position="top-center" />
        </div>
      </div>

    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.8 29 5 24 5 16.3 5 9.7 9.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43c5 0 9.5-1.7 13-4.6l-6-5.1c-1.9 1.4-4.4 2.2-7 2.2-5.3 0-9.7-3-11.4-7.4l-6.5 5C9.4 38.6 16.1 43 24 43z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.3 4.4-4.3 5.8l6 5.1C40.9 35.5 44 30.2 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
