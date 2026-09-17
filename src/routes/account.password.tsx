import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { saveAccountPassword, verifyPasswordAccount } from "@/lib/auth/accountAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/account/password")({
  head: () => ({ meta: [
    { title: "Set your password | Easy Erf" },
    { name: "robots", content: "noindex, nofollow" },
    { name: "referrer", content: "no-referrer" },
  ] }),
  component: AccountPasswordPage,
});

function AccountPasswordPage() {
  const { user, loading } = useAuth();
  const [identity, setIdentity] = useState<{ id: string; email?: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "complete" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const pending = useRef<{ id: string; controller: AbortController } | null>(null);
  const [invalidLink] = useState(() => typeof window !== "undefined" &&
    (new URLSearchParams(window.location.hash.slice(1)).has("error") ||
     new URLSearchParams(window.location.search).has("error")));

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const operation = pending.current;
      if (operation && (event === "SIGNED_OUT" || session?.user.id !== operation.id)) {
        operation.controller.abort(); pending.current = null;
      }
    });
    return () => { pending.current?.controller.abort(); pending.current = null; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    setIdentity(null); setPassword(""); setConfirmation(""); setStatus("loading"); setError(null);
    void (async () => {
      try {
        // Let the canonical SDK consume recovery credentials; never render or log them.
        await supabase.auth.getSession();
        window.history.replaceState(window.history.state, "", "/account/password");
        if (invalidLink) throw new Error("This reset link is invalid or expired. Request a new link.");
        const verified = await verifyPasswordAccount(supabase);
        if (!cancelled) { setIdentity(verified); setStatus("ready"); }
      } catch (caught) {
        if (!cancelled) { setError(caught instanceof Error ? caught.message : "Could not verify account."); setStatus("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [loading, user?.id, invalidLink]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!identity || identity.id !== user?.id || status !== "ready") return;
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    const operation = { id: identity.id, controller: new AbortController() };
    pending.current?.controller.abort(); pending.current = operation;
    const isCurrent = () => pending.current === operation && !operation.controller.signal.aborted;
    setStatus("saving"); setError(null);
    try {
      await saveAccountPassword(supabase, identity.id, password, operation.controller.signal);
      if (!isCurrent()) return;
      setPassword(""); setConfirmation(""); setStatus("complete");
    } catch (caught) {
      if (!isCurrent()) return;
      setError(caught instanceof Error ? caught.message : "Could not save password.");
      setStatus("ready");
    } finally {
      if (pending.current === operation) pending.current = null;
    }
  }

  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
    <Link to="/" className="text-lg font-semibold">Easy Erf</Link>
    <h1 className="mt-6 text-2xl font-semibold">Set or change your password</h1>
    {status === "loading" && <p role="status" className="mt-4">Checking your account...</p>}
    {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
    {identity && identity.id === user?.id && (status === "ready" || status === "saving") && <form onSubmit={submit} className="mt-5 space-y-4">
      <p className="break-words text-sm">Password for {identity.email}. Your existing properties and account access stay the same. Google sign-in remains available.</p>
      <div><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={event => setPassword(event.target.value)} /></div>
      <div><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></div>
      <Button type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving..." : "Save password"}</Button>
    </form>}
    {status === "complete" && <p role="status" className="mt-5">Password saved. You can now sign in with your email and password.</p>}
    <div className="mt-6 flex gap-4 text-sm underline"><Link to="/auth">Sign in / request reset link</Link><Link to="/profile">Back to Account</Link></div>
  </main>;
}
