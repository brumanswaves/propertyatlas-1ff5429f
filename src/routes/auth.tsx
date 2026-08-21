import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
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

type AuthMode = "signin" | "signup" | "forgot" | "reset";

export const Route = createFileRoute("/auth")({
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

function initialMode(): AuthMode {
  if (typeof window === "undefined") return "signin";
  return new URLSearchParams(window.location.search).get("reset") === "1" ? "reset" : "signin";
}

function AuthPage() {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupEmailSent, setSignupEmailSent] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        if (error) throw error;

        if (!data.session) {
          setSignupEmailSent(true);
          toast.success("Account created. Check your email to verify your Easy Erf account.");
          return;
        }

        navigate({ to: "/" });
        return;
      }

      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?reset=1`,
        });
        if (error) throw error;
        setResetEmailSent(true);
        toast.success("Password reset email sent.");
        return;
      }

      if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Password changed. You can continue with Easy Erf.");
        navigate({ to: "/" });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth`;

    if (resolveGoogleAuthTransport() === "supabase") {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        toast.error(error.message || "Google sign-in failed");
        setLoading(false);
        return;
      }
      if (data.url) return;
      toast.error("Google sign-in did not start.");
      setLoading(false);
      return;
    }

    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectTo });
    if (result.error) {
      toast.error(result.error.message || "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  const title =
    mode === "signin"
      ? "Welcome back"
      : mode === "signup"
        ? "Create your account"
        : mode === "forgot"
          ? "Reset your password"
          : "Choose a new password";

  const subtitle =
    mode === "signin"
      ? "Sign in to continue your property investigation."
      : mode === "signup"
        ? "Create your Easy Erf account, then verify your email."
        : mode === "forgot"
          ? "Enter your email and we will send you a secure reset link."
          : "Enter a new password for your Easy Erf account.";

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-brand p-10 text-white md:flex">
        <Link to="/" className="inline-flex w-fit items-center rounded-2xl bg-white/95 px-5 py-3 shadow-lg">
          <AtlasPin variant="horizontal" className="h-11 w-auto max-w-[210px] object-contain" title={BRAND.site} />
        </Link>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            {BRAND.copy.shortPitch}
          </h2>
          <p className="mt-3 text-sm text-white/80">
            Investigate the property, organize the evidence, understand the risks, and decide what to do next.
          </p>
        </div>
        <div className="text-xs text-white/65">© Easy Erf · Pilot region: St Francis Bay</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-7 flex justify-center md:hidden">
            <Link to="/" className="inline-flex items-center rounded-2xl border border-border bg-white px-5 py-3 shadow-soft">
              <AtlasPin variant="horizontal" className="h-10 w-auto max-w-[190px] object-contain" title={BRAND.site} />
            </Link>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

          {mode === "signin" || mode === "signup" ? (
            <>
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
            </>
          ) : null}

          {signupEmailSent ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <div className="font-semibold">Check your email before signing in</div>
              <p className="mt-1 leading-6">
                We sent a verification link to <strong>{email}</strong>. Open that Easy Erf email and confirm your address, then return here and sign in.
              </p>
              <Button type="button" variant="outline" className="mt-3 rounded-full" onClick={() => { setSignupEmailSent(false); setMode("signin"); }}>
                Back to sign in
              </Button>
            </div>
          ) : resetEmailSent ? (
            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
              <div className="font-semibold">Check your email</div>
              <p className="mt-1 leading-6">
                We sent a password reset link to <strong>{email}</strong>. Open the Easy Erf email and follow the link to choose a new password.
              </p>
              <Button type="button" variant="outline" className="mt-3 rounded-full" onClick={() => { setResetEmailSent(false); setMode("signin"); }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              {mode === "signup" ? (
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" autoComplete="name" />
                </div>
              ) : null}

              {mode !== "reset" ? (
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" autoComplete="email" />
                </div>
              ) : null}

              {mode !== "forgot" ? (
                <div>
                  <Label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pr-11"
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ) : null}

              <Button type="submit" className="h-10 w-full rounded-full bg-gradient-brand" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Save new password"}
              </Button>
            </form>
          )}

          {!signupEmailSent && !resetEmailSent ? (
            <div className="mt-4 grid gap-2 text-center text-xs">
              {mode === "signin" ? (
                <button type="button" className="font-medium text-foreground/75 hover:text-foreground" onClick={() => setMode("forgot")}>
                  Forgot your password?
                </button>
              ) : null}
              {mode === "signin" ? (
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode("signup")}>
                  New here? Create an account
                </button>
              ) : mode === "signup" || mode === "forgot" ? (
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>
                  Back to sign in
                </button>
              ) : null}
            </div>
          ) : null}

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
    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.8 29 5 24 5 16.3 5 9.7 9.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43c5 0 9.5-1.7 13-4.6l-6-5.1c-1.9 1.4-4.4 2.2-7 2.2-5.3 0-9.7-3-11.4-7.4l-6.5 5C9.4 38.6 16.1 43 24 43z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.3 4.4-4.3 5.8l6 5.1C40.9 35.5 44 30.2 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
