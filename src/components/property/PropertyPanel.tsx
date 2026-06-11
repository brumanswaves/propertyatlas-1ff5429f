import { useEffect, useMemo, useState } from "react";
import {
  Bookmark, BookmarkCheck, Building2, CalendarClock, Camera, ChevronRight, Crown,
  GitCompare, Lock, MapPin, Ruler, Share2, TrendingUp, Waves, X, Eye, Activity, Home, Banknote,
  Download, Filter, BadgeCheck, Sparkles, Users, LineChart, Layers, Image as ImageIcon, Scale,
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
      <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-border md:hidden" />

      <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-4">
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

      <div className="mx-5 shrink-0 overflow-hidden rounded-2xl bg-gradient-brand p-3 text-white shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium uppercase tracking-wider text-white/80">Estimated value</div>
            <div className="mt-0.5 truncate text-xl font-semibold leading-none tracking-tight tabular-nums sm:text-3xl">
              {formatZAR(property.estimatedValue)}
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
            <BadgeCheck className="h-3 w-3" />
            {Math.round(property.confidence * 100)}%
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-[11px] sm:grid-cols-2 sm:gap-2">
          <Stat label="Municipal" value={compactZAR(property.municipalValue)} />
          <Stat label="R / m²" value={`R ${ppm.toLocaleString()}`} />
          <Stat label="Last sale" value={compactZAR(lastSale.price)} />
          <Stat label="Held" value={`${heldYears}y`} />
        </div>
      </div>

      {/* Investor Insight — premium AI-style summary */}
      <div className="mx-5 mt-3 shrink-0 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-3 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" /> Investor Insight
          </div>
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
            AI · Mock
          </span>
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-foreground/90">
          {buildInsight(property)}
        </p>
      </div>

      <div className="mt-3 grid shrink-0 grid-cols-6 gap-0.5 border-b border-border px-2 text-[10px] font-medium sm:flex sm:gap-1 sm:px-5 sm:text-xs">
        {(["overview", "ownership", "sales", "intelligence", "photos", "timeline"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "relative truncate px-1 py-2 capitalize transition sm:px-3",
              tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}>
            {t}
            {tab === t && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded bg-foreground sm:inset-x-2" />}
          </button>
        ))}
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-8 pt-4">
        {tab === "overview" && (
          <div className="space-y-4">
            {/* Key investor scores */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Investor scorecards</div>
                <span className="text-[10px] text-muted-foreground">Out of 100</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ScoreCard
                  label="Investor"
                  value={property.scores.investor}
                  icon={<TrendingUp className="h-3 w-3" />}
                  explain="Composite of liquidity, appreciation, and yield."
                  confidence={property.confidence}
                />
                <ScoreCard
                  label="Development"
                  value={property.scores.development}
                  icon={<Building2 className="h-3 w-3" />}
                  explain="Zoning, bulk, and lot geometry potential."
                  confidence={Math.min(0.95, property.confidence + 0.05)}
                />
                <ScoreCard
                  label="Ocean view"
                  value={property.scores.oceanView}
                  icon={<Eye className="h-3 w-3" />}
                  explain="Line-of-sight to ocean from buildable area."
                  confidence={0.88}
                />
                <ScoreCard
                  label="Liquidity"
                  value={property.scores.liquidity}
                  icon={<Banknote className="h-3 w-3" />}
                  explain="Modelled days-to-sell at fair value."
                  confidence={Math.max(0.6, property.confidence - 0.1)}
                />
                <ScoreCard
                  label="Appreciation"
                  value={property.scores.appreciation}
                  icon={<LineChart className="h-3 w-3" />}
                  explain="Modelled 5-year capital growth potential."
                  confidence={Math.max(0.55, property.confidence - 0.15)}
                  className="col-span-2"
                />
              </div>
            </div>

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

            {/* Premium Investor modules — blurred previews + single CTA */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Investor modules</div>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Lock className="h-2.5 w-2.5" /> Premium
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <LockedModule icon={<Users className="h-3 w-3" />} title="Ownership Intelligence" lines={[property.ownership.ownerLabel, "3 properties in region", "4 transfers since 1998"]} />
                <LockedModule icon={<GitCompare className="h-3 w-3" />} title="Comparable Sales" lines={["14 Marina Dr · R 3.65M", "22 Lyme Rd · R 4.10M", "8 Da Gama Rd · R 3.92M"]} />
                <LockedModule icon={<CalendarClock className="h-3 w-3" />} title="Transfer Timeline" lines={["2019 · R 2.4M", "2013 · R 1.5M", "2006 · R 780k"]} />
                <LockedModule icon={<Scale className="h-3 w-3" />} title="Municipal vs Market" lines={[`Muni ${compactZAR(property.municipalValue)}`, `Market ${compactZAR(property.estimatedValue)}`, `+${Math.round((property.estimatedValue / property.municipalValue - 1) * 100)}% premium`]} />
                <LockedModule icon={<Layers className="h-3 w-3" />} title="Development Feasibility" lines={["Coverage 60% · Bulk 0.8", `Buildable ${Math.round(property.sizeSqm * 0.48).toLocaleString()} m²`, `Indicative GDV ${compactZAR(property.estimatedValue * 2.4)}`]} />
                <LockedModule icon={<ImageIcon className="h-3 w-3" />} title="Historical Imagery" lines={["2014 aerial", "2018 aerial", "2023 aerial · street view"]} />
              </div>
              <Link
                to="/pricing"
                className="mt-3 flex items-center justify-center gap-2 rounded-full bg-gradient-premium px-4 py-2.5 text-xs font-semibold text-accent-foreground shadow-soft transition hover:opacity-95"
              >
                <Crown className="h-3.5 w-3.5" />
                Unlock full property intelligence · R199/month
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                Cancel anytime. Mock pilot data for demonstration.
              </p>
            </div>
          </div>
        )}

        {tab === "ownership" && (
          <div className="space-y-4">
            <Section title="Current owner">
              <Row label="Type" value={property.ownership.type} />
              <Row label="Held since" value={new Date(property.ownership.since).toLocaleDateString("en-ZA")} />
              <Row label="Duration" value={`${heldYears} years`} />
            </Section>
            <Locked preview={["Ownership timeline","Comparable sales","Previous transfer prices","Development notes","Historical imagery"]}>
              <Section title="Owner intelligence">
                <Row label="Registered owner" value={property.ownership.ownerLabel} />
                <Row label="Other holdings" value="3 properties in region" />
                <Row label="Previous owner" value="The Bekker Family Trust" />
                <Row label="Transfer history" value="4 transfers since 1998" />
              </Section>
            </Locked>
          </div>
        )}

        {tab === "sales" && <SalesTab property={property} />}


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
            <Locked preview={["Ownership timeline","Comparable sales","Previous transfer prices","Development notes","Historical imagery"]}>
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
            <Locked preview={["Ownership timeline","Comparable sales","Previous transfer prices","Development notes","Historical imagery"]}>
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
            <Locked preview={["Ownership timeline","Comparable sales","Previous transfer prices","Development notes","Historical imagery"]}>
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
    <div className="min-w-0 rounded-lg bg-white/15 px-2 py-1.5 ring-1 ring-inset ring-white/10 sm:rounded-xl sm:px-3 sm:py-2.5">
      <div className="text-[9px] font-medium uppercase tracking-wide text-white/75 sm:text-[10px]">{label}</div>
      <div className="mt-0.5 text-[11px] font-semibold leading-tight tabular-nums break-words text-white sm:text-[13px]">{value}</div>
    </div>
  );
}

function compactZAR(n: number): string {
  if (n >= 1_000_000) return `R ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, "")}M`;
  if (n >= 1_000) return `R ${Math.round(n / 1_000)}k`;
  return `R ${n}`;
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

function ScoreCard({
  label, value, icon, explain, confidence, className,
}: { label: string; value: number; icon: React.ReactNode; explain: string; confidence: number; className?: string }) {
  const tone =
    value >= 80 ? "text-emerald-600 dark:text-emerald-400"
    : value >= 60 ? "text-primary"
    : value >= 40 ? "text-amber-600 dark:text-amber-400"
    : "text-muted-foreground";
  const conf = Math.round(confidence * 100);
  const confLabel = conf >= 85 ? "High" : conf >= 70 ? "Medium" : "Low";
  return (
    <div className={cn("rounded-xl border border-border bg-background/60 p-2.5", className)}>
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1">{icon}{label}</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
          {confLabel} · {conf}%
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("text-2xl font-semibold tabular-nums leading-none", tone)}>{value}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          style={{ width: `${Math.min(100, Math.max(2, value))}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">{explain}</p>
    </div>
  );
}

function LockedModule({
  icon, title, lines,
}: { icon: React.ReactNode; title: string; lines: string[] }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-background/60 p-2.5">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1">{icon}{title}</span>
        <Lock className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="mt-1.5 space-y-0.5 select-none blur-[3.5px] saturate-75">
        {lines.map((l, i) => (
          <div key={i} className="truncate text-[11px] font-medium text-foreground/80">{l}</div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
    </div>
  );
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

function Locked({ children, preview }: { children: React.ReactNode; preview?: string[] }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border">
      <div className="pointer-events-none blur-[3px] saturate-50">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/80 p-4 backdrop-blur-sm">
        {preview && preview.length > 0 && (
          <ul className="mb-1 flex flex-wrap justify-center gap-1.5">
            {preview.map((p) => (
              <li key={p} className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
                {p}
              </li>
            ))}
          </ul>
        )}
        <Link to="/pricing"
          className="flex items-center gap-2 rounded-full bg-gradient-premium px-4 py-2 text-xs font-semibold text-accent-foreground shadow-soft hover:opacity-95">
          <Crown className="h-3.5 w-3.5" />
          Unlock with Investor · R199/mo
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          <Lock className="h-3 w-3" /> Premium
        </div>
      </div>
    </div>
  );
}

function buildInsight(p: Property): string {
  const last = p.sales[0];
  const yearsSinceSale = new Date().getFullYear() - new Date(last.date).getFullYear();
  const vsEst = Math.round((last.price / p.estimatedValue) * 100);
  const valuation =
    vsEst < 80 ? "appears under-priced versus the current estimate"
    : vsEst > 115 ? "last traded above the current estimate"
    : "appears fairly valued relative to nearby mock sales";
  const dev =
    p.scores.development >= 75 ? "strong development potential due to erf size and zoning"
    : p.scores.development >= 55 ? "moderate development upside"
    : "limited development upside";
  const coast = p.features.beachfront
    ? "Beachfront premium drives long-term appreciation."
    : p.features.oceanView ? "Ocean-view positioning supports rental demand."
    : p.features.walkingDistanceToBeach ? "Walking distance to the beach supports liquidity."
    : "";
  return `Last traded ${yearsSinceSale}y ago — ${valuation}, with ${dev}. ${coast}`.trim();
}

// ===== Sales tab with Last sold card, filters, and PDF export =====

type HistoryFilter = "all" | "sales" | "rentals" | HistoryKind;

const KIND_TONE: Record<HistoryKind, string> = {
  sold: "bg-primary/10 text-primary border-primary/20",
  listed: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
  rented: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  withdrawn: "bg-muted text-muted-foreground border-border",
  valuation: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  renovation: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
};

function SalesTab({ property }: { property: Property }) {
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const lastSoldRec = useMemo(
    () => property.history.find((h) => h.kind === "sold"),
    [property.history],
  );
  const lastSoldDate = lastSoldRec?.date ?? property.sales[0].date;
  const lastSoldPrice = lastSoldRec?.price ?? property.sales[0].price;
  const lastSoldAgent = lastSoldRec?.party ?? "—";
  const vsEst = Math.round((lastSoldPrice / property.estimatedValue) * 100);

  const filtered = useMemo(() => {
    return property.history.filter((h) => {
      if (filter === "all") return true;
      if (filter === "sales") return h.kind === "sold" || h.kind === "listed" || h.kind === "withdrawn";
      if (filter === "rentals") return h.kind === "rented";
      return h.kind === filter;
    });
  }, [property.history, filter]);

  function exportPDF() {
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) {
      toast.error("Pop-up blocked. Allow pop-ups to export PDF.");
      return;
    }
    const rows = property.history.map((h) => {
      const d = new Date(h.date).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
      const price = typeof h.price === "number"
        ? (h.kind === "rented" ? `${formatZAR(h.price)} / month` : formatZAR(h.price))
        : "—";
      const detail = [h.party, h.note].filter(Boolean).join(" · ") || "—";
      return `<tr>
        <td>${d}</td>
        <td><span class="badge badge-${h.kind}">${h.kind}</span></td>
        <td class="num">${price}</td>
        <td>${detail}</td>
      </tr>`;
    }).join("");

    win.document.write(`<!doctype html><html><head><meta charset="utf-8" />
      <title>PropertyAtlas · ${property.street} · 10-Year History</title>
      <style>
        *{box-sizing:border-box}
        body{font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#0f172a;margin:32px;}
        h1{font-size:20px;margin:0 0 4px}
        h2{font-size:13px;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}
        .sub{color:#64748b;margin-bottom:24px}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
        .card{border:1px solid #e2e8f0;border-radius:10px;padding:12px}
        .card .l{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}
        .card .v{font-size:15px;font-weight:600;margin-top:4px}
        .hero{background:linear-gradient(135deg,#1e3a8a,#0f172a);color:#fff;border-radius:12px;padding:20px;margin-bottom:24px}
        .hero .l{color:rgba(255,255,255,.7);font-size:11px;text-transform:uppercase;letter-spacing:.08em}
        .hero .v{font-size:26px;font-weight:700;margin-top:2px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
        th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;background:#f8fafc}
        .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
        .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
        .badge-sold{background:#dbeafe;color:#1d4ed8}
        .badge-listed{background:#e0f2fe;color:#0369a1}
        .badge-rented{background:#d1fae5;color:#047857}
        .badge-withdrawn{background:#f1f5f9;color:#475569}
        .badge-valuation{background:#fef3c7;color:#b45309}
        .badge-renovation{background:#ede9fe;color:#6d28d9}
        footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:10px;display:flex;justify-content:space-between}
      </style></head><body>
      <h1>${property.street} · Erf ${property.erf}</h1>
      <div class="sub">${property.area} · ${property.type} · ${property.sizeSqm.toLocaleString()} m²</div>

      <div class="hero">
        <div class="l">Last sold</div>
        <div class="v">${formatZAR(lastSoldPrice)}</div>
        <div style="margin-top:4px;font-size:12px;opacity:.85">
          ${new Date(lastSoldDate).toLocaleDateString("en-ZA",{dateStyle:"long"})} · ${lastSoldAgent} · ${vsEst}% of estimate
        </div>
      </div>

      <div class="grid">
        <div class="card"><div class="l">Estimated value</div><div class="v">${formatZAR(property.estimatedValue)}</div></div>
        <div class="card"><div class="l">Municipal</div><div class="v">${formatZAR(property.municipalValue)}</div></div>
        <div class="card"><div class="l">Price / m²</div><div class="v">R ${Math.round(property.estimatedValue/property.sizeSqm).toLocaleString()}</div></div>
        <div class="card"><div class="l">Owner since</div><div class="v">${new Date(property.ownership.since).getFullYear()}</div></div>
      </div>

      <h2>10-Year Property History</h2>
      <table>
        <thead><tr><th>Date</th><th>Event</th><th class="num">Amount</th><th>Detail</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <footer>
        <span>PropertyAtlas · Investor Report</span>
        <span>Generated ${new Date().toLocaleDateString("en-ZA",{dateStyle:"long"})}</span>
      </footer>
      <script>window.onload=()=>{setTimeout(()=>window.print(),300);}</script>
      </body></html>`);
    win.document.close();
  }

  const FILTERS: { id: HistoryFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "sales", label: "Sales" },
    { id: "rentals", label: "Rentals" },
    { id: "sold", label: "Sold" },
    { id: "listed", label: "Listed" },
    { id: "rented", label: "Rented" },
    { id: "withdrawn", label: "Withdrawn" },
  ];

  return (
    <div className="space-y-4">
      {/* Last sold summary card */}
      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">Last sold</div>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {vsEst}% of estimate
          </span>
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{formatZAR(lastSoldPrice)}</div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
          <SoldStat label="Date" value={new Date(lastSoldDate).toLocaleDateString("en-ZA", { dateStyle: "medium" })} />
          <SoldStat label="Agent" value={lastSoldAgent} />
          <SoldStat label="Owner type" value={property.ownership.type} />
        </div>
      </div>

      {/* Filters + export */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3 w-3" /> 10-year history
          </div>
          <button
            onClick={exportPDF}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background transition hover:opacity-90"
          >
            <Download className="h-3 w-3" /> Export PDF
          </button>
        </div>
        <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* History list */}
      <ol className="space-y-2">
        {filtered.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No records match this filter.
          </li>
        )}
        {filtered.map((h, i) => (
          <li key={i} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background/50 p-3 text-sm">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", KIND_TONE[h.kind])}>
                  {h.kind}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(h.date).toLocaleDateString("en-ZA", { year: "numeric", month: "short" })}
                </span>
              </div>
              {(h.party || h.note) && (
                <div className="mt-1 truncate text-xs text-muted-foreground">
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
        ))}
      </ol>

      <Locked preview={["Ownership timeline","Comparable sales","Previous transfer prices","Development notes","Historical imagery"]}>
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
      <Locked preview={["Ownership timeline","Comparable sales","Previous transfer prices","Development notes","Historical imagery"]}>
        <Section title="Sale price trend">
          <Row label="3-yr CAGR" value="+7.8%" />
          <Row label="Suburb median" value={formatZAR(4_250_000)} />
          <Row label="Days on market" value="62 (median)" />
        </Section>
      </Locked>
    </div>
  );
}

function SoldStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-card/60 px-2.5 py-1.5 ring-1 ring-inset ring-border">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-[12px] font-semibold leading-tight">{value}</div>
    </div>
  );
}
