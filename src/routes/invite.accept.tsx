import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { verifyInvestigatorInvite, setInvestigatorPassword } from "@/lib/auth/investigatorInvite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/invite/accept")({
  head: () => ({ meta: [
    { title: "Accept investigator invitation | Easy Erf" },
    { name: "robots", content: "noindex, nofollow" },
    { name: "referrer", content: "no-referrer" },
  ] }),
  component: InvestigatorInvitePage,
});

export function InvestigatorInvitePage() {
  const [identity, setIdentity] = useState<{ id: string; email?: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "complete" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        if (fragment.has("error") || new URLSearchParams(window.location.search).has("error")) {
          throw new Error("This invitation is invalid or expired. Contact your founder.");
        }
        // Wait for the existing Supabase client to consume its implicit invite session.
        // Never render, log or forward the token-bearing URL.
        const { error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error("This invitation could not be verified. Contact your founder.");
        const user = await verifyInvestigatorInvite(supabase);
        if (!cancelled) { setIdentity(user); setStatus("ready"); }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not verify invitation.");
          setStatus("error");
        }
      } finally {
        if (!cancelled) window.history.replaceState(window.history.state, "", "/invite/accept");
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!identity || status !== "ready") return;
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    setError(null);
    setStatus("saving");
    try {
      await setInvestigatorPassword(supabase, identity.id, password);
      setPassword(""); setConfirmation(""); setStatus("complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save password.");
      setStatus("error");
    }
  }

  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
    <Link to="/" className="text-lg font-semibold">Easy Erf</Link>
    <h1 className="mt-6 text-2xl font-semibold">Accept investigator invitation</h1>
    {status === "loading" ? <p role="status" className="mt-4">Checking your invitation...</p> : null}
    {error ? <p role="alert" className="mt-4 text-destructive">{error}</p> : null}
    {status === "ready" || status === "saving" ? <form onSubmit={submit} className="mt-5 space-y-4">
      <p className="break-words text-sm">Set a password for {identity?.email}. You can work only on investigations assigned to you. This does not grant Founder Operations access.</p>
      <div><Label htmlFor="invite-password">New password</Label><Input id="invite-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
      <div><Label htmlFor="invite-confirm">Confirm password</Label><Input id="invite-confirm" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
      <Button type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving..." : "Set password and activate account"}</Button>
    </form> : null}
    {status === "complete" ? <section className="mt-5 space-y-4">
      <p role="status">Your password is saved. Your investigator account is active. Your founder can now assign investigations to you.</p>
      <a href="/admin/fulfillment" className="inline-block underline">Open assigned investigations</a>
    </section> : null}
  </main>;
}
