import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark, BookmarkCheck, Building2, CalendarClock, Camera, ChevronRight, Crown,
  GitCompare, Lock, MapPin, Ruler, Share2, TrendingUp, Waves, X, Eye, Activity, Home, Banknote,
  Download, Filter, BadgeCheck, Sparkles, Users, LineChart, Layers, Image as ImageIcon, Scale,
} from "lucide-react";
import { type Property, type HistoryKind, formatZAR, walkMinutes, driveMinutes, PROPERTIES } from "@/data/properties";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { SourceBadge } from "@/components/data/SourceBadge";

interface Props {
  property: Property | null;
  onClose: () => void;
}

type Tab = "overview" | "ownership" | "sales" | "intelligence" | "photos";

const TAB_META: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview",     label: "Overview",     icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "ownership",    label: "Ownership",    icon: <Users className="h-3.5 w-3.5" /> },
  { id: "sales",        label: "Sales",        icon: <Banknote className="h-3.5 w-3.5" /> },
  { id: "intelligence", label: "Intelligence", icon: <Activity className="h-3.5 w-3.5" /> },
  { id: "photos",       label: "Photos",       icon: <ImageIcon className="h-3.5 w-3.5" /> },
];

export function PropertyPanel({ property, onClose }: Props) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const tabsAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user || !property) return setSaved(false);
    supabase.from("saved_properties").select("id").eq("user_id", user.id).eq("parcel_id", property.id)
      .maybeSingle().then(({ data }) => setSaved(!!data));
  }, [user, property]);

  useEffect(() => { setTab("overview"); scrollRef.current?.scrollTo({ top: 0 }); }, [property?.id]);

  function selectTab(id: Tab) {
    setTab(id);
    requestAnimationFrame(() => { scrollRef.current?.scrollTo({ top: 0 }); });
  }

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

  const dragStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  function onGrabStart(e: React.TouchEvent | React.PointerEvent) {
    dragStartY.current = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragY(0);
  }
  function onGrabMove(e: React.TouchEvent | React.PointerEvent) {
    if (dragStartY.current == null) return;
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragY(Math.max(0, y - dragStartY.current));
  }
  function onGrabEnd() {
    if (dragStartY.current == null) return;
    if (dragY > 80) onClose();
    dragStartY.current = null;
    setDragY(0);
  }

  if (!property) return null;

  const ppm = Math.round(property.estimatedValue / property.sizeSqm);
  const lastSale = property.sales[0];
  const heldYears = new Date().getFullYear() - new Date(property.ownership.since).getFullYear();


  return (
    <aside
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex max-h-[88vh] flex-col rounded-t-3xl border border-border bg-card shadow-panel md:left-auto md:right-0 md:top-0 md:bottom-0 md:h-screen md:max-h-screen md:w-[440px] md:rounded-l-3xl md:rounded-tr-none md:border-l lg:w-[480px]"
      style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: "none" } : { transition: "transform 0.2s ease-out" }}
    >
      <div
        className="mx-auto mt-2 flex h-6 w-full shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing md:hidden"
        onTouchStart={onGrabStart}
        onTouchMove={onGrabMove}
        onTouchEnd={onGrabEnd}
        onPointerDown={onGrabStart}
        onPointerMove={onGrabMove}
        onPointerUp={onGrabEnd}
        onPointerCancel={onGrabEnd}
      >
        <div className="h-1.5 w-12 rounded-full bg-border" />
      </div>

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

      <div ref={scrollRef} className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8">
        <div className="mx-5 mt-1 overflow-hidden rounded-2xl bg-gradient-brand p-3 text-white shadow-soft">
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
          <div
            className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-white/85"
            title="This value is an automated estimate generated using available data, modelling assumptions, and analytical methods. It is provided for informational purposes only and does not constitute a certified valuation, appraisal, legal opinion, financial advice, investment advice, or professional recommendation. Users should obtain an independent valuation or professional advice before making decisions involving property purchases, sales, financing, development, taxation, or investment."
          >
            <span className="h-1 w-1 rounded-full bg-white/70" />
            Estimate Only • Not a Certified Valuation
          </div>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-950">
            Demo Data · Mock property information shown for demonstration
          </div>
        </div>

        <div ref={tabsAnchorRef} className="sticky top-0 z-10 mt-3 border-b border-border bg-card">
          <div className="scrollbar-none flex gap-0.5 overflow-x-auto px-2 sm:px-3">
            {TAB_META.map(({ id, label, icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => selectTab(id)}
                  aria-pressed={active}
                  className={cn(
                    "relative inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-2 py-2.5 text-[11px] font-medium transition sm:gap-1.5 sm:px-2.5 sm:text-xs",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {icon}
                  {label}
                  {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-foreground" />}
                </button>
              );
            })}
          </div>
        </div>


        <div className="px-5 pt-4">


        {tab === "overview" && (
          <div className="space-y-4">
            {/* Why This Property? — Bloomberg-style intelligence card */}
            <WhyCard property={property} />
            {/* Key investor scores */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Investor scorecards</div>
                <span className="text-[10px] text-muted-foreground">Out of 100</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SellerProbabilityCard value={property.scores.sellerProbability} heldYears={heldYears} />
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
                  label="Appreciation"
                  value={property.scores.appreciation}
                  icon={<LineChart className="h-3 w-3" />}
                  explain="Modelled 5-year capital growth potential."
                  confidence={Math.max(0.55, property.confidence - 0.15)}
                />
                <ScoreCard
                  label="Rental yield"
                  value={property.scores.rental}
                  icon={<Home className="h-3 w-3" />}
                  explain="Short-let demand & seasonality."
                  confidence={Math.max(0.6, property.confidence - 0.05)}
                />
                <ScoreCard
                  label="Liquidity"
                  value={property.scores.liquidity}
                  icon={<Banknote className="h-3 w-3" />}
                  explain="Modelled days-to-sell at fair value."
                  confidence={Math.max(0.6, property.confidence - 0.1)}
                />
                <ScoreCard
                  label="Walkability"
                  value={property.scores.walkability}
                  icon={<Activity className="h-3 w-3" />}
                  explain="Beach, retail, amenity proximity."
                  confidence={0.82}
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
            <Section title="St Francis local intelligence">
              <div className="mb-2.5 grid grid-cols-4 gap-1.5">
                <LocalBadge label="Beach"   value={`${walkMinutes(property.distances.beachM)}m`}    sub="walk" tone={property.distances.beachM < 1200 ? "accent" : "default"} />
                <LocalBadge label="Village" value={`${walkMinutes(property.distances.villageM)}m`}  sub="walk" />
                <LocalBadge label="Golf"    value={`${driveMinutes(property.distances.golfM)}m`}    sub="drive" />
                <LocalBadge label="Harbour" value={`${driveMinutes(property.distances.harbourM)}m`} sub="drive" />
              </div>
              <Row label="Beach" value={`${formatM(property.distances.beachM)} · ${walkMinutes(property.distances.beachM)} min walk`} />
              <Row label="St Francis Links (golf)" value={`${formatM(property.distances.golfM)} · ${driveMinutes(property.distances.golfM)} min drive`} />
              <Row label="Port St Francis (harbour)" value={`${formatM(property.distances.harbourM)} · ${driveMinutes(property.distances.harbourM)} min drive`} />
              <Row label="Village centre" value={`${formatM(property.distances.villageM)} · ${walkMinutes(property.distances.villageM)} min walk`} />
              <Row label="Restaurants" value={`${formatM(property.distances.restaurantsM)} · ${walkMinutes(property.distances.restaurantsM)} min walk`} />
              <Row label="Lifestyle score" value={`${property.scores.lifestyle} / 100`} />
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

        {tab === "ownership" && <OwnershipTab property={property} />}

        {tab === "sales" && <SalesTab property={property} />}


        {tab === "intelligence" && <IntelligenceTab property={property} />}


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

        <SourceBadge source="demo" lastUpdated={new Date().toISOString()} />
        </div>
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

function LocalBadge({ label, value, sub, tone = "default" }: { label: string; value: string; sub: string; tone?: "default" | "accent" }) {
  return (
    <div className={cn(
      "rounded-lg border px-1.5 py-1.5 text-center",
      tone === "accent" ? "border-accent/40 bg-accent/10" : "border-border bg-background/60",
    )}>
      <div className="text-[8.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold tabular-nums leading-none text-foreground">{value}</div>
      <div className="mt-0.5 text-[8.5px] uppercase tracking-wider text-muted-foreground">{sub}</div>
    </div>
  );
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
    <Link
      to="/pricing"
      className="group relative block overflow-hidden rounded-xl border border-border bg-background/60 p-2.5 text-left transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-soft"
    >
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1">{icon}{title}</span>
        <Lock className="h-3 w-3 text-muted-foreground group-hover:text-accent" />
      </div>
      <div className="mt-1.5 space-y-0.5 select-none blur-[3.5px] saturate-75">
        {lines.map((l, i) => (
          <div key={i} className="truncate text-[11px] font-medium text-foreground/80">{l}</div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-8 items-end justify-center bg-gradient-to-t from-card via-card/85 to-transparent">
        <span className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent opacity-0 transition-opacity group-hover:opacity-100">
          Unlock →
        </span>
      </div>
    </Link>
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

function formatM(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace(/\.0$/, "")} km`;
  return `${m} m`;
}

interface WhySections {
  summary: string;
  opportunities: string[];
  strengths: string[];
  risks: string[];
}

function buildWhy(p: Property): WhySections {
  const heldYears = 2026 - new Date(p.ownership.since).getFullYear();
  const muniPremium = Math.round((p.estimatedValue / p.municipalValue - 1) * 100);
  const typeLabel = p.features.vacantLand ? "vacant residential erf" : `${p.type.toLowerCase()} erf`;

  const summary =
    `This ${p.sizeSqm.toLocaleString()} m² ${typeLabel} has been held for ${heldYears} years` +
    (p.scores.development >= 70 ? " and shows above-average development potential due to lot size and zoning headroom." : ".") +
    ` Estimated market value exceeds municipal value by ${muniPremium}%, ` +
    (muniPremium >= 50 ? "suggesting strong local demand and pricing power." : "broadly in line with the area trend.") +
    (p.features.beachfront || p.features.oceanView
      ? ` Ocean ${p.features.beachfront ? "frontage" : "proximity"} and low ownership turnover support long-term appreciation potential.`
      : p.distances.beachM < 1200
      ? ` Walking-distance to the beach supports lifestyle demand and resale velocity.`
      : ` Inland positioning prices on suburb fundamentals rather than coastal premium.`);

  const opportunities: string[] = [];
  if (p.scores.development >= 70) opportunities.push(`Development upside (${p.scores.development}/100) — usable bulk subject to municipal approval.`);
  if (p.scores.sellerProbability >= 65) opportunities.push(`Owner has held ${heldYears}y — modelled seller probability is elevated; off-market approach feasible.`);
  if (p.scores.rental >= 70 && (p.features.oceanView || p.distances.beachM < 1500)) opportunities.push(`Short-let yield is strong — peak-season demand premium in this micro-pocket.`);
  if (muniPremium >= 50) opportunities.push(`Municipal value lags market by ${muniPremium}% — rates assessment may be favourable.`);
  if (opportunities.length === 0) opportunities.push("Stable hold; opportunity profile sits near area median.");

  const strengths: string[] = [];
  if (p.features.beachfront) strengths.push("Beachfront positioning anchors long-term capital.");
  else if (p.features.oceanView) strengths.push("Ocean-view orientation commands a pricing premium.");
  if (p.features.largeErf) strengths.push(`Above-average erf (${p.sizeSqm.toLocaleString()} m²) in a constrained coastal market.`);
  if (p.scores.liquidity >= 70) strengths.push("High modelled liquidity — sells inside typical area DOM.");
  if (heldYears >= 10) strengths.push(`Long-term ownership (${heldYears}y) signals a quality micro-location.`);
  if (strengths.length === 0) strengths.push(`${p.area} fundamentals are stable; lifestyle score ${p.scores.lifestyle}/100.`);

  const risks: string[] = [];
  if (muniPremium >= 80) risks.push("Market-to-municipal gap is wide — re-rating risk if rolls catch up.");
  if (p.scores.liquidity < 55) risks.push("Lower-than-area liquidity — expect longer DOM if priced at upper bound.");
  if (heldYears < 3) risks.push("Recent transfer — comparable basis is thin for this specific erf.");
  if (p.features.vacantLand) risks.push("Vacant land — carrying costs and approval timeline reduce IRR.");
  if (p.distances.beachM > 2500 && !p.features.oceanView) risks.push("Beyond comfortable beach walk — limits short-let premium.");
  if (risks.length === 0) risks.push("No material flags in modelled risk factors.");

  return { summary, opportunities, strengths, risks };
}

function WhyCard({ property }: { property: Property }) {
  const why = buildWhy(property);
  return (
    <div className="pa-fade-up-delayed overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-3.5 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-sunrise text-primary-foreground">
            <Sparkles className="h-3 w-3" />
          </span>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">Why this property?</div>
        </div>
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
          AI · Mock
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-foreground/90">{why.summary}</p>

      <div className="mt-3 space-y-2 text-[11.5px]">
        <WhySection tone="opportunity" title="Opportunities" items={why.opportunities} />
        <WhySection tone="strength" title="Strengths" items={why.strengths} />
        <WhySection tone="risk" title="Risks" items={why.risks} />
      </div>
      <p
        className="mt-3 border-t border-border/60 pt-2 text-[10px] leading-snug text-muted-foreground"
        title="AI-generated insights are produced using automated analysis and may contain inaccuracies. Do not rely on AI-generated insights as professional advice."
      >
        <span className="font-semibold text-foreground/80">AI Generated Insight • Informational Use Only.</span> May contain inaccuracies — not professional advice. <span className="font-semibold text-foreground/80">Estimate Only • Not a Certified Valuation.</span>
      </p>
    </div>
  );
}

function WhySection({ tone, title, items }: { tone: "opportunity" | "strength" | "risk"; title: string; items: string[] }) {
  const styles = {
    opportunity: { dot: "bg-accent", label: "text-accent-foreground/80" },
    strength:    { dot: "bg-success",  label: "text-foreground/80" },
    risk:        { dot: "bg-destructive/80", label: "text-foreground/80" },
  }[tone];
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
        {title}
      </div>
      <ul className="space-y-0.5 pl-3">
        {items.map((t, i) => (
          <li key={i} className={cn("leading-snug", styles.label)}>• {t}</li>
        ))}
      </ul>
    </div>
  );
}

function SellerProbabilityCard({ value, heldYears }: { value: number; heldYears: number }) {
  const band = value >= 70 ? "High" : value >= 45 ? "Medium" : "Low";
  const tone =
    band === "High" ? "from-accent/20 to-accent/5 border-accent/40 text-accent-foreground"
    : band === "Medium" ? "from-primary/15 to-primary/5 border-primary/30 text-foreground"
    : "from-muted to-card border-border text-muted-foreground";
  const dot = band === "High" ? "bg-accent" : band === "Medium" ? "bg-primary" : "bg-muted-foreground/50";
  return (
    <div className={cn("relative col-span-2 overflow-hidden rounded-xl border bg-gradient-to-br p-3", tone)}>
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider">
        <span className="flex items-center gap-1.5"><Activity className="h-3 w-3" /> Seller Probability</span>
        <span className="rounded-full bg-card/70 px-1.5 py-0.5 text-[9px] font-semibold text-foreground/70 ring-1 ring-border">Mock model</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums leading-none text-foreground">{value}</span>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-foreground")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
          {band}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-card/60">
        <div className="pa-score-bar h-full rounded-full bg-gradient-sunrise" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-foreground/75">
        Modelled from {heldYears}y tenure, appreciation, owner profile and current market cycle. Indicative — not a forecast.
      </p>
    </div>
  );
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
        <div class="card"><div class="l">Estimated value</div><div class="v">${formatZAR(property.estimatedValue)}</div><div style="margin-top:4px;font-size:9px;font-weight:600;color:#b45309;text-transform:uppercase;letter-spacing:.04em">Estimate Only • Not a Certified Valuation</div></div>
        <div class="card"><div class="l">Municipal</div><div class="v">${formatZAR(property.municipalValue)}</div></div>
        <div class="card"><div class="l">Price / m²</div><div class="v">R ${Math.round(property.estimatedValue/property.sizeSqm).toLocaleString()}</div></div>
        <div class="card"><div class="l">Owner since</div><div class="v">${new Date(property.ownership.since).getFullYear()}</div></div>
      </div>

      <div style="margin-top:16px;padding:12px 14px;border:1px solid #fde68a;background:#fffbeb;border-radius:10px;font-size:11px;color:#78350f;line-height:1.5">
        <strong>Important:</strong> PropertyAtlas estimates are automated informational estimates and are not certified valuations or appraisals. This report is provided for informational purposes only and is not a professional valuation, legal opinion, or investment recommendation.
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

      {/* Transfer price trajectory */}
      <TransferChart sales={property.sales} estimate={property.estimatedValue} />



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

function TransferChart({ sales, estimate }: { sales: Property["sales"]; estimate: number }) {
  const sorted = [...sales].sort((a, b) => (a.date < b.date ? -1 : 1));
  const W = 320, H = 120, P = 24;
  const prices = [...sorted.map((s) => s.price), estimate];
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = Math.max(1, max - min);
  const xs = sorted.map((_, i) => P + (i * (W - 2 * P)) / Math.max(1, sorted.length - 1));
  const ys = sorted.map((s) => H - P - ((s.price - min) / range) * (H - 2 * P));
  const estY = H - P - ((estimate - min) / range) * (H - 2 * P);
  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const areaPath = `${linePath} L${xs[xs.length - 1]},${H - P} L${xs[0]},${H - P} Z`;
  return (
    <div className="rounded-xl bg-card/60 p-3 ring-1 ring-inset ring-border">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Price trajectory</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="tcGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#tcGrad)" />
        <path d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
        <line x1={P} x2={W - P} y1={estY} y2={estY} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity="0.5" />
        {sorted.map((s, i) => (
          <g key={s.date}>
            <circle cx={xs[i]} cy={ys[i]} r="3" fill="hsl(var(--primary))" />
            <text x={xs[i]} y={H - 6} textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground">
              {s.date.slice(0, 4)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function OwnershipTab({ property }: { property: Property }) {
  const heldYears = 2026 - new Date(property.ownership.since).getFullYear();
  const sorted = [...property.sales].sort((a, b) => (a.date < b.date ? 1 : -1));
  const others = PROPERTIES
    .filter((p) => p.id !== property.id && p.area === property.area && p.ownership.type === property.ownership.type)
    .sort((a, b) => b.scores.investor - a.scores.investor)
    .slice(0, 4);
  return (
    <div className="space-y-4">
      <Section title="Owner profile">
        <Row label="Type" value={property.ownership.type} />
        <Row label="Registered owner" value={property.ownership.ownerLabel} />
        <Row label="Held since" value={property.ownership.since} />
        <Row label="Tenure" value={`${heldYears} yrs`} />
        <Row label="Seller signal" value={`${property.scores.sellerProbability}/100`} />
      </Section>

      <Section title="Transfer timeline">
        <div className="space-y-2">
          {sorted.map((s, i) => {
            const prev = sorted[i + 1];
            const delta = prev ? Math.round(((s.price - prev.price) / prev.price) * 100) : null;
            return (
              <div key={s.date} className="flex items-center justify-between rounded-lg bg-card/60 px-3 py-2 ring-1 ring-inset ring-border">
                <div>
                  <div className="text-xs font-medium">{s.date}</div>
                  <div className="text-[10px] text-muted-foreground">{i === 0 ? "Most recent" : "Prior transfer"}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{formatZAR(s.price)}</div>
                  {delta !== null && (
                    <div className={cn("text-[10px]", delta >= 0 ? "text-emerald-500" : "text-red-500")}>
                      {delta >= 0 ? "+" : ""}{delta}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {others.length > 0 && (
        <Section title={`Other ${property.ownership.type.toLowerCase()} holdings in ${property.area}`}>
          <div className="space-y-1.5">
            {others.map((p) => (
              <Link key={p.id} to="/" search={{ parcel: p.id } as never} className="flex items-center justify-between rounded-lg bg-card/60 px-3 py-2 ring-1 ring-inset ring-border hover:ring-primary/40">
                <div>
                  <div className="text-xs font-medium">{p.street}</div>
                  <div className="text-[10px] text-muted-foreground">Erf {p.erf} · {p.sizeSqm} m²</div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function IntelligenceTab({ property }: { property: Property }) {
  const heldYears = 2026 - new Date(property.ownership.since).getFullYear();
  const summary = useMemo(() => buildAISummary(property, heldYears), [property, heldYears]);
  const feas = useMemo(() => buildFeasibility(property), [property]);
  const upside = Math.round(((feas.gdv - property.estimatedValue) / property.estimatedValue) * 100);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary/12 via-card to-card p-4 ring-1 ring-inset ring-primary/25">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3 w-3" /> AI summary
        </div>
        <p className="text-[13px] leading-relaxed text-foreground/90">{summary}</p>
        <p className="mt-2 border-t border-border/60 pt-2 text-[10px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground/80">AI Generated Insight • Informational Use Only.</span> Generated using automated analysis and may contain inaccuracies. <span className="font-semibold text-foreground/80">Estimate Only • Not a Certified Valuation.</span>
        </p>
      </div>

      <p className="rounded-xl border border-border bg-card/60 px-3 py-2 text-[10.5px] leading-snug text-muted-foreground">
        Scores are proprietary informational indicators and should not be interpreted as guarantees, recommendations, forecasts, or professional advice.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Gauge label="Investor" value={property.scores.investor} icon={<TrendingUp className="h-3 w-3" />} explain="Composite of liquidity, appreciation, and yield" />
        <Gauge label="Development" value={property.scores.development} icon={<Building2 className="h-3 w-3" />} explain="Zoning, bulk, and lot geometry potential" />
        <Gauge label="Ocean view" value={property.scores.oceanView} icon={<Eye className="h-3 w-3" />} explain="Line-of-sight to ocean from buildable area" />
        <Gauge label="Walkability" value={property.scores.walkability} icon={<Activity className="h-3 w-3" />} explain="Beach, retail, and amenity proximity" />
        <Gauge label="Appreciation" value={property.scores.appreciation} icon={<TrendingUp className="h-3 w-3" />} explain="Modelled 5-yr capital growth" />
        <Gauge label="Rental yield" value={property.scores.rental} icon={<Home className="h-3 w-3" />} explain="Short-let demand & seasonality" />
        <Gauge label="Liquidity" value={property.scores.liquidity} icon={<Banknote className="h-3 w-3" />} explain="Days-to-sell at fair value" />
        <Gauge label="Coastal" value={property.scores.coastal} icon={<Waves className="h-3 w-3" />} explain="Beachfront and coastline desirability" />
      </div>

      <Section title="Development feasibility">
        <div className="mb-3 grid grid-cols-3 gap-2">
          <FeasStat label="Buildable" value={`${feas.buildable.toLocaleString()} m²`} />
          <FeasStat label="Est. GDV" value={compactZAR(feas.gdv)} />
          <FeasStat label="Upside" value={`${upside >= 0 ? "+" : ""}${upside}%`} tone={upside >= 25 ? "accent" : "default"} />
        </div>
        <Row label="Zoning" value={property.zoning} />
        <Row label="Coverage allowance" value={`${Math.round(feas.coverage * 100)}%`} />
        <Row label="Bulk (FAR)" value={feas.far.toFixed(2)} />
        <Row label="Height limit" value={`${feas.storeys} storeys`} />
        <Row label="Estimated build cost" value={compactZAR(feas.buildCost)} />
        <Row label="Land cost (current value)" value={compactZAR(property.estimatedValue)} />
        <Row label="Projected gross margin" value={`${feas.margin}%`} />
      </Section>

      <Locked preview={["Highest-and-best-use analysis","Comparable new-builds","Plans & permits search","Sensitivity model","Developer brief PDF"]}>
        <Section title="Premium development modules">
          <Row label="Highest & best use" value="3-unit short-let stack" />
          <Row label="Sensitivity (±10% build)" value={`${compactZAR(feas.gdv * 0.9)} – ${compactZAR(feas.gdv * 1.1)}`} />
          <Row label="Permit pack" value="Concept + zoning brief" />
        </Section>
      </Locked>
    </div>
  );
}

function FeasStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "accent" }) {
  return (
    <div className={cn(
      "rounded-lg px-2.5 py-2 ring-1 ring-inset",
      tone === "accent" ? "bg-primary/10 ring-primary/30" : "bg-card/60 ring-border"
    )}>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-[13px] font-semibold leading-tight", tone === "accent" && "text-primary")}>{value}</div>
    </div>
  );
}

function buildFeasibility(p: Property) {
  const coverage =
    p.type === "Commercial" ? 0.75 :
    p.type === "Vacant Land" ? 0.55 :
    p.zoning.includes("General") ? 0.65 : 0.50;
  const far =
    p.type === "Commercial" ? 1.4 :
    p.zoning.includes("General") ? 1.0 : 0.8;
  const storeys = p.type === "Commercial" ? 3 : far >= 1.0 ? 3 : 2;
  const buildable = Math.round(p.sizeSqm * coverage);
  const gfa = Math.round(p.sizeSqm * far);
  const costPerSqm = p.type === "Commercial" ? 16500 : 14500;
  const buildCost = gfa * costPerSqm;
  const sellPerSqm = Math.round(p.estimatedValue / Math.max(120, p.sizeSqm * 0.4));
  const gdv = Math.round(gfa * sellPerSqm * 1.15);
  const totalCost = buildCost + p.estimatedValue;
  const margin = Math.max(0, Math.round(((gdv - totalCost) / Math.max(1, gdv)) * 100));
  return { coverage, far, storeys, buildable, gfa, buildCost, gdv, margin };
}

function buildAISummary(p: Property, heldYears: number): string {
  const headline =
    p.features.beachfront ? "rare beachfront erf"
    : p.features.oceanView ? "ocean-view stand"
    : p.features.vacantLand ? "vacant development opportunity"
    : p.features.largeErf ? "large family erf"
    : `${p.type.toLowerCase()} property`;
  const s1 = `${p.street} is a ${p.sizeSqm.toLocaleString()} m² ${headline} in ${p.area}, currently estimated at ${formatZAR(p.estimatedValue)}.`;
  const sellSignal = p.scores.sellerProbability >= 70 ? "high" : p.scores.sellerProbability >= 45 ? "moderate" : "low";
  const s2 = `Held by ${p.ownership.type === "Individual" ? "an individual" : `a ${p.ownership.type.toLowerCase()}`} for ${heldYears} years with a ${sellSignal} seller-intent signal (${p.scores.sellerProbability}/100) and an investor score of ${p.scores.investor}/100.`;
  const angle =
    p.features.vacantLand ? "Best framed as a build-to-sell or build-to-let development play given zoning headroom."
    : p.scores.appreciation >= 70 ? "Positioned for above-market capital growth, with a credible short-let yield overlay."
    : p.scores.rental >= 70 ? "Strongest case is a yield play — proven short-let demand on this stretch."
    : "Suited to a long-hold lifestyle buyer; capital growth tracks the suburb median.";
  return `${s1} ${s2} ${angle}`;
}
