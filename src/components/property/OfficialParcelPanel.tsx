import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, ExternalLink, ShieldCheck, FileText, Lock, MapPin, Sparkles, Link2,
  Tag as TagIcon, NotebookPen, Calculator, Bookmark, BookmarkCheck, Share2, Pencil, Save as SaveIcon,
} from "lucide-react";
import type { OfficialFeatureSelection } from "@/components/map/MapCanvas";
import { ResearchLinksTab } from "./tabs/ResearchLinksTab";
import { ListingsTab } from "./tabs/ListingsTab";
import { ReportsTab } from "./tabs/ReportsTab";
import { NotesTab } from "./tabs/NotesTab";
import { CalculatorsTab } from "./tabs/CalculatorsTab";
import { buildResearchQuery, type ResearchContext } from "@/lib/research/links";
import { buildSgDocumentUrl } from "@/lib/research/sgDocument";
import { fetchKougaEnrichment, type KougaEnrichment } from "@/lib/providers/kougaEnrichment";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { openExternalUrl } from "@/lib/external";
import { CSG_VIEWER_URL, KOUGA_PUBLIC_MAP_URL } from "@/lib/external-urls";
import { toast } from "sonner";

interface Props {
  selection: OfficialFeatureSelection;
  onClose: () => void;
}

const NA = "Not available from public source";
function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return NA;
  return String(v);
}

function normalizeCsg(p: Record<string, unknown>) {
  return {
    provider: "Chief Surveyor-General",
    erfNumber: (p.PARCEL_NO ?? p.TAG_VALUE) as string | number | undefined,
    portion: p.PORTION as string | number | undefined,
    lpi: p.ID as string | undefined,
    parcelKey: p.PRCL_KEY as string | undefined,
    province: p.PROVINCE as string | undefined,
    majorRegion: p.MAJ_REGION as string | undefined,
    minorRegion: p.MIN_REGION as string | undefined,
    geometryArea: (p.GEOM_AREA ?? p.SHAPE_Area) as number | undefined,
    longitude: p.TAG_X as number | undefined,
    latitude: p.TAG_Y as number | undefined,
  };
}

function normalizeKouga(p: Record<string, unknown>) {
  return {
    provider: "Kouga Municipality GIS",
    zoningType: p.ZONING_TYP,
    zoningCode: p.ZONING,
    zoningDescription: p.ZONING_DES,
    shapeArea: p.Shape__Area,
    shapeLength: p.Shape__Length,
  };
}

type Tab = "overview" | "research" | "listings" | "reports" | "notes" | "calculators";
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "research", label: "Research", icon: <Link2 className="h-3.5 w-3.5" /> },
  { id: "listings", label: "Listings", icon: <TagIcon className="h-3.5 w-3.5" /> },
  { id: "reports", label: "Reports", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "notes", label: "Notes", icon: <NotebookPen className="h-3.5 w-3.5" /> },
  { id: "calculators", label: "Calculators", icon: <Calculator className="h-3.5 w-3.5" /> },
];

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

type Geo = {
  streetNumber?: string;
  streetName?: string;
  nearestRoad?: string;
  suburb?: string;
  place?: string;
};

async function reverseGeocode(lng: number, lat: number): Promise<Geo | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=address,neighborhood,locality,place&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const feat = json.features?.[0];
    if (!feat) return null;
    const ctx: Array<{ id: string; text: string }> = feat.context ?? [];
    const suburb = ctx.find((c) => c.id.startsWith("neighborhood") || c.id.startsWith("locality"))?.text;
    const place = ctx.find((c) => c.id.startsWith("place"))?.text;
    const isAddress = feat.place_type?.includes("address");
    const streetNumber = isAddress && feat.address ? String(feat.address) : undefined;
    const streetName = isAddress ? (feat.text as string | undefined) : undefined;
    const nearestRoad = isAddress && !streetNumber ? (feat.text as string | undefined) : undefined;
    return { streetNumber, streetName, nearestRoad, suburb, place };
  } catch {
    return null;
  }
}

type AddressSource = "Official Address" | "User Entered" | "Approximate Address" | "Nearest Road Only" | "Erf Only";

interface UserAddress {
  streetNumber?: string;
  streetName?: string;
  suburb?: string;
  town?: string;
  province?: string;
  notes?: string;
}

interface ResolvedLocation {
  displayTitle: string;
  displaySubtitle: string;
  approximateAddress?: string;
  nearestRoad?: string;
  streetNumber?: string;
  streetName?: string;
  addressConfidence: AddressSource;
  addressSource: AddressSource;
  researchQuery: string;
}

function resolveOfficialParcelLocation(opts: {
  erfNumber?: string | number;
  portion?: string | number;
  minorRegion?: string;
  majorRegion?: string;
  province?: string;
  latitude: number;
  longitude: number;
  geo: Geo | null;
  user?: UserAddress | null;
}): ResolvedLocation {
  const { erfNumber, minorRegion, majorRegion, province, geo, user } = opts;
  const erfLabel = erfNumber != null ? `Erf ${erfNumber}` : "Erf";

  // 1. User-entered (when meaningful)
  if (user && (user.streetNumber || user.streetName)) {
    const street = [user.streetNumber, user.streetName].filter(Boolean).join(" ");
    return {
      displayTitle: street || erfLabel,
      displaySubtitle: [erfLabel, user.suburb ?? minorRegion, "User Entered"].filter(Boolean).join(" · "),
      approximateAddress: street,
      streetNumber: user.streetNumber,
      streetName: user.streetName,
      addressConfidence: "User Entered",
      addressSource: "User Entered",
      researchQuery: [street, erfLabel, user.suburb ?? minorRegion, user.town ?? majorRegion, user.province ?? province, "South Africa"]
        .filter(Boolean).join(" "),
    };
  }

  // 2. Mapbox helper context only — never promote a guessed full address into the title.
  //    The official identity is the erf. Treat any street name as "nearest road" hint only.

  // 3. Mapbox returned only a road name — never promote to title
  const road = geo?.nearestRoad ?? geo?.streetName;
  const regionSubtitle = [minorRegion, majorRegion, province ?? "Eastern Cape"].filter(Boolean).join(" · ");
  if (road) {
    return {
      displayTitle: erfLabel,
      displaySubtitle: regionSubtitle,
      nearestRoad: road,
      addressConfidence: "Nearest Road Only",
      addressSource: "Nearest Road Only",
      researchQuery: [erfLabel, minorRegion, majorRegion, province ?? "Eastern Cape", road, "South Africa"]
        .filter(Boolean).join(" "),
    };
  }

  // 4. Coordinates + region only — erf-first identity
  return {
    displayTitle: erfLabel,
    displaySubtitle: regionSubtitle,
    addressConfidence: "Erf Only",
    addressSource: "Erf Only",
    researchQuery: [erfLabel, minorRegion, majorRegion, province ?? "Eastern Cape", "South Africa"].filter(Boolean).join(" "),
  };
}

const CONFIDENCE_TONE: Record<AddressSource, string> = {
  "Official Address": "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300",
  "User Entered": "bg-sky-500/20 text-sky-800 dark:text-sky-300",
  "Approximate Address": "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "Nearest Road Only": "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "Erf Only": "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

function userAddrKey(parcelId: string) { return `pa.userAddress.${parcelId}`; }
function readUserAddress(parcelId: string): UserAddress | null {
  try { const v = window.localStorage.getItem(userAddrKey(parcelId)); return v ? JSON.parse(v) as UserAddress : null; } catch { return null; }
}
function writeUserAddress(parcelId: string, a: UserAddress | null) {
  try {
    if (!a) window.localStorage.removeItem(userAddrKey(parcelId));
    else window.localStorage.setItem(userAddrKey(parcelId), JSON.stringify(a));
  } catch {}
}

export function OfficialParcelPanel({ selection, onClose }: Props) {
  const { user } = useAuth();
  const isCsg = selection.layer === "csg-parcels";
  const csg = useMemo(() => (isCsg ? normalizeCsg(selection.properties) : null), [selection, isCsg]);
  const kouga = useMemo(() => (!isCsg ? normalizeKouga(selection.properties) : null), [selection, isCsg]);
  const [tab, setTab] = useState<Tab>("overview");
  const [geo, setGeo] = useState<Geo | null>(null);
  const [saved, setSaved] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fetchedAt = useMemo(() => new Date().toLocaleString(), [selection]);

  const [lng, lat] = selection.lngLat;
  const parcelKey = (csg?.parcelKey ?? csg?.lpi ?? String(selection.properties.OBJECTID ?? "unknown")) as string;
  const parcelId = isCsg ? `csg:${parcelKey}` : `kouga:${parcelKey}`;

  const [userAddr, setUserAddr] = useState<UserAddress | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserAddress>({});

  useEffect(() => { setTab("overview"); scrollRef.current?.scrollTo({ top: 0 }); }, [parcelId]);
  useEffect(() => { const a = readUserAddress(parcelId); setUserAddr(a); setDraft(a ?? {}); setEditing(false); }, [parcelId]);

  useEffect(() => {
    let cancelled = false;
    setGeo(null);
    reverseGeocode(csg?.longitude ?? lng, csg?.latitude ?? lat).then((g) => { if (!cancelled) setGeo(g); });
    return () => { cancelled = true; };
  }, [parcelId, lng, lat, csg?.longitude, csg?.latitude]);

  useEffect(() => {
    if (!user) { setSaved(false); return; }
    supabase.from("saved_properties").select("id").eq("user_id", user.id).eq("parcel_id", parcelId)
      .maybeSingle().then(({ data }) => setSaved(!!data));
  }, [user, parcelId]);

  const [enrichment, setEnrichment] = useState<KougaEnrichment | null>(null);
  useEffect(() => {
    let cancelled = false;
    setEnrichment(null);
    fetchKougaEnrichment(csg?.longitude ?? lng, csg?.latitude ?? lat).then((e) => {
      if (!cancelled) setEnrichment(e);
    });
    return () => { cancelled = true; };
  }, [parcelId, lng, lat, csg?.longitude, csg?.latitude]);

  const resolved = useMemo(() => resolveOfficialParcelLocation({
    erfNumber: csg?.erfNumber,
    portion: csg?.portion,
    minorRegion: csg?.minorRegion,
    majorRegion: csg?.majorRegion,
    province: csg?.province ?? "Eastern Cape",
    latitude: csg?.latitude ?? lat,
    longitude: csg?.longitude ?? lng,
    geo,
    user: userAddr,
  }), [csg, geo, userAddr, lat, lng]);

  const sgDoc = useMemo(() => buildSgDocumentUrl({
    lpi: csg?.lpi,
    parcelKey: csg?.parcelKey,
    erfNumber: csg?.erfNumber,
    portion: csg?.portion,
    province: csg?.province,
    majorRegion: csg?.majorRegion,
    minorRegion: csg?.minorRegion,
  }), [csg]);

  const sourceUrl = isCsg ? CSG_VIEWER_URL : KOUGA_PUBLIC_MAP_URL;
  const sourceLabel = isCsg ? "Open CSG Property Viewer" : "Open Kouga Public Map";

  const researchCtx: ResearchContext = {
    address: userAddr && (userAddr.streetNumber || userAddr.streetName)
      ? [userAddr.streetNumber, userAddr.streetName].filter(Boolean).join(" ")
      : undefined,
    area: csg?.minorRegion,
    town: userAddr?.town ?? csg?.majorRegion,
    suburb: userAddr?.suburb ?? csg?.minorRegion,
    municipality: "Kouga Local Municipality",
    province: userAddr?.province ?? csg?.province ?? "Eastern Cape",
    erf: csg?.erfNumber != null ? String(csg.erfNumber) : undefined,
    nearestRoad: resolved.nearestRoad ?? resolved.streetName,
    lng: csg?.longitude ?? lng,
    lat: csg?.latitude ?? lat,
  };
  // Ensure researchQuery aligns with our resolver
  void buildResearchQuery(researchCtx);

  const summary = resolved.displayTitle + (resolved.displaySubtitle ? ` — ${resolved.displaySubtitle}` : "");

  function saveDraft() {
    const cleaned: UserAddress = {
      streetNumber: draft.streetNumber?.trim() || undefined,
      streetName: draft.streetName?.trim() || undefined,
      suburb: draft.suburb?.trim() || undefined,
      town: draft.town?.trim() || undefined,
      province: draft.province?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
    };
    const isEmpty = !Object.values(cleaned).some(Boolean);
    writeUserAddress(parcelId, isEmpty ? null : cleaned);
    setUserAddr(isEmpty ? null : cleaned);
    setEditing(false);
    toast.success(isEmpty ? "Cleared address override" : "Address saved");
  }

  async function toggleSave() {
    if (!user) { toast.message("Sign in to save properties"); return; }
    if (saved) {
      await supabase.from("saved_properties").delete().eq("user_id", user.id).eq("parcel_id", parcelId);
      setSaved(false); toast.success("Removed from saved");
    } else {
      const userData = {
        provider: csg ? "Chief Surveyor-General" : "Kouga Municipality GIS",
        displayTitle: resolved.displayTitle,
        displaySubtitle: resolved.displaySubtitle,
        approximateAddress: resolved.approximateAddress ?? null,
        streetNumber: resolved.streetNumber ?? null,
        streetName: resolved.streetName ?? null,
        nearestRoad: resolved.nearestRoad ?? null,
        erfNumber: csg?.erfNumber ?? null,
        portion: csg?.portion ?? null,
        lpi: csg?.lpi ?? null,
        parcelKey: csg?.parcelKey ?? null,
        province: csg?.province ?? null,
        majorRegion: csg?.majorRegion ?? null,
        minorRegion: csg?.minorRegion ?? null,
        geometryArea: csg?.geometryArea ?? null,
        zoningCode: (kouga?.zoningCode as string | number | null) ?? null,
        zoningType: (kouga?.zoningType as string | number | null) ?? null,
        lng: csg?.longitude ?? lng,
        lat: csg?.latitude ?? lat,
        addressSource: resolved.addressSource,
        addressConfidence: resolved.addressConfidence,
        researchQuery: resolved.researchQuery,
        userEntered: userAddr ?? null,
        fetchedAt: new Date().toISOString(),
      };
      const { error } = await supabase.from("saved_properties").insert({
        user_id: user.id,
        parcel_id: parcelId,
        external_links: [{ label: isCsg ? "CSG Viewer" : "Kouga Mapping Portal", url: sourceUrl, category: "official" }],
        user_data: userData as unknown as Record<string, unknown> as never,
      });
      if (error) toast.error(error.message);
      else { setSaved(true); toast.success("Saved to your properties"); }
    }
  }

  return (
    <aside className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex max-h-[88vh] flex-col rounded-t-3xl border border-border bg-card shadow-panel md:left-auto md:right-0 md:top-0 md:bottom-0 md:h-screen md:max-h-screen md:w-[440px] md:rounded-l-3xl md:rounded-tr-none md:border-l lg:w-[480px]">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" /> Official Public Data
            </span>
            <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-foreground">{isCsg ? "CSG" : "Kouga"}</span>
          </div>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">{resolved.displayTitle}</h2>
          {resolved.displaySubtitle && (
            <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> {resolved.displaySubtitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleSave} className="rounded-full p-2 hover:bg-muted" title={saved ? "Saved" : "Save property"}>
            {saved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
          </button>
          <button className="rounded-full p-2 hover:bg-muted" title="Share"><Share2 className="h-4 w-4" /></button>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
      </header>

      <div ref={scrollRef} className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8">
        <div className="sticky top-0 z-10 border-b border-border bg-card">
          <div className="scrollbar-none flex gap-0.5 overflow-x-auto px-2 sm:px-3">
            {TABS.map(({ id, label }) => {
              const active = tab === id;
              return (
                <button key={id} onClick={() => { setTab(id); requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 })); }}
                  className={cn("relative inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-2.5 text-[11px] font-medium transition",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
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
              {/* Research Snapshot */}
              <section className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Research Snapshot
                  </div>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider", CONFIDENCE_TONE[resolved.addressConfidence])}>
                    {resolved.addressConfidence}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SnapshotTile
                    label="Erf"
                    value={csg?.erfNumber != null ? `Erf ${csg.erfNumber}` : "—"}
                    sub={csg?.portion != null && String(csg.portion) !== "0" ? `Portion ${csg.portion}` : undefined}
                  />
                  <SnapshotTile
                    label="Area"
                    value={csg?.geometryArea != null ? `${Math.round(Number(csg.geometryArea)).toLocaleString("en-ZA")} m²` : "—"}
                  />
                  <SnapshotTile
                    label="Zoning"
                    value={(() => {
                      const z = enrichment?.zoning;
                      if (!z) return "Checking…";
                      if (z.status === "ok") return String(z.record.attributes.ZONING ?? z.record.attributes.ZONING_TYP ?? "—");
                      if (z.status === "not-found") return "No record";
                      return "—";
                    })()}
                    sub={(() => {
                      const z = enrichment?.zoning;
                      if (z?.status === "ok") {
                        const t = z.record.attributes.ZONING_TYP;
                        return t ? String(t) : undefined;
                      }
                      return undefined;
                    })()}
                  />
                  <SnapshotTile
                    label="SG Document"
                    value={sgDoc.shown ? "Available" : "Not available"}
                    sub={sgDoc.shown ? undefined : "Insufficient data"}
                    action={sgDoc.shown ? (
                      <button
                        type="button"
                        onClick={(e) => openExternalUrl(sgDoc.url, e)}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                      >
                        Open <ExternalLink className="h-2.5 w-2.5" />
                      </button>
                    ) : undefined}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5 text-[11px]">
                  <div className="min-w-0 truncate text-muted-foreground">
                    <MapPin className="mr-1 inline h-3 w-3" />
                    {[csg?.minorRegion, csg?.majorRegion, csg?.province ?? "Eastern Cape"].filter(Boolean).join(" · ")}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => openExternalUrl(`https://maps.google.com/?q=${csg?.latitude ?? lat},${csg?.longitude ?? lng}`, e)}
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    Open in Maps <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
                <div className="mt-1 text-[10px] font-mono text-muted-foreground">
                  {(csg?.latitude ?? lat).toFixed(5)}, {(csg?.longitude ?? lng).toFixed(5)}
                </div>
              </section>

              {/* Address / Location card */}
              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Address / Location</div>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider", CONFIDENCE_TONE[resolved.addressConfidence])}>
                    {resolved.addressConfidence}
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-background">
                  <div className="px-3 py-2.5">
                    <div className="text-[13px] font-medium text-foreground">{resolved.displayTitle}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{resolved.displaySubtitle || "Location only — coordinates and region."}</div>
                  </div>
                  <dl className="divide-y divide-border border-t border-border text-[12px]">
                    {csg?.erfNumber != null && <Row label="Erf number" value={fmt(csg.erfNumber)} />}
                    {csg?.portion != null && <Row label="Portion" value={fmt(csg.portion)} />}
                    {resolved.streetNumber && <Row label="Street number" value={resolved.streetNumber} />}
                    {resolved.streetName && <Row label="Street name" value={resolved.streetName} />}
                    {resolved.nearestRoad && <Row label="Nearest road" value={resolved.nearestRoad} />}
                    <Row label="Minor region" value={fmt(userAddr?.suburb ?? csg?.minorRegion)} />
                    <Row label="Major region" value={fmt(userAddr?.town ?? csg?.majorRegion)} />
                    <Row label="Province" value={fmt(userAddr?.province ?? csg?.province)} />
                    <Row label="Latitude" value={fmt((csg?.latitude ?? lat).toFixed(6))} />
                    <Row label="Longitude" value={fmt((csg?.longitude ?? lng).toFixed(6))} />
                    <Row label="Address source" value={resolved.addressSource} />
                  </dl>
                  <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                    Street address is not available from the CSG public cadastral layer. Add or verify the street address manually, or order a third-party report.
                  </div>
                  <div className="flex items-center justify-between border-t border-border px-3 py-2">
                    <button
                      onClick={() => setEditing((e) => !e)}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted/80"
                    >
                      <Pencil className="h-3 w-3" /> {editing ? "Cancel" : "Edit address"}
                    </button>
                    {userAddr && !editing && (
                      <button onClick={() => { writeUserAddress(parcelId, null); setUserAddr(null); setDraft({}); toast.success("Cleared override"); }}
                        className="text-[11px] text-muted-foreground underline-offset-2 hover:underline">Clear override</button>
                    )}
                  </div>
                  {editing && (
                    <div className="space-y-2 border-t border-border px-3 py-3">
                      <div className="grid grid-cols-3 gap-2">
                        <input className="col-span-1 rounded-md border border-border bg-background px-2 py-1.5 text-[12px]" placeholder="No." value={draft.streetNumber ?? ""} onChange={(e) => setDraft((d) => ({ ...d, streetNumber: e.target.value }))} />
                        <input className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-[12px]" placeholder="Street name" value={draft.streetName ?? ""} onChange={(e) => setDraft((d) => ({ ...d, streetName: e.target.value }))} />
                      </div>
                      <input className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px]" placeholder="Suburb" value={draft.suburb ?? ""} onChange={(e) => setDraft((d) => ({ ...d, suburb: e.target.value }))} />
                      <input className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px]" placeholder="Town" value={draft.town ?? ""} onChange={(e) => setDraft((d) => ({ ...d, town: e.target.value }))} />
                      <input className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px]" placeholder="Province" value={draft.province ?? ""} onChange={(e) => setDraft((d) => ({ ...d, province: e.target.value }))} />
                      <textarea className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px]" placeholder="Notes" rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
                      <button onClick={saveDraft} className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background hover:opacity-90">
                        <SaveIcon className="h-3 w-3" /> Save address
                      </button>
                      <p className="text-[10px] text-muted-foreground">Stored locally as User Entered. Does not modify the official CSG record.</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Official Cadastral Record */}
              {csg && (
                <section>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Official Cadastral Record</div>
                  <dl className="divide-y divide-border rounded-xl border border-border text-[12px]">
                    <Row label="Source" value={csg.provider} />
                    <Row label="Erf number" value={fmt(csg.erfNumber)} />
                    <Row label="Portion" value={fmt(csg.portion)} />
                    <Row label="LPI / ID" value={fmt(csg.lpi)} />
                    <Row label="Parcel key" value={fmt(csg.parcelKey)} />
                    <Row label="Province" value={fmt(csg.province)} />
                    <Row label="Major region" value={fmt(csg.majorRegion)} />
                    <Row label="Minor region" value={fmt(csg.minorRegion)} />
                    <Row label="Geometry area (m²)" value={fmt(csg.geometryArea)} />
                    <Row label="Latitude" value={fmt((csg.latitude ?? lat).toFixed(6))} />
                    <Row label="Longitude" value={fmt((csg.longitude ?? lng).toFixed(6))} />
                    <Row label="Last fetched" value={fetchedAt} />
                  </dl>
                </section>
              )}

              {kouga && (
                <section>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Official Public Zoning Record</div>
                  <dl className="divide-y divide-border rounded-xl border border-border text-[12px]">
                    <Row label="Source" value={kouga.provider} />
                    <Row label="Zoning code" value={fmt(kouga.zoningCode)} />
                    <Row label="Zoning type" value={fmt(kouga.zoningType)} />
                    <Row label="Zoning description" value={fmt(kouga.zoningDescription)} />
                    <Row label="Shape area" value={fmt(kouga.shapeArea)} />
                    <Row label="Shape length" value={fmt(kouga.shapeLength)} />
                    <Row label="Last fetched" value={fetchedAt} />
                  </dl>
                </section>
              )}

              <section className="space-y-2">
                {sgDoc.shown ? (
                  <button
                    type="button"
                    onClick={(e) => openExternalUrl(sgDoc.url, e)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90"
                  >
                    <FileText className="h-3 w-3" /> Open SG Document List <ExternalLink className="h-3 w-3" />
                  </button>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5">
                    <div className="text-[12px] font-medium text-foreground">SG document link not available for this erf yet.</div>
                    <div className="mt-0.5 text-[10.5px] text-muted-foreground">{sgDoc.reason}</div>
                    <button
                      type="button"
                      onClick={(e) => openExternalUrl(sgDoc.fallbackUrl, e)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted/80"
                    >
                      Open CSG Property Viewer <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => openExternalUrl(sourceUrl, e)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  {sourceLabel} <ExternalLink className="h-3 w-3" />
                </button>
              </section>


              {/* Kouga public GIS enrichment — zoning */}
              <section>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kouga Zoning</div>
                <EnrichmentBlock label="Zoning" state={enrichment?.zoning} hint="No zoning record found from Kouga public GIS." />
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Sourced from the Kouga public ArcGIS Hub. Shown for guidance only — confirm with the municipality before relying on it.
                </p>
              </section>

              {/* Kouga Public Mapping Record (Surveyor-General properties layer) */}
              <KougaPropertyPanel state={enrichment?.property} />

              {/* Municipal Context (wards layer) */}
              <KougaWardPanel state={enrichment?.ward} />


              <section className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">No valuation available</div>
                <p className="mt-1 text-[12px] text-foreground">
                  No valuation available from this public source. Order a Lightstone or WinDeed report for valuation,
                  ownership, transfers, bonds, and comparable sales.
                </p>
              </section>
            </div>
          )}

          {tab === "research" && <ResearchLinksTab ctx={researchCtx} parcelId={parcelId} />}
          {tab === "listings" && <ListingsTab parcelId={parcelId} ctx={researchCtx} />}
          {tab === "reports" && <ReportsTab parcelId={parcelId} summary={summary} />}
          {tab === "notes" && <NotesTab parcelId={parcelId} />}
          {tab === "calculators" && <CalculatorsTab />}
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] truncate text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function EnrichmentBlock({
  label, state, hint, configHint,
}: {
  label: string;
  state: import("@/lib/providers/kougaEnrichment").KougaEnrichmentState | undefined;
  hint: string;
  configHint?: string;
}) {
  if (!state) {
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">{label}:</span> checking Kouga public GIS…
      </div>
    );
  }
  if (state.status === "not-configured") {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">{label}:</span> {configHint ?? "Endpoint not configured."}
      </div>
    );
  }
  if (state.status === "not-found") {
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">{label}:</span> {hint}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
        <span className="font-semibold">{label}:</span> Could not reach Kouga GIS ({state.message}).
      </div>
    );
  }
  const attrs = state.record.attributes;
  const entries = Object.entries(attrs).filter(([, v]) => v !== null && v !== undefined && v !== "");
  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="border-b border-border px-3 py-1.5 text-[11px] font-semibold text-foreground">{label}</div>
      <dl className="divide-y divide-border text-[11.5px]">
        {entries.slice(0, 8).map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <dt className="truncate text-muted-foreground">{k}</dt>
            <dd className="max-w-[60%] truncate text-right font-medium text-foreground">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SnapshotTile({ label, value, sub, action }: { label: string; value: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        {action}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-semibold text-foreground">{value}</div>
      {sub && <div className="truncate text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

type KougaState = import("@/lib/providers/kougaEnrichment").KougaEnrichmentState;

function pickField(attrs: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = attrs[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function fmtDate(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "number") {
    try { return new Date(v).toISOString().slice(0, 10); } catch { return String(v); }
  }
  return String(v);
}

function fmtNum(v: unknown, digits = 2): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function KougaSectionFrame({
  title, source, matchMethod, children,
}: { title: string; source: string; matchMethod?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
        {matchMethod && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
            Match: {matchMethod}
          </span>
        )}
      </div>
      {children}
      <p className="mt-1.5 text-[10px] text-muted-foreground">Source: {source}</p>
    </section>
  );
}

function StateMessage({ title, body, tone = "muted" }: { title: string; body: string; tone?: "muted" | "amber" }) {
  return (
    <div className={cn(
      "rounded-lg border border-border bg-background px-3 py-2 text-[11px]",
      tone === "amber" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
    )}>
      <span className="font-semibold text-foreground">{title}:</span> {body}
    </div>
  );
}

function KougaPropertyPanel({ state }: { state: KougaState | undefined }) {
  const title = "Kouga Public Mapping Record";
  const source = "Kouga Public Mapping Viewer";
  if (!state) return <KougaSectionFrame title={title} source={source}><StateMessage title="Kouga property record" body="checking Kouga public GIS…" /></KougaSectionFrame>;
  if (state.status === "not-configured") return <KougaSectionFrame title={title} source={source}><StateMessage title="Kouga property record" body="Endpoint not configured." /></KougaSectionFrame>;
  if (state.status === "not-found") return <KougaSectionFrame title={title} source={source}><StateMessage title="Kouga property record" body="No match for this point." /></KougaSectionFrame>;
  if (state.status === "error") return <KougaSectionFrame title={title} source={source}><StateMessage title="Kouga property record" body="Unavailable — try again later." tone="amber" /></KougaSectionFrame>;

  const a = state.record.attributes;
  const geomArea = pickField(a, ["GEOM_AREA", "Shape__Area", "SHAPE_Area", "SHAPE__Area"]);
  const geomAreaNum = typeof geomArea === "number" ? geomArea : Number(geomArea);
  const rows: Array<[string, string | undefined]> = [
    ["Parcel number", fmt(pickField(a, ["PARCEL_NO", "PARCEL_NUMBER", "PARCELNO"]))],
    ["21 Digit Code / LPI", fmt(pickField(a, ["LPI", "LPI_CODE", "ID", "TWENTYONE_DIGIT"]))],
    ["Province", fmt(pickField(a, ["PROVINCE", "PROV_NAME"]))],
    ["Major region", fmt(pickField(a, ["MAJ_REGION", "MAJOR_REGION"]))],
    ["Major code", fmt(pickField(a, ["MAJ_CODE", "MAJOR_CODE"]))],
    ["Minor region", fmt(pickField(a, ["MIN_REGION", "MINOR_REGION"]))],
    ["Minor code", fmt(pickField(a, ["MIN_CODE", "MINOR_CODE", "REG_DIV"]))],
    ["Geometry area", Number.isFinite(geomAreaNum) ? fmtNum(geomAreaNum, 2) : undefined],
    ["Area m²", Number.isFinite(geomAreaNum) ? fmtNum(geomAreaNum, 0) : undefined],
    ["Area ha", Number.isFinite(geomAreaNum) ? fmtNum(geomAreaNum / 10000, 4) : undefined],
    ["Modified date", fmtDate(pickField(a, ["MODIFIED", "LAST_EDITED_DATE", "EditDate", "last_edited_date"]))],
  ].filter(([, v]) => v !== undefined && v !== NA) as Array<[string, string]>;

  return (
    <KougaSectionFrame title={title} source={source} matchMethod={state.record.matchMethod}>
      <div className="rounded-lg border border-border bg-background">
        <dl className="divide-y divide-border text-[11.5px]">
          {rows.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">Match returned, but no labeled fields recognised.</div>
          )}
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <dt className="truncate text-muted-foreground">{k}</dt>
              <dd className="max-w-[60%] truncate text-right font-medium text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </KougaSectionFrame>
  );
}

function KougaWardPanel({ state }: { state: KougaState | undefined }) {
  const title = "Municipal Context";
  const source = "Kouga Public Mapping Viewer";
  if (!state) return <KougaSectionFrame title={title} source={source}><StateMessage title="Kouga ward record" body="checking Kouga public GIS…" /></KougaSectionFrame>;
  if (state.status === "not-configured") return <KougaSectionFrame title={title} source={source}><StateMessage title="Kouga ward record" body="Endpoint not configured." /></KougaSectionFrame>;
  if (state.status === "not-found") return <KougaSectionFrame title={title} source={source}><StateMessage title="Kouga ward record" body="No match for this point." /></KougaSectionFrame>;
  if (state.status === "error") return <KougaSectionFrame title={title} source={source}><StateMessage title="Kouga ward record" body="Unavailable — try again later." tone="amber" /></KougaSectionFrame>;

  const a = state.record.attributes;
  const rows: Array<[string, string | undefined]> = [
    ["Province", fmt(pickField(a, ["PROVINCE", "PROV_NAME"]))],
    ["Municipality", fmt(pickField(a, ["MUNICIPALITY", "LM_NAME", "MUNIC_NAME", "MUN_NAME"]))],
    ["Ward number", fmt(pickField(a, ["WARD_NO", "WARDNO", "WARD", "WARDNUMBER", "WARD_NUMBER"]))],
    ["Ward ID", fmt(pickField(a, ["WARD_ID", "WARDID"]))],
    ["Voting station", fmt(pickField(a, ["VOTING_STN", "VDNAME", "VOTING_STATION"]))],
    ["Updated date", fmtDate(pickField(a, ["UPDATED", "EditDate", "LAST_EDITED_DATE", "last_edited_date"]))],
    ["Shape area", fmtNum(pickField(a, ["Shape__Area", "SHAPE_Area"]), 2)],
    ["Shape length", fmtNum(pickField(a, ["Shape__Length", "SHAPE_Length"]), 2)],
  ].filter(([, v]) => v !== undefined && v !== NA) as Array<[string, string]>;

  return (
    <KougaSectionFrame title={title} source={source} matchMethod={state.record.matchMethod}>
      <div className="rounded-lg border border-border bg-background">
        <dl className="divide-y divide-border text-[11.5px]">
          {rows.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">Match returned, but no labeled fields recognised.</div>
          )}
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <dt className="truncate text-muted-foreground">{k}</dt>
              <dd className="max-w-[60%] truncate text-right font-medium text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </KougaSectionFrame>
  );
}

