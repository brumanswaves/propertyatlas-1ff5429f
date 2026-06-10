import { useEffect, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Building2,
  CalendarClock,
  ChevronRight,
  Crown,
  Lock,
  MapPin,
  Ruler,
  Share2,
  TrendingUp,
  Waves,
  X,
} from "lucide-react";
import { type Property, formatZAR } from "@/data/properties";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface Props {
  property: Property | null;
  onClose: () => void;
}

export function PropertyPanel({ property, onClose }: Props) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"overview" | "history" | "intelligence">("overview");

  useEffect(() => {
    if (!user || !property) return setSaved(false);
    supabase
      .from("saved_properties")
      .select("id")
      .eq("user_id", user.id)
      .eq("parcel_id", property.id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [user, property]);

  if (!property) return null;

  async function toggleSave() {
    if (!user) {
      toast.message("Sign in to save properties");
      return;
    }
    if (saved) {
      await supabase.from("saved_properties").delete().eq("user_id", user.id).eq("parcel_id", property!.id);
      setSaved(false);
      toast.success("Removed from saved");
    } else {
      const { error } = await supabase.from("saved_properties").insert({ user_id: user.id, parcel_id: property!.id });
      if (error) toast.error(error.message);
      else {
        setSaved(true);
        toast.success("Saved to your properties");
      }
    }
  }

  const ppm = Math.round(property.estimatedValue / property.sizeSqm);
  const lastSale = property.sales[0];
  const heldYears = new Date().getFullYear() - new Date(property.ownership.since).getFullYear();

  return (
    <aside className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex max-h-[88vh] flex-col rounded-t-3xl border border-border bg-card shadow-panel md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:max-h-none md:w-[420px] md:rounded-l-3xl md:rounded-tr-none md:border-l">
      {/* Drag handle on mobile */}
      <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-border md:hidden" />

      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-3 w-3" /> {property.area} · Erf {property.erf}
          </div>
          <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight">{property.street}</h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Pill icon={<Building2 className="h-3 w-3" />}>{property.type}</Pill>
            <Pill icon={<Ruler className="h-3 w-3" />}>{property.sizeSqm.toLocaleString()} m²</Pill>
            {property.features.beachfront && (
              <Pill icon={<Waves className="h-3 w-3" />} tone="accent">
                Beachfront
              </Pill>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleSave} className="rounded-full p-2 hover:bg-muted" title={saved ? "Saved" : "Save"}>
            {saved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
          </button>
          <button className="rounded-full p-2 hover:bg-muted" title="Share">
            <Share2 className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Valuation hero */}
      <div className="mx-5 rounded-2xl bg-gradient-brand p-4 text-white">
        <div className="text-[11px] font-medium uppercase tracking-wider text-white/70">Estimated value</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <div className="text-2xl font-semibold tracking-tight">{formatZAR(property.estimatedValue)}</div>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium">
            {Math.round(property.confidence * 100)}% confidence
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
          <Stat label="Municipal" value={formatZAR(property.municipalValue)} />
          <Stat label="R / m²" value={`R ${ppm.toLocaleString()}`} />
          <Stat label="Held" value={`${heldYears} yrs`} />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-border px-5 text-xs font-medium">
        {(["overview", "history", "intelligence"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "relative px-3 py-2 capitalize transition",
              tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-foreground" />}
          </button>
        ))}
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-8 pt-4">
        {tab === "overview" && (
          <div className="space-y-5">
            <Section title="Scores">
              <div className="grid grid-cols-2 gap-2">
                <ScoreBar label="Investor" value={property.scores.investor} icon={<TrendingUp className="h-3 w-3" />} />
                <ScoreBar label="Development" value={property.scores.development} />
                <ScoreBar label="Liquidity" value={property.scores.liquidity} />
                <ScoreBar label="Coastal" value={property.scores.coastal} />
                <ScoreBar label="Walkability" value={property.scores.walkability} />
              </div>
            </Section>
            <Section title="Last sale">
              <Row label="Date" value={new Date(lastSale.date).toLocaleDateString("en-ZA", { dateStyle: "medium" })} />
              <Row label="Price" value={formatZAR(lastSale.price)} />
              <Row label="Transfers" value={String(property.sales.length)} />
            </Section>
            <Section title="Features">
              <div className="flex flex-wrap gap-1.5">
                {property.features.beachfront && <Tag>Beachfront</Tag>}
                {property.features.oceanView && <Tag>Ocean view</Tag>}
                {property.features.walkingDistanceToBeach && <Tag>Walk to beach</Tag>}
                {property.features.cornerLot && <Tag>Corner lot</Tag>}
                {!Object.values(property.features).some(Boolean) && (
                  <span className="text-xs text-muted-foreground">No flagged features</span>
                )}
              </div>
            </Section>
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-4">
            <Locked>
              <Section title="Ownership">
                <Row label="Type" value={property.ownership.type} />
                <Row label="Owner" value={property.ownership.ownerLabel} />
                <Row label="Since" value={new Date(property.ownership.since).toLocaleDateString("en-ZA")} />
              </Section>
            </Locked>
            <Section title="Timeline">
              <ol className="space-y-3 border-l border-border pl-4">
                {property.timeline.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1 grid h-3 w-3 place-items-center rounded-full border-2 border-card bg-primary" />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      {new Date(e.date).toLocaleDateString("en-ZA", { dateStyle: "medium" })}
                    </div>
                    <div className="text-sm font-medium">{e.title}</div>
                  </li>
                ))}
              </ol>
            </Section>
          </div>
        )}

        {tab === "intelligence" && (
          <div className="space-y-4">
            <Locked>
              <Section title="Comparable sales (within 1km)">
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                      <div>
                        <div className="font-medium">{14 + i} Marina Dr</div>
                        <div className="text-xs text-muted-foreground">Sold {2024 - i} · 1,2{i}0 m²</div>
                      </div>
                      <div className="text-sm font-semibold">{formatZAR(3_400_000 + i * 250_000)}</div>
                    </div>
                  ))}
                </div>
              </Section>
            </Locked>
            <Locked>
              <Section title="Development feasibility">
                <Row label="Coverage allowance" value="60%" />
                <Row label="Bulk allowance" value="0.8" />
                <Row label="Height limit" value="2 storeys" />
                <Row label="Buildable area" value={`${Math.round(property.sizeSqm * 0.48).toLocaleString()} m²`} />
              </Section>
            </Locked>
          </div>
        )}
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/60">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="rounded-2xl border border-border bg-background/50 p-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ScoreBar({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-2.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium">{children}</span>;
}

function Pill({
  children,
  icon,
  tone = "default",
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "accent";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "accent" ? "bg-accent/15 text-accent-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function Locked({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border">
      <div className="pointer-events-none blur-[3px] saturate-50">{children}</div>
      <div className="absolute inset-0 grid place-items-center bg-card/70 backdrop-blur-sm">
        <Link
          to="/pricing"
          className="flex items-center gap-2 rounded-full bg-gradient-premium px-4 py-2 text-xs font-semibold text-accent-foreground shadow-soft hover:opacity-95"
        >
          <Crown className="h-3.5 w-3.5" />
          Upgrade to Investor to unlock
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          <Lock className="h-3 w-3" /> Premium
        </div>
      </div>
    </div>
  );
}
