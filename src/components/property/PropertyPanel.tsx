import { useEffect, useMemo, useState } from "react";
import {
  Bookmark, BookmarkCheck, Building2, CalendarClock, Camera, ChevronRight, Crown,
  GitCompare, Lock, MapPin, Ruler, Share2, TrendingUp, Waves, X, Eye, Activity, Home, Banknote,
  Download, Filter, BadgeCheck,
} from "lucide-react";
import { type Property, type HistoryKind, formatZAR } from "@/data/properties";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface Props {
  property: Property | null;
  onClose: () => void;
}

type Tab = "overview" | "ownership" | "sales" | "intelligence" | "photos" | "timeline";

export function PropertyPanel({ property, onClose }: Props) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!user || !property) return setSaved(false);
    supabase.from("saved_properties").select("id").eq("user_id", user.id).eq("parcel_id", property.id)
      .maybeSingle().then(({ data }) => setSaved(!!data));
  }, [user, property]);

  useEffect(() => { setTab("overview"); }, [property?.id]);

  if (!property) return null;

  async function toggleSave() {
    if (!user) { toast.message("Sign in to save properties"); return; }
    if (saved) {
      await supabase.from("saved_properties").delete().eq("user_id", user.id).eq("parcel_id", property!.id);
      setSaved(false); toast.success("Removed from saved");
    } else {
      const { error } = await supabase.from("saved_properties").insert({ user_id: user.id, parcel_id: property!.id });
      if (error) toast.error(error.message);
      else { setSaved(true); toast.success("Saved to your properties"); }
    }
  }

  const ppm = Math.round(property.estimatedValue / property.sizeSqm);
  const lastSale = property.sales[0];
  const heldYears = new Date().getFullYear() - new Date(property.ownership.since).getFullYear();

  return (
    <aside className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex max-h-[88vh] flex-col rounded-t-3xl border border-border bg-card shadow-panel md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:max-h-none md:w-[420px] md:rounded-l-3xl md:rounded-tr-none md:border-l">
      <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-border md:hidden" />

      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-3 w-3" /> {property.area} · Erf {property.erf}
          </div>
          <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight">{property.street}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Pill icon={<Building2 className="h-3 w-3" />}>{property.type}</Pill>
            <Pill icon={<Ruler className="h-3 w-3" />}>{property.sizeSqm.toLocaleString()} m²</Pill>
            {property.features.beachfront && <Pill icon={<Waves className="h-3 w-3" />} tone="accent">Beachfront</Pill>}
            <Pill>{property.status}</Pill>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleSave} className="rounded-full p-2 hover:bg-muted" title={saved ? "Saved" : "Save"}>
            {saved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
          </button>
          <button className="rounded-full p-2 hover:bg-muted" title="Compare"><GitCompare className="h-4 w-4" /></button>
          <button className="rounded-full p-2 hover:bg-muted" title="Share"><Share2 className="h-4 w-4" /></button>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="mx-5 overflow-hidden rounded-2xl bg-gradient-brand p-4 text-white shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-white/80">Estimated value</div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">
            <BadgeCheck className="h-3 w-3" />
            {Math.round(property.confidence * 100)}% confidence
          </span>
        </div>
        <div className="mt-1 text-3xl font-semibold leading-none tracking-tight tabular-nums">
          {formatZAR(property.estimatedValue)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <Stat label="Municipal" value={formatZAR(property.municipalValue)} />
          <Stat label="Price / m²" value={`R ${ppm.toLocaleString()}`} />
          <Stat label="Last sale" value={formatZAR(lastSale.price)} />
          <Stat label="Held" value={`${heldYears} yrs`} />
        </div>
      </div>

      <div className="scrollbar-thin mt-3 flex gap-1 overflow-x-auto border-b border-border px-5 text-xs font-medium">
        {(["overview", "ownership", "sales", "intelligence", "photos", "timeline"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "relative whitespace-nowrap px-3 py-2 capitalize transition",
              tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}>
            {t}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-foreground" />}
          </button>
        ))}
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-8 pt-4">
        {tab === "overview" && (
          <div className="space-y-4">
            <Section title="Characteristics">
              <Row label="Type" value={property.type} />
              <Row label="Zoning" value={property.zoning} />
              <Row label="Erf size" value={`${property.sizeSqm.toLocaleString()} m²`} />
              <Row label="Status" value={property.status} />
            </Section>
            <Section title="Valuation">
              <Row label="Market estimate" value={formatZAR(property.estimatedValue)} />
              <Row label="Municipal value" value={formatZAR(property.municipalValue)} />
              <Row label="Confidence" value={`${Math.round(property.confidence * 100)}%`} />
            </Section>
            <Section title="Features">
              <div className="flex flex-wrap gap-1.5">
                {property.features.beachfront && <Tag>Beachfront</Tag>}
                {property.features.oceanView && <Tag>Ocean view</Tag>}
                {property.features.walkingDistanceToBeach && <Tag>Walk to beach</Tag>}
                {property.features.cornerLot && <Tag>Corner lot</Tag>}
                {property.features.largeErf && <Tag>Large erf</Tag>}
                {property.features.vacantLand && <Tag>Vacant land</Tag>}
              </div>
            </Section>
            <Section title="Nearby amenities">
              <Row label="Beach" value="450 m" />
              <Row label="St Francis Links" value="2.1 km" />
              <Row label="Village centre" value="900 m" />
            </Section>
          </div>
        )}

        {tab === "ownership" && (
          <div className="space-y-4">
            <Section title="Current owner">
              <Row label="Type" value={property.ownership.type} />
              <Row label="Held since" value={new Date(property.ownership.since).toLocaleDateString("en-ZA")} />
              <Row label="Duration" value={`${heldYears} years`} />
            </Section>
            <Locked>
              <Section title="Owner intelligence">
                <Row label="Registered owner" value={property.ownership.ownerLabel} />
                <Row label="Other holdings" value="3 properties in region" />
                <Row label="Previous owner" value="The Bekker Family Trust" />
                <Row label="Transfer history" value="4 transfers since 1998" />
              </Section>
            </Locked>
          </div>
        )}

        {tab === "sales" && (
          <div className="space-y-4">
            <Section title="Last transfer">
              <Row label="Date" value={new Date(lastSale.date).toLocaleDateString("en-ZA", { dateStyle: "medium" })} />
              <Row label="Price" value={formatZAR(lastSale.price)} />
              <Row label="vs estimate" value={`${Math.round((lastSale.price / property.estimatedValue) * 100)}%`} />
            </Section>

            <Section title="Property history · last 10 years">
              <ol className="space-y-2">
                {property.history.map((h, i) => {
                  const tone =
                    h.kind === "sold" ? "bg-primary/10 text-primary"
                    : h.kind === "rented" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : h.kind === "listed" ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                    : h.kind === "withdrawn" ? "bg-muted text-muted-foreground"
                    : h.kind === "valuation" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "bg-muted text-muted-foreground";
                  return (
                    <li key={i} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2 text-sm">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", tone)}>
                            {h.kind}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(h.date).toLocaleDateString("en-ZA", { year: "numeric", month: "short" })}
                          </span>
                        </div>
                        {(h.party || h.note) && (
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {h.party}{h.party && h.note ? " · " : ""}{h.note}
                          </div>
                        )}
                      </div>
                      {typeof h.price === "number" && (
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold tabular-nums">{formatZAR(h.price)}</div>
                          {h.kind === "rented" && <div className="text-[10px] text-muted-foreground">/ month</div>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </Section>

            <Locked>
              <Section title="Comparable sales (within 1 km)">
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
              <Section title="Sale price trend">
                <Row label="3-yr CAGR" value="+7.8%" />
                <Row label="Suburb median" value={formatZAR(4_250_000)} />
                <Row label="Days on market" value="62 (median)" />
              </Section>
            </Locked>
          </div>
        )}

        {tab === "intelligence" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Gauge label="Investor" value={property.scores.investor} icon={<TrendingUp className="h-3 w-3" />}
                explain="Composite of liquidity, appreciation, and yield" />
              <Gauge label="Development" value={property.scores.development} icon={<Building2 className="h-3 w-3" />}
                explain="Zoning, bulk, and lot geometry potential" />
              <Gauge label="Ocean view" value={property.scores.oceanView} icon={<Eye className="h-3 w-3" />}
                explain="Line-of-sight to ocean from buildable area" />
              <Gauge label="Walkability" value={property.scores.walkability} icon={<Activity className="h-3 w-3" />}
                explain="Beach, retail, and amenity proximity" />
              <Gauge label="Appreciation" value={property.scores.appreciation} icon={<TrendingUp className="h-3 w-3" />}
                explain="Modelled 5-yr capital growth" />
              <Gauge label="Rental yield" value={property.scores.rental} icon={<Home className="h-3 w-3" />}
                explain="Short-let demand & seasonality" />
              <Gauge label="Liquidity" value={property.scores.liquidity} icon={<Banknote className="h-3 w-3" />}
                explain="Days-to-sell at fair value" />
              <Gauge label="Coastal" value={property.scores.coastal} icon={<Waves className="h-3 w-3" />}
                explain="Beachfront and coastline desirability" />
            </div>
            <Locked>
              <Section title="Development feasibility">
                <Row label="Coverage allowance" value="60%" />
                <Row label="Bulk allowance" value="0.8" />
                <Row label="Height limit" value="2 storeys" />
                <Row label="Buildable area" value={`${Math.round(property.sizeSqm * 0.48).toLocaleString()} m²`} />
                <Row label="Indicative GDV" value={formatZAR(property.estimatedValue * 2.4)} />
              </Section>
            </Locked>
          </div>
        )}

        {tab === "photos" && (
          <div className="space-y-4">
            <Section title="Gallery">
              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-sky-200 via-amber-100 to-emerald-200">
                    <div className="grid h-full place-items-center text-[10px] font-medium text-muted-foreground">
                      <Camera className="h-4 w-4" />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
            <Locked>
              <Section title="Historical imagery">
                <Row label="2014 aerial" value="Available" />
                <Row label="2018 aerial" value="Available" />
                <Row label="2023 aerial" value="Available" />
                <Row label="Street view" value="Available" />
              </Section>
            </Locked>
          </div>
        )}

        {tab === "timeline" && (
          <div className="space-y-4">
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
            <Locked>
              <Section title="Historical aerial imagery">
                <Row label="Earliest record" value="2009" />
                <Row label="Imagery snapshots" value="12 available" />
                <Row label="Renovation detected" value="2017, 2021" />
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
    <div className="min-w-0 rounded-xl bg-white/15 px-3 py-2.5 ring-1 ring-inset ring-white/10">
      <div className="text-[10px] font-medium uppercase tracking-wider text-white/75">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold leading-tight tabular-nums break-words text-white">{value}</div>
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

function Gauge({ label, value, icon, explain }: { label: string; value: number; icon: React.ReactNode; explain: string }) {
  const angle = (value / 100) * 180;
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">{icon}{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <svg viewBox="0 0 100 56" className="mt-1 h-12 w-full">
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="var(--color-muted)" strokeWidth="6" strokeLinecap="round" />
        <path
          d="M10 50 A40 40 0 0 1 90 50"
          fill="none"
          stroke="url(#g)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(angle / 180) * 125.6} 200`}
        />
        <defs>
          <linearGradient id="g" x1="0" x2="1">
            <stop offset="0%" stopColor="oklch(0.52 0.18 256)" />
            <stop offset="100%" stopColor="oklch(0.78 0.17 70)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{explain}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium">{children}</span>;
}

function Pill({ children, icon, tone = "default" }: { children: React.ReactNode; icon?: React.ReactNode; tone?: "default" | "accent" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
      tone === "accent" ? "bg-accent/15 text-accent-foreground" : "bg-muted text-muted-foreground",
    )}>
      {icon}{children}
    </span>
  );
}

function Locked({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border">
      <div className="pointer-events-none blur-[3px] saturate-50">{children}</div>
      <div className="absolute inset-0 grid place-items-center bg-card/70 backdrop-blur-sm">
        <Link to="/pricing"
          className="flex items-center gap-2 rounded-full bg-gradient-premium px-4 py-2 text-xs font-semibold text-accent-foreground shadow-soft hover:opacity-95">
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
