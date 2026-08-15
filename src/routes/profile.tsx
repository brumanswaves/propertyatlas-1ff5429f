import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CreditCard,
  MapPin,
  Save,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth/useAuth";
import { getUserDisplayName } from "@/lib/auth/profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: `Account | ${BRAND.site}` },
      {
        name: "description",
        content: `Manage your ${BRAND.site} account details and investigation preferences.`,
      },
      { property: "og:url", content: "/profile" },
    ],
    links: [{ rel: "canonical", href: "/profile" }],
  }),
  component: AccountPage,
});

const PROFILE_TYPES = ["Buyer", "Seller", "Investor", "Agent", "Developer", "Researcher"];

function metadataText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readableDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function providerLabel(provider: unknown) {
  if (provider === "google") return "Google";
  if (typeof provider === "string" && provider.trim()) {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
  return "Easy Erf account";
}

function AccountPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileType, setProfileType] = useState("");
  const [defaultMarket, setDefaultMarket] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    const metadata = user.user_metadata ?? {};
    const fullName = metadataText(metadata.full_name) || metadataText(metadata.name);
    const [fallbackFirst = "", ...fallbackLast] = fullName.trim().split(/\s+/).filter(Boolean);
    setFirstName(metadataText(metadata.first_name) || fallbackFirst);
    setLastName(metadataText(metadata.last_name) || fallbackLast.join(" "));
    setDisplayName(metadataText(metadata.display_name) || getUserDisplayName(user));
    setPhone(metadataText(metadata.phone));
    setProfileType(metadataText(metadata.profile_type));
    setDefaultMarket(metadataText(metadata.default_market));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    void supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(Boolean(data));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const authProvider = useMemo(
    () => providerLabel(user?.app_metadata?.provider),
    [user?.app_metadata?.provider],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanDisplay = displayName.trim();
    const fullName = [cleanFirst, cleanLast].filter(Boolean).join(" ");

    const { error } = await supabase.auth.updateUser({
      data: {
        ...(user?.user_metadata ?? {}),
        first_name: cleanFirst,
        last_name: cleanLast,
        display_name: cleanDisplay || fullName,
        full_name: fullName || cleanDisplay,
        phone: phone.trim(),
        profile_type: profileType,
        default_market: defaultMarket.trim(),
      },
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account saved");
  }

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-28 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Settings2 className="h-3 w-3 text-accent" /> Account
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Your Easy Erf account</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Keep the account details that help Easy Erf identify you and make the product more useful. These fields are user preferences, not official property evidence.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-soft hover:bg-muted"
          >
            My Investigations
          </Link>
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Account details</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Your email comes from the signed-in identity provider. The editable fields below are stored as account metadata.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="First name" id="firstName">
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </Field>
              <Field label="Last name" id="lastName">
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </Field>
              <Field label="Display name" id="displayName">
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </Field>
              <Field label="Email" id="email">
                <Input id="email" value={user.email ?? ""} readOnly className="bg-muted/60" />
              </Field>
              <Field label="Phone (optional)" id="phone">
                <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </Field>

              <div className="sm:col-span-2 mt-2 border-t border-border pt-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> Investigation preferences
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  These preferences can help tailor product defaults later. They do not alter property evidence or planning conclusions.
                </p>
              </div>

              <Field label="How you mainly use Easy Erf (optional)" id="profileType">
                <select
                  id="profileType"
                  value={profileType}
                  onChange={(event) => setProfileType(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select one</option>
                  {PROFILE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Default market or area (optional)" id="defaultMarket">
                <Input
                  id="defaultMarket"
                  value={defaultMarket}
                  onChange={(event) => setDefaultMarket(event.target.value)}
                  placeholder="St Francis Bay"
                />
              </Field>

              <div className="flex items-center gap-2 sm:col-span-2 pt-2">
                <Button type="submit" disabled={saving} className="rounded-full">
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Save account"}
                </Button>
              </div>
            </form>
          </section>

          <div className="grid content-start gap-5">
            <AccountCard icon={<BadgeCheck className="h-4 w-4" />} title="Sign-in identity">
              <AccountLine label="Email" value={user.email ?? "Not available"} />
              <AccountLine label="Sign-in provider" value={authProvider} />
              <AccountLine label="Member since" value={readableDate(user.created_at)} />
              <AccountLine label="Last sign-in" value={readableDate(user.last_sign_in_at)} />
            </AccountCard>

            <AccountCard icon={<CreditCard className="h-4 w-4" />} title="Billing & access">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Easy Erf does not currently sell a recurring subscription. Third-party provider reports are not purchased through a live Easy Erf checkout today.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Site Potential beta access and generation allowances are shown in the property workflow where the real entitlement state is available. This account page does not invent a balance or payment history.
              </p>
              <Link
                to="/pricing"
                className="mt-4 inline-flex rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted"
              >
                See current pricing
              </Link>
            </AccountCard>

            {isAdmin && (
              <AccountCard icon={<ShieldCheck className="h-4 w-4" />} title="Founder Operations">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  This account has the Easy Erf admin role. Operational tools remain protected by the same server-backed role check used by the admin area.
                </p>
                <Link
                  to="/admin"
                  className="mt-4 inline-flex rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Open Founder Operations
                </Link>
              </AccountCard>
            )}
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">Account scope</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Security, billing, notifications and entitlements will only appear here when Easy Erf has a real connected control or source of truth for them. Technical backend settings remain outside the normal customer account experience.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <Toaster position="top-center" />
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function AccountCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-foreground">{icon}</span>
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function AccountLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 text-xs last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] break-words text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
