import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  X,
  ShieldCheck,
  MapPin,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  Share2,
  ChevronRight,
} from "lucide-react";
import { type OfficialFeatureSelection } from "@/components/map/MapCanvas";
import { ErfResearchDossier } from "./ErfResearchDossier";
import {
  buildOfficialParcelId,
  type NormalizedOfficialParcel,
} from "@/lib/parcels/officialParcelId";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { CSG_VIEWER_URL, KOUGA_PUBLIC_MAP_URL } from "@/lib/external-urls";
import { buildSgDocumentUrl, type SgDocumentResult } from "@/lib/research/sgDocument";
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
const WORKBENCH_NAV: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "research", label: "Sources" },
  { id: "listings", label: "Market" },
  { id: "reports", label: "Reports" },
  { id: "calculators", label: "Strategy" },
  { id: "notes", label: "Notes" },
];

const WORKBENCH_SECTIONS: Record<
  Tab,
  { title: string; subtitle: string; guidanceTitle: string; guidance: string }
> = {
  overview: {
    title: "Overview",
    subtitle: "Start with the first read, evidence readiness, and the recommended next step.",
    guidanceTitle: "Stoep AI First Read",
    guidance: "Use this first read to decide what evidence to check next.",
  },
  research: {
    title: "Official Sources",
    subtitle: "Check public records and source links tied to this erf.",
    guidanceTitle: "Source-check guidance",
    guidance:
      "Start with official and municipal records. Keep ownership, valuation and zoning marked needs evidence until a verified source supports them.",
  },
  listings: {
    title: "Market Evidence",
    subtitle: "Build comps, listing evidence, and manual market notes.",
    guidanceTitle: "Comp-building guidance",
    guidance:
      "Use listings as evidence to save and compare. Portal results may be nearby or unrelated, so verify each comp before it informs your view.",
  },
  reports: {
    title: "Report Vault",
    subtitle: "Add or upload Lightstone, WinDeed, SG, zoning, title deed, or other evidence.",
    guidanceTitle: "Evidence vault guidance",
    guidance:
      "Paid reports are optional confidence upgrades. Upload or attach evidence when you have it; the basic workflow still works without a purchase.",
  },
  calculators: {
    title: "Strategy Lab",
    subtitle: "Run the numbers before deciding whether to buy, hold, flip, or build.",
    guidanceTitle: "Number-check guidance",
    guidance:
      "Treat calculator outputs as estimates from your assumptions, not verified valuations or investment advice.",
  },
  notes: {
    title: "Notes",
    subtitle: "Capture your research, questions, and decision notes.",
    guidanceTitle: "Research notes guidance",
    guidance:
      "Keep open questions, evidence links and decision notes together so the erf stays reviewable later.",
  },
};

const ASK_STOEP_PROMPTS: { label: string; tab: Tab }[] = [
  { label: "What is risky?", tab: "research" },
  { label: "What should I verify?", tab: "research" },
  { label: "Run the numbers", tab: "calculators" },
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

type IdentityCheckStatus = "needs_verification" | "checked" | "looks_correct" | "uncertain";

const IDENTITY_STATUS_LABELS: Record<IdentityCheckStatus, string> = {
  needs_verification: "Needs verification",
  checked: "Checked by user",
  looks_correct: "Looks correct, user checked",
  uncertain: "Uncertain",
};

function identityStatusKey(parcelId: string) {
  return `erfstoep.identityCheck.${parcelId}`;
}

function readIdentityStatus(parcelId: string): IdentityCheckStatus {
  if (typeof window === "undefined") return "needs_verification";
  const value = window.localStorage.getItem(identityStatusKey(parcelId));
  return value === "checked" || value === "looks_correct" || value === "uncertain"
    ? value
    : "needs_verification";
}

function identityNextStep(status: IdentityCheckStatus) {
  if (status === "uncertain") {
    return {
      title: "Resolve official parcel identity before using market or strategy tools.",
      body: "Keep checking official source fields until you are comfortable this Workbench is tied to the correct erf.",
      action: "Review official identity",
      tab: "research" as Tab,
    };
  }
  if (status === "checked" || status === "looks_correct") {
    return {
      title: "Build market evidence next.",
      body: "Now compare listings and comps, while keeping ownership, valuation, zoning and sales marked needs evidence.",
      action: "Build market evidence",
      tab: "listings" as Tab,
    };
  }
  return {
    title: "Verify the official parcel identity first.",
    body: "Start with the official source so every market, strategy and report note is tied to the correct erf.",
    action: "Check official source",
    tab: "research" as Tab,
  };
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

function formatMapCoordinate(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(6) : "Not available";
}

function formatAreaM2(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return "Area not available";
  return `${Math.round(n).toLocaleString()} m2`;
}

function OfficialIdentityChecklist({
  parcel,
  sourceUrl,
  sgDoc,
  isCsg,
  status,
  onStatusChange,
}: {
  parcel: NormalizedOfficialParcel;
  sourceUrl: string;
  sgDoc: SgDocumentResult;
  isCsg: boolean;
  status: IdentityCheckStatus;
  onStatusChange: (status: IdentityCheckStatus) => void;
}) {
  const coordinates = parcel.coordinates
    ? `${parcel.coordinates.lat.toFixed(6)}, ${parcel.coordinates.lng.toFixed(6)}`
    : "Not available";
  const sourceQuality = isCsg
    ? parcel.lpi || parcel.parcelKey
      ? "Official CSG parcel feature"
      : "Official CSG portal context"
    : "Municipal GIS layer context";
  const identifierText = [
    `Normalized parcel id: ${parcel.id}`,
    `Erf number: ${parcel.erfNumber ?? "Not available"}`,
    `Portion: ${parcel.portion ?? "Not available"}`,
    `Township / area: ${parcel.suburbOrArea ?? parcel.town ?? "Not available"}`,
    `Municipality: ${parcel.municipality ?? "Not available"}`,
    `Province: ${parcel.province ?? "Not available"}`,
    `LPI: ${parcel.lpi ?? "Not available"}`,
    `Parcel key: ${parcel.parcelKey ?? "Not available"}`,
    `Coordinates: ${coordinates}`,
  ].join("\n");

  async function copyIdentifiers() {
    try {
      await navigator.clipboard.writeText(identifierText);
      toast.success("Parcel identifiers copied");
    } catch {
      toast.message("Copy failed. Select the identifiers manually.");
    }
  }

  const fields = [
    ["Erf number", parcel.erfNumber ?? "Not available"],
    ["Portion", parcel.portion ?? "Not available"],
    ["Township / area", parcel.suburbOrArea ?? parcel.town ?? "Not available"],
    ["Municipality", parcel.municipality ?? "Not available"],
    ["Province", parcel.province ?? "Not available"],
    ["LPI", parcel.lpi ?? "Not available"],
    ["Parcel key", parcel.parcelKey ?? "Not available"],
    ["Coordinates", coordinates],
    ["Source quality label", sourceQuality],
  ];

  return (
    <section
      id="official-identity-check"
      className="mb-5 rounded-[1.75rem] border border-[#FF6A00]/18 bg-[#fff8ec] p-5 text-[#0D1B2A] shadow-[0_20px_55px_-42px_rgba(13,27,42,0.48)]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
            StoepSteps / Step 1
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">
            Official parcel identity check
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/68">
            Compare these public parcel fields against the official source. Marking this step only
            records your research progress; it is not legal, surveying or ownership verification.
          </p>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0D1B2A] ring-1 ring-[#0D1B2A]/10">
          {IDENTITY_STATUS_LABELS[status]}
        </div>
      </div>

      <dl className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#0D1B2A]/8 bg-white/88 p-3">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-[#0D1B2A]">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#0D1B2A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#142941]"
        >
          {isCsg ? "Open CSG official source" : "Open Kouga source"}
        </a>
        {sgDoc.shown ? (
          <a
            href={sgDoc.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#0D1B2A]/10 bg-white px-4 py-2 text-sm font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fffaf2]"
          >
            Open SG document list
          </a>
        ) : (
          <span className="inline-flex min-h-11 items-center rounded-full border border-[#0D1B2A]/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0D1B2A]/58">
            SG document list not buildable from current fields
          </span>
        )}
        <button
          type="button"
          onClick={copyIdentifiers}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#0D1B2A]/10 bg-white px-4 py-2 text-sm font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fffaf2]"
        >
          Copy parcel identifiers
        </button>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onStatusChange("checked")}
          className="rounded-2xl border border-[#0D1B2A]/10 bg-white p-4 text-left text-sm font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fffaf2]"
        >
          I checked this source
          <span className="mt-1 block text-xs font-medium leading-5 text-[#0D1B2A]/62">
            Identity evidence started.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onStatusChange("looks_correct")}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-50 p-4 text-left text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
        >
          Identity looks correct
          <span className="mt-1 block text-xs font-medium leading-5 text-emerald-900/70">
            User checked, not legally verified.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onStatusChange("uncertain")}
          className="rounded-2xl border border-[#C75A31]/20 bg-[#fff1e9] p-4 text-left text-sm font-semibold text-[#7A2D12] transition hover:bg-[#ffe7d8]"
        >
          Identity uncertain
          <span className="mt-1 block text-xs font-medium leading-5 text-[#7A2D12]/72">
            Keep verification as the next step.
          </span>
        </button>
      </div>
    </section>
  );
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
const MINI_MAP_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";

function SelectedErfMiniMap({
  coordinates,
  title,
  onBackToMap,
}: {
  coordinates?: { lng: number; lat: number } | null;
  title: string;
  onBackToMap: () => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapFailed, setMapFailed] = useState<string | null>(null);
  const coordinateLng = coordinates?.lng;
  const coordinateLat = coordinates?.lat;
  const hasCoordinates =
    Number.isFinite(coordinateLng) &&
    Number.isFinite(coordinateLat) &&
    coordinateLng !== undefined &&
    coordinateLat !== undefined &&
    coordinateLng >= -180 &&
    coordinateLng <= 180 &&
    coordinateLat >= -90 &&
    coordinateLat <= 90;

  useEffect(() => {
    setMapLoaded(false);
    setMapFailed(null);

    if (
      !hasCoordinates ||
      !MAPBOX_TOKEN ||
      coordinateLng === undefined ||
      coordinateLat === undefined ||
      !mapContainerRef.current
    ) {
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const markerEl = document.createElement("div");
    markerEl.className =
      "h-5 w-5 rounded-full border-2 border-white bg-[#FF6A00] shadow-[0_0_0_8px_rgba(255,106,0,0.22),0_14px_30px_-12px_rgba(13,27,42,0.75)]";
    markerEl.setAttribute("aria-label", `Approximate selected erf marker for ${title}`);

    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setMapFailed("The interactive map took too long to load.");
    }, 9000);

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MINI_MAP_STYLE,
      center: [coordinateLng, coordinateLat],
      zoom: 17.25,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      cooperativeGestures: true,
    });

    mapRef.current = map;
    markerRef.current = new mapboxgl.Marker({ element: markerEl, anchor: "center" })
      .setLngLat([coordinateLng, coordinateLat])
      .addTo(map);

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    const handleLoad = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      setMapLoaded(true);
      setMapFailed(null);
      map.resize();
      map.easeTo({
        center: [coordinateLng, coordinateLat],
        zoom: 17.25,
        duration: 0,
      });
    };

    const handleError = () => {
      setMapFailed("The interactive map style could not load.");
    };

    map.once("load", handleLoad);
    map.on("error", handleError);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      markerRef.current?.remove();
      markerRef.current = null;
      map.off("error", handleError);
      map.remove();
      mapRef.current = null;
    };
  }, [coordinateLat, coordinateLng, hasCoordinates, title]);

  if (!hasCoordinates || !MAPBOX_TOKEN) {
    const reason = !hasCoordinates
      ? "No selected-erf coordinate is available for this public feature."
      : "The Mapbox token is missing, so the interactive Workbench map cannot render.";
    const titleText = !hasCoordinates ? "Map context unavailable" : "Interactive map unavailable";
    return (
      <div className="grid min-h-[13rem] place-items-center rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-5 text-center">
        <div className="max-w-xs">
          <div className="text-sm font-semibold text-[#0D1B2A]">{titleText}</div>
          <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">{reason}</p>
          {hasCoordinates && coordinateLat !== undefined && coordinateLng !== undefined && (
            <p className="mt-3 font-mono text-xs text-[#0D1B2A]/70">
              {coordinateLat.toFixed(6)}, {coordinateLng.toFixed(6)}
            </p>
          )}
          <p className="mt-3 text-[11px] leading-5 text-[#0D1B2A]/58">
            Approximate map context from selected parcel click. No parcel boundary or GIS precision
            is fabricated here.
          </p>
          <button
            type="button"
            onClick={onBackToMap}
            className="mt-4 inline-flex rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D1B2A]/90"
          >
            Back to full map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-64 min-h-[13rem] overflow-hidden rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]">
      <div
        ref={mapContainerRef}
        className="h-full w-full"
        aria-label={`Interactive selected-erf map for ${title}`}
      />
      <div className="pointer-events-none absolute inset-x-3 top-3 rounded-xl bg-white/86 px-3 py-2 text-[11px] font-semibold text-[#0D1B2A] shadow-[0_10px_24px_-18px_rgba(13,27,42,0.5)] backdrop-blur">
        Interactive selected-erf map
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-[#0D1B2A]/86 px-3 py-2 text-[10px] font-medium leading-4 text-white/86 backdrop-blur">
        Pan and zoom to view the erf in area context. Approximate selected-erf context from selected
        parcel point.
      </div>
      {!mapLoaded && !mapFailed && (
        <div className="absolute inset-0 grid place-items-center bg-[#fbf8f1]/82 text-center backdrop-blur-sm">
          <div className="rounded-2xl border border-[#0D1B2A]/10 bg-white px-4 py-3 text-xs font-semibold text-[#0D1B2A]">
            Loading interactive selected-erf map...
          </div>
        </div>
      )}
      {mapFailed && (
        <div className="absolute inset-0 grid place-items-center bg-white/94 p-5 text-center backdrop-blur">
          <div className="max-w-xs">
            <div className="text-sm font-semibold text-[#0D1B2A]">
              Interactive map could not render
            </div>
            <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">{mapFailed}</p>
            {coordinateLat !== undefined && coordinateLng !== undefined && (
              <p className="mt-3 font-mono text-xs text-[#0D1B2A]/70">
                {coordinateLat.toFixed(6)}, {coordinateLng.toFixed(6)}
              </p>
            )}
            <p className="mt-3 text-[11px] leading-5 text-[#0D1B2A]/58">
              Approximate map context from selected parcel click. No parcel boundary or GIS
              precision is fabricated here.
            </p>
            <button
              type="button"
              onClick={onBackToMap}
              className="mt-4 inline-flex rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D1B2A]/90"
            >
              Back to full map
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [identityStatus, setIdentityStatus] = useState<IdentityCheckStatus>("needs_verification");

  const [userAddr, setUserAddr] = useState<UserAddress | null>(null);
  useEffect(() => {
    setTab(readInitialTab());
    scrollRef.current?.scrollTo({ top: 0 });
  }, [parcelId]);
  useEffect(() => {
    setFetchedAt(new Date().toLocaleString());
  }, [parcelId]);
  useEffect(() => {
    setIdentityStatus(readIdentityStatus(parcelId));
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
  const sgDoc = useMemo(
    () =>
      buildSgDocumentUrl({
        lpi: csg?.lpi,
        parcelKey: csg?.parcelKey,
        erfNumber: csg?.erfNumber,
        portion: csg?.portion,
        province: csg?.province,
        majorRegion: csg?.majorRegion,
        minorRegion: csg?.minorRegion,
      }),
    [
      csg?.erfNumber,
      csg?.lpi,
      csg?.majorRegion,
      csg?.minorRegion,
      csg?.parcelKey,
      csg?.portion,
      csg?.province,
    ],
  );
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

  function selectWorkbenchTab(nextTab: Tab) {
    setTab(nextTab);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
  }

  function updateIdentityStatus(nextStatus: IdentityCheckStatus) {
    setIdentityStatus(nextStatus);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(identityStatusKey(parcelId), nextStatus);
    }
    const message =
      nextStatus === "checked"
        ? "Official identity evidence started"
        : nextStatus === "looks_correct"
          ? "Identity marked user checked"
          : "Identity marked uncertain";
    toast.success(message);
  }

  const activeSection = WORKBENCH_SECTIONS[tab];
  const isOverview = tab === "overview";
  const nextStep = identityNextStep(identityStatus);
  const identityReadiness = IDENTITY_STATUS_LABELS[identityStatus];

  return (
    <aside className="pointer-events-auto fixed inset-0 z-50 h-[100dvh] overflow-hidden bg-[#f7f1e7]/96 shadow-[0_28px_90px_rgba(13,27,42,0.28)] backdrop-blur-xl">
      <nav className="hidden absolute inset-y-0 left-0 z-40 w-64 border-r border-white/10 bg-[#0D1B2A] p-4 text-white md:flex md:flex-col">
        <div className="mb-8">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#FFB86B]">
            ErfStoep
          </div>
          <div className="mt-2 text-xl font-semibold tracking-tight">Workbench rail</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mb-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
        >
          <X className="h-4 w-4" />
          Back to full map
        </button>
        <div className="space-y-1">
          {WORKBENCH_NAV.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectWorkbenchTab(item.id)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition",
                  active
                    ? "bg-[#FF6A00] text-white shadow-[0_16px_36px_-18px_rgba(255,106,0,0.8)]"
                    : "text-white/72 hover:bg-white/10 hover:text-white",
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                {active && <ChevronRight className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
        <div className="mt-auto rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFB86B]">
            Paid reports
          </div>
          <p className="mt-2 text-sm leading-6 text-white/72">
            Optional confidence upgrades. You can continue without buying a report.
          </p>
        </div>
      </nav>

      <header className="sticky top-0 z-30 flex shrink-0 items-start justify-between gap-3 border-b border-[#0D1B2A]/10 bg-[#fbf8f1]/95 px-5 pb-3 pt-4 shadow-sm backdrop-blur max-md:pt-[calc(env(safe-area-inset-top)+0.75rem)] md:ml-64 md:px-7">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF6A00]">
            Erf Workbench
          </div>
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
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#142941] md:px-4"
            aria-label="Back to map"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Back to full map</span>
            <span className="sm:hidden">Map</span>
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="scrollbar-thin relative h-[calc(100dvh-5.25rem)] min-h-0 overflow-y-auto overscroll-contain pb-8 md:ml-64"
      >
        <section className="mx-4 mt-4 rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white/82 p-5 shadow-[0_18px_48px_-36px_rgba(13,27,42,0.48)] backdrop-blur md:mx-7 md:mt-7 md:p-6">
          <div className="inline-flex items-center rounded-full bg-[#fff3df] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9A4A09] ring-1 ring-[#FF8A33]/20">
            Workbench / {activeSection.title}
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#0D1B2A] md:text-3xl">
            {activeSection.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66 md:text-base md:leading-7">
            {activeSection.subtitle}
          </p>
        </section>

        <section className="mx-4 mt-4 overflow-hidden rounded-[2rem] border border-[#0D1B2A]/10 bg-white/94 shadow-[0_24px_70px_-38px_rgba(13,27,42,0.42)] backdrop-blur md:mx-7 md:mt-7">
          <div className="relative overflow-hidden rounded-none border-0 bg-white/94 p-6 text-[#0D1B2A] sm:p-7">
            {isOverview ? (
              <>
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white ring-1 ring-[#0D1B2A]/10">
                      <Sparkles className="h-3 w-3 text-[#FFB86B]" /> Stoep AI First Read
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff3df] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#9A4A09] ring-1 ring-[#FF8A33]/25">
                      Early read / needs evidence
                    </span>
                  </div>
                  <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6A00]">
                    Every erf. All the facts.
                  </p>
                  <h3 className="mt-5 text-[30px] font-semibold leading-[1.12] tracking-tight text-[#0D1B2A] sm:text-[38px]">
                    {resolved.displayTitle}
                  </h3>
                  <p className="mt-3 max-w-3xl text-base leading-8 text-[#0D1B2A]/78">
                    {panelFirstRead(normalizedParcel)}
                  </p>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#0D1B2A]/62">
                    Early consultant-style read only: useful for deciding what to inspect next, not
                    a verified ownership, valuation, zoning, sales, slope, buildability, or GIS
                    precision claim.
                  </p>
                </div>

                <div className="relative mt-6 rounded-[1.5rem] border border-[#FF6A00]/18 bg-[#fff8ec] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
                        Recommended next step
                      </div>
                      <p className="mt-1 text-xl font-semibold leading-snug text-[#0D1B2A]">
                        {nextStep.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/66">{nextStep.body}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => selectWorkbenchTab(nextStep.tab)}
                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_-8px_rgba(255,106,0,0.55)] transition hover:bg-[#FF7D1F]"
                      >
                        {nextStep.action}
                      </button>
                      <button
                        type="button"
                        onClick={() => selectWorkbenchTab("calculators")}
                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-[#0D1B2A]/10 bg-white px-5 py-3 text-sm font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fffaf2]"
                      >
                        Skip to Strategy Lab
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="relative rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#fbf8f1] p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
                  {activeSection.guidanceTitle}
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
                  {activeSection.title}
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/68">
                  {activeSection.guidance}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mx-4 mt-4 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/86 p-4 shadow-[0_18px_45px_-34px_rgba(13,27,42,0.45)] backdrop-blur md:mx-7">
          <div className="mb-4 grid gap-4 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#fbf8f1] p-4 lg:grid-cols-[minmax(18rem,1.15fr)_minmax(16rem,0.85fr)]">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
                Selected erf map
              </div>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#0D1B2A]">
                {resolved.displayTitle}
              </h3>
              <p className="mt-1 text-sm leading-6 text-[#0D1B2A]/66">
                Read-only map context centered on the selected erf area. Coordinates are approximate
                parcel context unless confirmed by an official source.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-[#0D1B2A]/70">
                {normalizedParcel.erfNumber && (
                  <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-[#0D1B2A]/8">
                    Erf {normalizedParcel.erfNumber}
                  </span>
                )}
                {normalizedParcel.suburbOrArea && (
                  <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-[#0D1B2A]/8">
                    {normalizedParcel.suburbOrArea}
                  </span>
                )}
                <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-[#0D1B2A]/8">
                  {formatAreaM2(csg?.geometryArea ?? kouga?.shapeArea)}
                </span>
              </div>
              <div className="mt-4 rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                  Coordinates
                </div>
                <dl className="mt-2 space-y-1 text-xs text-[#0D1B2A]/70">
                  <div className="flex justify-between gap-3">
                    <dt>Lat</dt>
                    <dd className="font-mono">
                      {formatMapCoordinate(normalizedParcel.coordinates?.lat)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Lng</dt>
                    <dd className="font-mono">
                      {formatMapCoordinate(normalizedParcel.coordinates?.lng)}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#142941]"
                >
                  Back to full map
                </button>
              </div>
            </div>
            <SelectedErfMiniMap
              coordinates={normalizedParcel.coordinates}
              title={resolved.displayTitle}
              onBackToMap={onClose}
            />
          </div>

          {isOverview && (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
                  Ask Stoep
                </div>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
                  What do you want to understand first?
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {ASK_STOEP_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => selectWorkbenchTab(prompt.tab)}
                    className="rounded-full border border-[#0D1B2A]/10 bg-[#fff8ec] px-3 py-2 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/40 hover:bg-[#fff1dc]"
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {isOverview && (
          <section className="mx-4 mt-4 grid gap-3 md:mx-7 md:grid-cols-4">
            {[
              ["Identity", identityReadiness],
              ["Ownership", "Needs evidence"],
              ["Market value", "Needs evidence"],
              ["Strategy", "Not chosen"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/88 p-4 shadow-[0_14px_34px_-30px_rgba(13,27,42,0.42)]"
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                  {label}
                </div>
                <p className="mt-2 text-sm font-semibold leading-5 text-[#0D1B2A]">{value}</p>
              </div>
            ))}
          </section>
        )}

        {isOverview && (
          <section className="mx-4 mt-4 grid gap-3 md:mx-7 md:grid-cols-4">
            {[
              ["Verify official records", "Open CSG, SG and municipal sources.", "research"],
              ["Build market evidence", "Find listings and comps for this erf.", "listings"],
              [
                "Run Strategy Lab",
                "Test flip, build, hold and max offer assumptions.",
                "calculators",
              ],
              ["Add/upload evidence", "Coming soon", "coming-soon"],
            ].map(([label, value, nextTab]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (nextTab !== "coming-soon") selectWorkbenchTab(nextTab as Tab);
                }}
                disabled={nextTab === "coming-soon"}
                className="group rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white/92 p-4 text-left shadow-[0_14px_34px_-30px_rgba(13,27,42,0.42)] transition hover:-translate-y-0.5 hover:border-[#FF6A00]/35 hover:shadow-[0_24px_55px_-34px_rgba(13,27,42,0.55)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:border-[#0D1B2A]/10 disabled:hover:shadow-[0_14px_34px_-30px_rgba(13,27,42,0.42)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#0D1B2A]">{label}</div>
                    <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/62">{value}</p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 text-[#FF6A00] transition group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </section>
        )}

        <div ref={dossierContentRef} className="px-5 pt-4">
          {tab === "overview" && null}

          {tab === "research" && (
            <>
              <OfficialIdentityChecklist
                parcel={normalizedParcel}
                sourceUrl={sourceUrl}
                sgDoc={sgDoc}
                isCsg={isCsg}
                status={identityStatus}
                onStatusChange={updateIdentityStatus}
              />
              <ErfResearchDossier parcel={normalizedParcel} view="research" />
            </>
          )}
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
