import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  X,
  ShieldCheck,
  FileText,
  MapPin,
  Sparkles,
  Link2,
  Tag as TagIcon,
  NotebookPen,
  Calculator,
  Bookmark,
  BookmarkCheck,
  Share2,
  ChevronRight,
} from "lucide-react";
import type { OfficialFeatureSelection } from "@/components/map/MapCanvas";
import { ErfResearchDossier } from "./ErfResearchDossier";
import {
  buildOfficialParcelId,
  type NormalizedOfficialParcel,
} from "@/lib/parcels/officialParcelId";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { CSG_VIEWER_URL, KOUGA_PUBLIC_MAP_URL } from "@/lib/external-urls";
import { toast } from "sonner";

interface Props {
  selection: OfficialFeatureSelection;
  onClose: () => void;
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
const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Sparkles className="h-3.5 w-3.5" /> },
  {
    id: "research",
    label: "Sources",
    icon: <Link2 className="h-3.5 w-3.5" />,
  },
  { id: "listings", label: "Listings & Comps", icon: <TagIcon className="h-3.5 w-3.5" /> },
  { id: "reports", label: "Reports", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "notes", label: "Notes", icon: <NotebookPen className="h-3.5 w-3.5" /> },
  { id: "calculators", label: "Calc", icon: <Calculator className="h-3.5 w-3.5" /> },
];

function readInitialTab(): Tab {
  if (typeof window === "undefined") return "overview";
  const value = new URLSearchParams(window.location.search).get("tab");
  return value === "calc" || value === "calculators" ? "calculators" : "overview";
}

function panelIdentityConfidence(parcel: NormalizedOfficialParcel): string {
  if (parcel.lpi || parcel.parcelKey) return "Medium confidence";
  if (parcel.erfNumber && (parcel.municipality || parcel.province)) return "Needs source check";
  return "Needs evidence";
}

function panelNextBestStep(parcel: NormalizedOfficialParcel): string {
  if (parcel.lpi || parcel.parcelKey) return "Confirm Official Identity";
  if (parcel.erfNumber) return "Check official CSG / SG sources";
  return "Save the erf and gather evidence";
}

function panelFirstRead(parcel: NormalizedOfficialParcel): string {
  const identity = [
    parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : "this official erf",
    parcel.portion != null && String(parcel.portion) !== "0" ? `Portion ${parcel.portion}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const location = [parcel.suburbOrArea, parcel.municipality, parcel.province]
    .filter(Boolean)
    .join(", ");

  return `${identity}${location ? ` in ${location}` : ""} has enough public context for an early read. Ownership, valuation, zoning, sales history and GIS precision still need verified evidence.`;
}

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
    const suburb = ctx.find(
      (c) => c.id.startsWith("neighborhood") || c.id.startsWith("locality"),
    )?.text;
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

type AddressSource =
  | "Official Address"
  | "User Entered"
  | "Approximate Address"
  | "Nearest Road Only"
  | "Erf Only";

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
      displaySubtitle: [erfLabel, user.suburb ?? minorRegion, "User Entered"]
        .filter(Boolean)
        .join(" · "),
      approximateAddress: street,
      streetNumber: user.streetNumber,
      streetName: user.streetName,
      addressConfidence: "User Entered",
      addressSource: "User Entered",
      researchQuery: [
        street,
        erfLabel,
        user.suburb ?? minorRegion,
        user.town ?? majorRegion,
        user.province ?? province,
        "South Africa",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  // 2. Mapbox helper context only — never promote a guessed full address into the title.
  //    The official identity is the erf. Treat any street name as "nearest road" hint only.

  // 3. Mapbox returned only a road name — never promote to title
  const road = geo?.nearestRoad ?? geo?.streetName;
  const regionSubtitle = [minorRegion, majorRegion, province ?? "Eastern Cape"]
    .filter(Boolean)
    .join(" · ");
  if (road) {
    return {
      displayTitle: erfLabel,
      displaySubtitle: regionSubtitle,
      nearestRoad: road,
      addressConfidence: "Nearest Road Only",
      addressSource: "Nearest Road Only",
      researchQuery: [
        erfLabel,
        minorRegion,
        majorRegion,
        province ?? "Eastern Cape",
        road,
        "South Africa",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  // 4. Coordinates + region only — erf-first identity
  return {
    displayTitle: erfLabel,
    displaySubtitle: regionSubtitle,
    addressConfidence: "Erf Only",
    addressSource: "Erf Only",
    researchQuery: [erfLabel, minorRegion, majorRegion, province ?? "Eastern Cape", "South Africa"]
      .filter(Boolean)
      .join(" "),
  };
}

function userAddrKey(parcelId: string) {
  return `pa.userAddress.${parcelId}`;
}
function readUserAddress(parcelId: string): UserAddress | null {
  try {
    const v = window.localStorage.getItem(userAddrKey(parcelId));
    return v ? (JSON.parse(v) as UserAddress) : null;
  } catch {
    return null;
  }
}
export function OfficialParcelPanel({ selection, onClose }: Props) {
  const { user } = useAuth();
  const isCsg = selection.layer === "csg-parcels";
  const csg = useMemo(
    () => (isCsg ? normalizeCsg(selection.properties) : null),
    [selection.properties, isCsg],
  );
  const kouga = useMemo(
    () => (!isCsg ? normalizeKouga(selection.properties) : null),
    [selection.properties, isCsg],
  );
  const [tab, setTab] = useState<Tab>(() => readInitialTab());
  const [geo, setGeo] = useState<Geo | null>(null);
  const [saved, setSaved] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dossierContentRef = useRef<HTMLDivElement | null>(null);

  const [lng, lat] = selection.lngLat;
  const objectId =
    selection.properties.OBJECTID ?? selection.properties.ObjectID ?? selection.properties.objectid;
  const parcelId = buildOfficialParcelId({
    source: isCsg ? "csg" : "kouga",
    layer: selection.layer,
    objectId: objectId as string | number | null | undefined,
    lpi: csg?.lpi,
    parcelKey: csg?.parcelKey,
    erfNumber: csg?.erfNumber,
    portion: csg?.portion ?? 0,
    municipality: "Kouga Local Municipality",
    province: csg?.province ?? "Eastern Cape",
    lng: csg?.longitude ?? lng,
    lat: csg?.latitude ?? lat,
  });
  const [fetchedAt, setFetchedAt] = useState(() => new Date().toLocaleString());

  const [userAddr, setUserAddr] = useState<UserAddress | null>(null);
  useEffect(() => {
    setTab(readInitialTab());
    scrollRef.current?.scrollTo({ top: 0 });
  }, [parcelId]);
  useEffect(() => {
    setFetchedAt(new Date().toLocaleString());
  }, [parcelId]);
  useEffect(() => {
    const a = readUserAddress(parcelId);
    setUserAddr(a);
  }, [parcelId]);

  useEffect(() => {
    let cancelled = false;
    setGeo(null);
    reverseGeocode(csg?.longitude ?? lng, csg?.latitude ?? lat).then((g) => {
      if (!cancelled) setGeo(g);
    });
    return () => {
      cancelled = true;
    };
  }, [parcelId, lng, lat, csg?.longitude, csg?.latitude]);

  useEffect(() => {
    if (!user) {
      setSaved(false);
      return;
    }
    supabase
      .from("saved_properties")
      .select("id")
      .eq("user_id", user.id)
      .eq("parcel_id", parcelId)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [user, parcelId]);

  const resolved = useMemo(
    () =>
      resolveOfficialParcelLocation({
        erfNumber: csg?.erfNumber,
        portion: csg?.portion,
        minorRegion: csg?.minorRegion,
        majorRegion: csg?.majorRegion,
        province: csg?.province ?? "Eastern Cape",
        latitude: csg?.latitude ?? lat,
        longitude: csg?.longitude ?? lng,
        geo,
        user: userAddr,
      }),
    [csg, geo, userAddr, lat, lng],
  );

  const sourceUrl = isCsg ? CSG_VIEWER_URL : KOUGA_PUBLIC_MAP_URL;
  const normalizedParcel: NormalizedOfficialParcel = useMemo(() => {
    const coords = { lng: csg?.longitude ?? lng, lat: csg?.latitude ?? lat };
    const knownFields: NormalizedOfficialParcel["knownFields"] = [];
    const pushKnown = (label: string, value: unknown, source: string) => {
      if (value === null || value === undefined || value === "") return;
      knownFields.push({ label, value: String(value), source });
    };

    if (csg) {
      pushKnown("Erf number", csg.erfNumber, "Chief Surveyor-General");
      pushKnown("Portion", csg.portion, "Chief Surveyor-General");
      pushKnown("LPI / ID", csg.lpi, "Chief Surveyor-General");
      pushKnown("Parcel key", csg.parcelKey, "Chief Surveyor-General");
      pushKnown("Province", csg.province, "Chief Surveyor-General");
      pushKnown("Major region", csg.majorRegion, "Chief Surveyor-General");
      pushKnown("Minor region", csg.minorRegion, "Chief Surveyor-General");
      pushKnown("Geometry area", csg.geometryArea, "Chief Surveyor-General");
    }

    if (kouga) {
      pushKnown("Zoning code", kouga.zoningCode, "Kouga Municipality GIS");
      pushKnown("Zoning type", kouga.zoningType, "Kouga Municipality GIS");
      pushKnown("Zoning description", kouga.zoningDescription, "Kouga Municipality GIS");
      pushKnown("Shape area", kouga.shapeArea, "Kouga Municipality GIS");
    }

    pushKnown("Longitude", coords.lng.toFixed(6), "Map click");
    pushKnown("Latitude", coords.lat.toFixed(6), "Map click");

    return {
      id: parcelId,
      source: isCsg ? "csg" : "kouga",
      sourceLabel: isCsg ? "Chief Surveyor-General" : "Kouga Municipality GIS",
      layer: selection.layer,
      erfNumber: csg?.erfNumber ?? null,
      portion: csg?.portion ?? null,
      lpi: csg?.lpi ?? null,
      parcelKey: csg?.parcelKey ?? null,
      objectId: objectId as string | number | null | undefined,
      municipality: "Kouga Local Municipality",
      province: csg?.province ?? userAddr?.province ?? "Eastern Cape",
      suburbOrArea: userAddr?.suburb ?? csg?.minorRegion ?? resolved.displaySubtitle ?? null,
      town: userAddr?.town ?? csg?.majorRegion ?? null,
      coordinates: coords,
      knownFields,
      missingFields: [
        "Ownership",
        "Valuation",
        "Transfers",
        "Rates and taxes",
        "Paid provider reports",
      ],
      rawProperties: selection.properties,
    };
  }, [
    csg,
    kouga,
    lat,
    lng,
    objectId,
    parcelId,
    resolved.displaySubtitle,
    selection.layer,
    selection.properties,
    isCsg,
    userAddr,
  ]);

  async function toggleSave() {
    if (!user) {
      toast.message("Sign in to save properties");
      return;
    }
    if (saved) {
      await supabase
        .from("saved_properties")
        .delete()
        .eq("user_id", user.id)
        .eq("parcel_id", parcelId);
      setSaved(false);
      toast.success("Removed from saved");
    } else {
      const userData = {
        normalizedParcelId: parcelId,
        provider: csg ? "Chief Surveyor-General" : "Kouga Municipality GIS",
        sourceLayer: selection.layer,
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
        municipality: "Kouga Local Municipality",
        province: csg?.province ?? null,
        town: csg?.majorRegion ?? null,
        majorRegion: csg?.majorRegion ?? null,
        minorRegion: csg?.minorRegion ?? null,
        geometryArea: csg?.geometryArea ?? null,
        zoningCode: (kouga?.zoningCode as string | number | null) ?? null,
        zoningType: (kouga?.zoningType as string | number | null) ?? null,
        lng: csg?.longitude ?? lng,
        lat: csg?.latitude ?? lat,
        longitude: csg?.longitude ?? lng,
        latitude: csg?.latitude ?? lat,
        addressSource: resolved.addressSource,
        addressConfidence: resolved.addressConfidence,
        researchQuery: resolved.researchQuery,
        userEntered: userAddr ?? null,
        fetchedAt: new Date().toISOString(),
      };
      const { error } = await supabase.from("saved_properties").insert({
        user_id: user.id,
        parcel_id: parcelId,
        external_links: [
          {
            label: isCsg ? "CSG Viewer" : "Kouga Mapping Portal",
            url: sourceUrl,
            category: "official",
          },
        ],
        user_data: userData as unknown as Record<string, unknown> as never,
      });
      if (error) toast.error(error.message);
      else {
        setSaved(true);
        toast.success("Saved to your properties");
      }
    }
  }

  function openFullDossier() {
    setTab("overview");
    requestAnimationFrame(() => {
      dossierContentRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  return (
    <aside className="pointer-events-auto fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-3xl border border-border bg-card shadow-panel max-md:inset-y-0 max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:w-full max-md:rounded-none md:left-auto md:right-0 md:top-0 md:bottom-0 md:h-screen md:max-h-screen md:w-[min(54vw,980px)] md:min-w-[680px] md:rounded-l-3xl md:rounded-tr-none md:border-l xl:max-w-[1040px]">
      <header className="sticky top-0 z-30 flex shrink-0 items-start justify-between gap-3 border-b border-border bg-card/95 px-5 pb-3 pt-4 shadow-sm backdrop-blur max-md:pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" /> Official Public Data
            </span>
            <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-foreground">
              {isCsg ? "CSG" : "Kouga"}
            </span>
          </div>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">
            {resolved.displayTitle}
          </h2>
          {resolved.displaySubtitle && (
            <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> {resolved.displaySubtitle}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={toggleSave}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-stone-900 shadow-sm hover:bg-amber-100 md:min-h-0 md:border-0 md:bg-transparent md:p-2 md:text-foreground md:shadow-none md:hover:bg-muted"
            title={saved ? "Saved" : "Save property"}
            aria-label={saved ? "Saved erf" : "Save erf"}
          >
            {saved ? (
              <BookmarkCheck className="h-4 w-4 text-emerald-700 md:text-primary" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
            <span className="md:hidden">{saved ? "Saved" : "Save erf"}</span>
          </button>
          <button className="hidden rounded-full p-2 hover:bg-muted md:inline-flex" title="Share">
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-stone-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-stone-800 md:min-h-0 md:p-2"
            aria-label="Back to map"
          >
            <X className="h-4 w-4" />
            <span className="md:hidden">Map</span>
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8"
      >
        <section className="mx-4 mt-5 overflow-hidden rounded-[2rem] border border-[#eadfd1] bg-[#fff8ec] shadow-[0_24px_60px_rgba(45,34,18,0.16)]">
          <div className="ug-glass-dark ug-glass-float relative overflow-hidden rounded-none border-0 bg-[radial-gradient(circle_at_12%_0%,rgba(255,106,0,0.34),transparent_34%),linear-gradient(135deg,#06152A_0%,#0D1B2A_54%,#18324B_100%)] p-5 text-white sm:p-6">
            <div className="absolute right-[-4rem] top-[-5rem] h-44 w-44 rounded-full bg-[#ff6a00]/25 blur-3xl" />
            <div className="relative grid gap-5 lg:grid-cols-[1fr_210px] lg:items-end">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ug-badge bg-white/12 text-white ring-1 ring-white/15">
                    <Sparkles className="h-3.5 w-3.5 text-[#ffb86b]" /> Stoep AI First Read
                  </span>
                  <span className="ug-badge ug-badge--pending border-[#ff8a33]/40 bg-[#ff6a00]/15 text-[#ffd2ad]">
                    Early read
                  </span>
                  <span className="ug-badge border-white/15 bg-white/10 text-white/80">
                    Needs evidence
                  </span>
                </div>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffb86b]">
                  ErfStoep command dashboard
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  What is this property?
                </h3>
                <p className="mt-3 max-w-2xl text-base leading-7 text-white/82">
                  {panelFirstRead(normalizedParcel)}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/12 bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffd2ad]">
                  Early Stoep Score
                </div>
                <div className="mt-2 text-4xl font-semibold tracking-tight text-white">--</div>
                <p className="mt-2 text-sm leading-5 text-white/74">
                  Early / estimated only. Not a valuation or recommendation.
                </p>
              </div>
            </div>

            <div className="relative mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="rounded-[1.25rem] border border-white/12 bg-white/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffd2ad]">
                  <span>Next best step</span>
                  <span>Evidence status: {panelIdentityConfidence(normalizedParcel)}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-white">
                  {panelNextBestStep(normalizedParcel)}
                </p>
                <p className="mt-1 text-sm leading-5 text-white/72">
                  Optional confidence upgrade available later. You can continue without buying a report.
                </p>
              </div>
              <button
                type="button"
                onClick={openFullDossier}
                className="ug-accent-glow inline-flex min-h-11 items-center justify-center rounded-full bg-[#ff6a00] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff7d1f]"
              >
                Open full Erf Research Dossier
              </button>
            </div>
          </div>

          <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="ug-metric ug-metric--accent p-4">
              <span className="ug-metric__label">Identity found</span>
              <span className="ug-metric__value text-[1.35rem]">
                {normalizedParcel.erfNumber != null ? "Yes" : "Partial"}
              </span>
              <span className="ug-metric__delta">Verify official source</span>
            </div>
            <div className="ug-metric p-4">
              <span className="ug-metric__label">Evidence needed</span>
              <span className="ug-metric__value text-[1.35rem]">Required</span>
              <span className="ug-metric__delta">Ownership, value, zoning</span>
            </div>
            <div className="ug-metric p-4">
              <span className="ug-metric__label">Strategy not chosen</span>
              <span className="ug-metric__value text-[1.35rem]">Open</span>
              <span className="ug-metric__delta">Run Strategy Lab next</span>
            </div>
            <div className="ug-metric p-4">
              <span className="ug-metric__label">Reports optional</span>
              <span className="ug-metric__value text-[1.35rem]">Upgrade</span>
              <span className="ug-metric__delta">Paid reports improve confidence</span>
            </div>
          </div>
        </section>

        <div className="sticky top-0 z-10 mx-4 mt-3 rounded-[1.25rem] border border-[#eadfd1] bg-white/85 shadow-sm backdrop-blur">
          <div className="relative">
            <div className="flex items-center justify-between px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#7b6a58] sm:hidden">
              <span>Dossier tabs</span>
              <span className="inline-flex items-center gap-1">
                Swipe for more <ChevronRight className="h-3 w-3" />
              </span>
            </div>
            <div className="scrollbar-thin flex gap-1 overflow-x-auto px-2 sm:px-3">
              {TABS.map(({ id, label, icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setTab(id);
                      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
                    }}
                    className={cn(
                      "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2.5 text-[12px] font-semibold transition",
                      active
                        ? "bg-[#0d1b2a] text-white shadow-sm"
                        : "text-[#7b6a58] hover:bg-[#fff4df] hover:text-[#0d1b2a]",
                    )}
                  >
                    <span
                      className={cn("sm:hidden", active ? "text-primary" : "text-muted-foreground")}
                    >
                      {icon}
                    </span>
                    {label}
                    {active && (
                      <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/85 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/85 to-transparent" />
          </div>
        </div>

        <div ref={dossierContentRef} className="px-5 pt-4">
          {tab === "overview" && (
            <ErfResearchDossier parcel={normalizedParcel} onSelectView={(view) => setTab(view)} />
          )}

          {tab === "research" && <ErfResearchDossier parcel={normalizedParcel} view="research" />}
          {tab === "listings" && <ErfResearchDossier parcel={normalizedParcel} view="listings" />}
          {tab === "reports" && <ErfResearchDossier parcel={normalizedParcel} view="reports" />}
          {tab === "notes" && <ErfResearchDossier parcel={normalizedParcel} view="notes" />}
          {tab === "calculators" && (
            <ErfResearchDossier parcel={normalizedParcel} view="calculators" />
          )}
        </div>
      </div>
    </aside>
  );
}
