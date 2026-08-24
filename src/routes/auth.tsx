import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
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

type AuthMode = "signin" | "signup" | "forgot" | "reset";

function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupNotice, setSignupNotice] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (params.get("mode") === "reset" || hashParams.get("type") === "recovery") {
      setMode("reset");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSignupNotice(null);
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
          setSignupNotice(
            `Check ${email} for an Easy Erf verification email. Open the verification link, then return here to sign in.`,
          );
          return;
        }

        toast.success("Account created. You are signed in.");
        navigate({ to: "/" });
        return;
      }

      if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Password changed. You can continue using Easy Erf.");
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

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResetNotice(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) throw error;
      setResetNotice(
        `Check ${email} for an Easy Erf password-reset link. Use that link to choose a new password.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const redirectTo = window.location.origin;

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
      ? "Sign in to continue your Easy Erf investigations."
      : mode === "signup"
        ? "Create your Easy Erf account. Email verification may be required before your first sign-in."
        : mode === "forgot"
          ? "Enter your email and we will send an Easy Erf password-reset link."
          : "Enter and save your new Easy Erf password.";

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-brand p-10 text-white md:flex">
        <Link
          to="/"
          className="inline-flex w-fit items-center rounded-2xl bg-white px-5 py-3 shadow-lg"
          aria-label="Easy Erf home"
        >
          <AtlasPin variant="horizontal" className="h-9 w-auto object-contain" title={BRAND.site} />
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
          <div className="mb-7 flex justify-center md:hidden">
            <div className="rounded-2xl border border-border bg-white px-5 py-3 shadow-sm">
              <AtlasPin variant="horizontal" className="h-9 w-auto object-contain" title={BRAND.site} />
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

          {(mode === "signin" || mode === "signup") && (
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
          )}

          {mode === "forgot" ? (
            <form onSubmit={handleForgotPassword} className="mt-6 space-y-3">
              <div>
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="mt-1"
                />
              </div>
              {resetNotice && (
                <div className="rounded-xl border border-border bg-muted/60 p-3 text-sm text-foreground">
                  <strong>Check your email.</strong> {resetNotice}
                </div>
              )}
              <Button type="submit" className="h-10 w-full rounded-full bg-gradient-brand" disabled={loading}>
                {loading ? "Please wait..." : "Send reset link"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className={mode === "reset" ? "mt-6 space-y-3" : "space-y-3"}>
              {mode === "signup" && (
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    className="mt-1"
                  />
                </div>
              )}
              {mode !== "reset" && (
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="mt-1"
                  />
                </div>
              )}
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
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {signupNotice && (
                <div className="rounded-xl border border-border bg-muted/60 p-3 text-sm text-foreground">
                  <strong>Check your email before signing in.</strong> {signupNotice}
                </div>
              )}

              <Button type="submit" className="h-10 w-full rounded-full bg-gradient-brand" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : "Save new password"}
              </Button>
            </form>
          )}

          {mode === "signin" && (
            <button
              type="button"
              className="mt-3 w-full text-center text-xs font-medium text-foreground/75 hover:text-foreground"
              onClick={() => {
                setMode("forgot");
                setResetNotice(null);
              }}
            >
              Forgot your password?
            </button>
          )}

          <button
            type="button"
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSignupNotice(null);
              setResetNotice(null);
              setPassword("");
              setMode(mode === "signin" ? "signup" : "signin");
            }}
          >
            {mode === "signin"
              ? "New here? Create an account"
              : mode === "signup"
                ? "Already have an account? Sign in"
                : "Back to sign in"}
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
