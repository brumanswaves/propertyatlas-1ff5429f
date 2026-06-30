import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save, UserRound } from "lucide-react";
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

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile - ErfStop" },
      { name: "description", content: "Manage your ErfStop profile details." },
      { property: "og:url", content: "/profile" },
    ],
    links: [{ rel: "canonical", href: "/profile" }],
  }),
  component: ProfilePage,
});

const PROFILE_TYPES = ["Buyer", "Seller", "Investor", "Agent", "Developer", "Researcher"];

function metadataText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileType, setProfileType] = useState("");
  const [defaultMarket, setDefaultMarket] = useState("");
  const [saving, setSaving] = useState(false);

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
    toast.success("Profile saved");
  }

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-28">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                This is your ErfStop user profile info. It is not official parcel data.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="First name" id="firstName">
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>
            <Field label="Last name" id="lastName">
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
            <Field label="Display name" id="displayName">
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>
            <Field label="Email" id="email">
              <Input id="email" value={user.email ?? ""} readOnly className="bg-muted/60" />
            </Field>
            <Field label="Phone (optional)" id="phone">
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Role/type (optional)" id="profileType">
              <select
                id="profileType"
                value={profileType}
                onChange={(e) => setProfileType(e.target.value)}
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
            <Field label="Default market/area (optional)" id="defaultMarket">
              <Input
                id="defaultMarket"
                value={defaultMarket}
                onChange={(e) => setDefaultMarket(e.target.value)}
                placeholder="St Francis Bay"
              />
            </Field>

            <div className="flex items-center gap-2 sm:col-span-2">
              <Button type="submit" disabled={saving} className="rounded-full">
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save profile"}
              </Button>
              <Link
                to="/dashboard"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Back to dashboard
              </Link>
            </div>
          </form>
        </div>
      </main>
      <Footer />
      <Toaster position="top-center" />
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
