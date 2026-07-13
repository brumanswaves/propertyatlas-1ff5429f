import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Building2,
  ChevronRight,
  Droplets,
  ExternalLink,
  Hammer,
  Home,
  Loader2,
  MapPin,
  Phone,
  PlugZap,
  Search,
  ShieldCheck,
  Star,
  Wifi,
} from "lucide-react";

import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { cn } from "@/lib/utils";

type ProviderCategory = {
  id: string;
  label: string;
  query: string;
  reason: string;
};

type ProviderGroup = {
  id: string;
  label: string;
  description: string;
  icon: typeof Hammer;
  categories: ProviderCategory[];
};

type GooglePlaceLike = {
  id?: string;
  displayName?: string | { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  websiteURI?: string;
  googleMapsURI?: string;
  businessStatus?: string;
  location?: { lat?: number | (() => number); lng?: number | (() => number) };
};

type GooglePlaceSearchClass = {
  searchByText: (request: Record<string, unknown>) => Promise<{ places?: GooglePlaceLike[] }>;
};

type LocalProvider = {
  id: string;
  name: string;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  phone: string | null;
  websiteUrl: string | null;
  mapsUrl: string;
  distanceKm: number | null;
  source: "google";
};

type ProviderState = Record<string, LocalProvider[]>;
type LoadingState = Record<string, boolean>;
type ErrorState = Record<string, string | null>;

const PROVIDER_GROUPS: ProviderGroup[] = [
  {
    id: "plan-build",
    label: "Plan and Build",
    description: "Professionals who can help confirm, design, price, approve, and build.",
    icon: Hammer,
    categories: [
      {
        id: "land-surveyors",
        label: "Land surveyors",
        query: "professional land surveyor",
        reason: "Useful for physical boundary confirmation, beacons, subdivisions, and survey work.",
      },
      {
        id: "architects",
        label: "Architects and draughtspersons",
        query: "architect draughtsperson residential",
        reason: "Useful for concept plans, municipal submissions, and early buildability thinking.",
      },
      {
        id: "builders",
        label: "Builders and contractors",
        query: "residential builder building contractor",
        reason: "Useful for feasibility pricing, construction planning, renovations, and new builds.",
      },
    ],
  },
  {
    id: "protect-maintain",
    label: "Protect and Maintain",
    description: "Local services for insurance, inspections, repairs, security, and upkeep.",
    icon: ShieldCheck,
    categories: [
      {
        id: "insurance",
        label: "Insurance brokers",
        query: "property insurance broker",
        reason: "Useful for building, contents, liability, vacant-land, and construction cover questions.",
      },
      {
        id: "security",
        label: "Security companies",
        query: "home security armed response",
        reason: "Useful for alarms, monitoring, access control, cameras, and local response coverage.",
      },
      {
        id: "maintenance",
        label: "Electricians and plumbers",
        query: "electrician plumber property maintenance",
        reason: "Useful for compliance checks, repairs, installations, and maintenance planning.",
      },
    ],
  },
  {
    id: "connect-property",
    label: "Connect the Property",
    description: "Internet, television, water, electricity, and practical service connections.",
    icon: PlugZap,
    categories: [
      {
        id: "internet",
        label: "Internet and fibre",
        query: "fibre internet service provider",
        reason: "Useful for checking local fibre, fixed wireless, LTE, installation, and service options.",
      },
      {
        id: "tv",
        label: "TV and DStv installers",
        query: "DStv TV satellite installer",
        reason: "Useful for satellite, television, cabling, mounting, and home entertainment setup.",
      },
      {
        id: "water-utilities",
        label: "Water and utility specialists",
        query: "water tanks borehole pump solar utility installer",
        reason: "Useful for tanks, pumps, boreholes, backup water, solar, and utility resilience.",
      },
    ],
  },
  {
    id: "buy-sell-manage",
    label: "Buy, Sell or Manage",
    description: "Professionals who can help transact, inspect, transfer, let, or manage the property.",
    icon: Home,
    categories: [
      {
        id: "agents",
        label: "Estate agents",
        query: "estate agent property sales",
        reason: "Useful for local pricing context, listings, buyer demand, selling, and acquisition support.",
      },
      {
        id: "conveyancers",
        label: "Conveyancers and property attorneys",
        query: "conveyancing attorney property transfer",
        reason: "Useful for offers, transfer, title, servitudes, contracts, and conveyancing questions.",
      },
      {
        id: "inspectors-managers",
        label: "Inspectors and property managers",
        query: "property inspector rental property manager",
        reason: "Useful for condition checks, snag lists, rentals, tenant management, and ongoing oversight.",
      },
    ],
  },
];

let googleMapsLoader: Promise<void> | null = null;

function googleMapsWindow() {
  return window as Window & {
    google?: {
      maps?: {
        importLibrary?: (name: string) => Promise<{ Place?: GooglePlaceSearchClass }>;
      };
    };
  };
}

function loadGoogleMapsPlaces(apiKey: string): Promise<void> {
  const existing = googleMapsWindow().google?.maps?.importLibrary;
  if (existing) return Promise.resolve();
  if (googleMapsLoader) return googleMapsLoader;

  googleMapsLoader = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-easy-erf-google-places="true"]',
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Google Maps could not load")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.dataset.easyErfGooglePlaces = "true";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=places`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps could not load"));
    document.head.appendChild(script);
  });

  return googleMapsLoader;
}

function placeName(value: GooglePlaceLike["displayName"]): string {
  if (typeof value === "string") return value;
  if (value && typeof value.text === "string") return value.text;
  return "Local provider";
}

function coordinateValue(value: number | (() => number) | undefined): number | null {
  const parsed = typeof value === "function" ? value() : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function distanceKm(
  origin: NormalizedOfficialParcel["coordinates"],
  destination?: GooglePlaceLike["location"],
): number | null {
  if (!origin || !destination) return null;
  const lat = coordinateValue(destination.lat);
  const lng = coordinateValue(destination.lng);
  if (lat == null || lng == null) return null;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(lat - origin.lat);
  const deltaLng = toRadians(lng - origin.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(origin.lat)) *
      Math.cos(toRadians(lat)) *
      Math.sin(deltaLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function locationLabel(parcel: NormalizedOfficialParcel): string {
  return [parcel.suburbOrArea, parcel.town, parcel.municipality, parcel.province, "South Africa"]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join(", ");
}

function mapsSearchUrl(category: ProviderCategory, parcel: NormalizedOfficialParcel): string {
  const query = `${category.query} near ${locationLabel(parcel)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function placeMapsUrl(place: GooglePlaceLike, category: ProviderCategory, parcel: NormalizedOfficialParcel) {
  if (place.googleMapsURI) return place.googleMapsURI;
  const query = [placeName(place.displayName), place.formattedAddress, locationLabel(parcel)]
    .filter(Boolean)
    .join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query || category.query,
  )}`;
}

function savedProviderStorageKey(parcelId: string) {
  return `easyerf.local-property-team.saved.${parcelId}`;
}

function readSavedProviderIds(parcelId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(savedProviderStorageKey(parcelId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeSavedProviderIds(parcelId: string, ids: string[]) {
  try {
    window.localStorage.setItem(savedProviderStorageKey(parcelId), JSON.stringify(ids));
  } catch {
    // Saving a provider is optional. The feature remains usable when storage is unavailable.
  }
}

function looksLikeVacantLand(parcel: NormalizedOfficialParcel): boolean {
  const sourceText = [
    ...parcel.knownFields.flatMap((field) => [field.label, field.value, field.source]),
    ...Object.entries(parcel.rawProperties ?? {}).flatMap(([key, value]) => [key, String(value)]),
  ]
    .join(" ")
    .toLowerCase();
  return /vacant|undeveloped|empty stand|residential land|plot|stand erf|land only/.test(sourceText);
}

async function searchCategory(
  category: ProviderCategory,
  parcel: NormalizedOfficialParcel,
): Promise<LocalProvider[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!apiKey) throw new Error("Google Places is not configured");

  await loadGoogleMapsPlaces(apiKey);
  const importLibrary = googleMapsWindow().google?.maps?.importLibrary;
  if (!importLibrary) throw new Error("Google Places is unavailable");
  const library = await importLibrary("places");
  const Place = library.Place;
  if (!Place?.searchByText) throw new Error("Google Places text search is unavailable");

  const request: Record<string, unknown> = {
    textQuery: `${category.query} near ${locationLabel(parcel)}`,
    fields: [
      "id",
      "displayName",
      "formattedAddress",
      "location",
      "rating",
      "userRatingCount",
      "nationalPhoneNumber",
      "websiteURI",
      "googleMapsURI",
      "businessStatus",
    ],
    language: "en",
    region: "za",
    maxResultCount: 3,
  };
  if (parcel.coordinates) request.locationBias = parcel.coordinates;

  const { places = [] } = await Place.searchByText(request);
  return places
    .filter((place) => place.businessStatus !== "CLOSED_PERMANENTLY")
    .slice(0, 3)
    .map((place, index) => ({
      id: place.id ?? `${category.id}-${index}-${placeName(place.displayName)}`,
      name: placeName(place.displayName),
      address: place.formattedAddress ?? null,
      rating: typeof place.rating === "number" ? place.rating : null,
      reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
      phone: place.nationalPhoneNumber ?? null,
      websiteUrl: place.websiteURI ?? null,
      mapsUrl: placeMapsUrl(place, category, parcel),
      distanceKm: distanceKm(parcel.coordinates, place.location),
      source: "google" as const,
    }));
}

function GroupIcon({ group }: { group: ProviderGroup }) {
  const Icon = group.icon;
  return <Icon className="h-4 w-4" />;
}

function CategoryIcon({ categoryId }: { categoryId: string }) {
  if (categoryId === "internet") return <Wifi className="h-4 w-4" />;
  if (categoryId === "water-utilities") return <Droplets className="h-4 w-4" />;
  if (categoryId === "agents") return <Building2 className="h-4 w-4" />;
  return <Search className="h-4 w-4" />;
}

function ProviderCard({
  provider,
  saved,
  onToggleSaved,
}: {
  provider: LocalProvider;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  return (
    <article className="rounded-2xl border border-[#D9E6F2] bg-white p-4 shadow-[0_14px_34px_-30px_rgba(13,27,42,0.65)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#64748B]">
            Google place result
          </div>
          <h5 className="mt-1 text-sm font-semibold leading-5 text-[#0D1B2A]">{provider.name}</h5>
        </div>
        <button
          type="button"
          onClick={onToggleSaved}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#0D1B2A]/10 bg-[#F7FBFF] text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fff8ec]"
          aria-label={saved ? `Remove ${provider.name} from saved providers` : `Save ${provider.name}`}
          title={saved ? "Saved provider" : "Save provider"}
        >
          {saved ? <BookmarkCheck className="h-4 w-4 text-[#FF6A00]" /> : <Bookmark className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#0D1B2A]/68">
        {provider.rating != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff8ec] px-2.5 py-1">
            <Star className="h-3.5 w-3.5 fill-[#FFB020] text-[#FFB020]" />
            {provider.rating.toFixed(1)}
            {provider.reviewCount != null ? ` (${provider.reviewCount.toLocaleString()})` : ""}
          </span>
        )}
        {provider.distanceKm != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F7FBFF] px-2.5 py-1">
            <MapPin className="h-3.5 w-3.5" />
            {provider.distanceKm < 1
              ? `${Math.max(1, Math.round(provider.distanceKm * 1000))} m`
              : `${provider.distanceKm.toFixed(1)} km`}
          </span>
        )}
      </div>

      {provider.address && (
        <p className="mt-3 text-xs leading-5 text-[#0D1B2A]/62">{provider.address}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {provider.phone && (
          <a
            href={`tel:${provider.phone.replace(/[^+\d]/g, "")}`}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#142941]"
          >
            <Phone className="h-3.5 w-3.5" /> Call
          </a>
        )}
        {provider.websiteUrl && (
          <a
            href={provider.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fff8ec]"
          >
            Website <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <a
          href={provider.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fff8ec]"
        >
          Directions <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}

export function LocalPropertyTeam({ parcel }: { parcel: NormalizedOfficialParcel }) {
  const defaultGroupId = looksLikeVacantLand(parcel) ? "plan-build" : "buy-sell-manage";
  const [activeGroupId, setActiveGroupId] = useState(defaultGroupId);
  const [providers, setProviders] = useState<ProviderState>({});
  const [loading, setLoading] = useState<LoadingState>({});
  const [errors, setErrors] = useState<ErrorState>({});
  const [loadedGroups, setLoadedGroups] = useState<Set<string>>(() => new Set());
  const [savedProviderIds, setSavedProviderIds] = useState<Set<string>>(
    () => new Set(readSavedProviderIds(parcel.id)),
  );

  const activeGroup = useMemo(
    () => PROVIDER_GROUPS.find((group) => group.id === activeGroupId) ?? PROVIDER_GROUPS[0],
    [activeGroupId],
  );

  useEffect(() => {
    setActiveGroupId(looksLikeVacantLand(parcel) ? "plan-build" : "buy-sell-manage");
    setProviders({});
    setLoading({});
    setErrors({});
    setLoadedGroups(new Set());
    setSavedProviderIds(new Set(readSavedProviderIds(parcel.id)));
  }, [parcel.id]);

  useEffect(() => {
    if (loadedGroups.has(activeGroup.id)) return;
    let cancelled = false;

    const run = async () => {
      for (const category of activeGroup.categories) {
        if (cancelled) return;
        setLoading((current) => ({ ...current, [category.id]: true }));
        setErrors((current) => ({ ...current, [category.id]: null }));
        try {
          const result = await searchCategory(category, parcel);
          if (!cancelled) {
            setProviders((current) => ({ ...current, [category.id]: result }));
          }
        } catch (error) {
          if (!cancelled) {
            setErrors((current) => ({
              ...current,
              [category.id]: error instanceof Error ? error.message : "Provider search unavailable",
            }));
          }
        } finally {
          if (!cancelled) {
            setLoading((current) => ({ ...current, [category.id]: false }));
          }
        }
      }
      if (!cancelled) {
        setLoadedGroups((current) => new Set(current).add(activeGroup.id));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeGroup, loadedGroups, parcel]);

  function toggleSaved(providerId: string) {
    setSavedProviderIds((current) => {
      const next = new Set(current);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      writeSavedProviderIds(parcel.id, Array.from(next));
      return next;
    });
  }

  return (
    <section className="mt-5 rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-[0_18px_45px_-36px_rgba(13,27,42,0.42)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
            <MapPin className="h-3.5 w-3.5" /> Local Property Team
          </div>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
            Local help for moving this property forward
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/68">
            Easy Erf uses this property location to surface useful local services. Results come from
            Google and are not vetted, ranked, or endorsed by Easy Erf. Confirm credentials, scope,
            pricing, insurance, and references before appointing anyone.
          </p>
        </div>
        <div className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] px-4 py-3 text-xs leading-5 text-[#0D1B2A]/66 lg:max-w-xs">
          <div className="font-semibold text-[#0D1B2A]">Search area</div>
          <div className="mt-1">{locationLabel(parcel) || "Selected erf area"}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {PROVIDER_GROUPS.map((group) => {
          const active = group.id === activeGroup.id;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => setActiveGroupId(group.id)}
              className={cn(
                "flex min-h-24 items-start justify-between gap-3 rounded-2xl border p-4 text-left transition",
                active
                  ? "border-[#FF6A00]/40 bg-[#fff8ec] shadow-[0_14px_34px_-28px_rgba(255,106,0,0.7)]"
                  : "border-[#D9E6F2] bg-[#F7FBFF] hover:border-[#0D1B2A]/20 hover:bg-white",
              )}
              aria-pressed={active}
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
                  <GroupIcon group={group} /> {group.label}
                </div>
                <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/60">{group.description}</p>
              </div>
              <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0", active && "text-[#FF6A00]")} />
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-4">
        {activeGroup.categories.map((category) => {
          const categoryProviders = providers[category.id] ?? [];
          const categoryLoading = loading[category.id];
          const categoryError = errors[category.id];
          return (
            <section
              key={category.id}
              className="rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-base font-semibold text-[#0D1B2A]">
                    <CategoryIcon categoryId={category.id} /> {category.label}
                  </div>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-[#0D1B2A]/62">
                    {category.reason}
                  </p>
                </div>
                <a
                  href={mapsSearchUrl(category, parcel)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fff8ec]"
                >
                  Search Google Maps <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              {categoryLoading ? (
                <div className="mt-4 flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-[#D9E6F2] bg-white text-sm text-[#0D1B2A]/60">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finding local providers
                </div>
              ) : categoryProviders.length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {categoryProviders.map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      saved={savedProviderIds.has(provider.id)}
                      onToggleSaved={() => toggleSaved(provider.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-[#D9E6F2] bg-white px-4 py-4 text-sm leading-6 text-[#0D1B2A]/62">
                  {categoryError === "Google Places is not configured"
                    ? "Live provider cards need Places API (New) enabled on the existing Google Maps key. Google Maps search remains available above."
                    : "No strong live matches were returned. Use Google Maps search to widen the area or review more providers."}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-[#FF6A00]/20 bg-[#fff8ec] px-4 py-3 text-xs leading-5 text-[#0D1B2A]/66">
        <span className="font-semibold text-[#0D1B2A]">Advertising safeguard:</span> future paid
        placements must be clearly marked Sponsored and must not silently replace organic local
        results. Easy Erf Verified must only be used after a real verification process exists.
      </div>
    </section>
  );
}
