import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Building2,
  ChevronRight,
  CircleDollarSign,
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
import type { AddressCandidate } from "@/features/marketEvidence/types";
import {
  categoriesForGroup,
  inferLocalPropertyState,
  orderedLocalServiceGroups,
  type LocalProvider,
  type LocalServiceCategory,
  type LocalServiceGroup,
} from "@/lib/localServices/catalog";
import {
  readSavedLocalProviders,
  toggleSavedLocalProvider,
  type SavedLocalProvider,
} from "@/lib/localServices/savedProviders";
import { cn } from "@/lib/utils";

interface Props {
  parcel: NormalizedOfficialParcel;
  siteMode?: string | null;
  marketAddress?: AddressCandidate | null;
  marketAddressLoading?: boolean;
  onOpenMarket: () => void;
}

interface SearchState {
  loading: boolean;
  loaded: boolean;
  providers: LocalProvider[];
  error: string | null;
  errorCode: string | null;
  widerArea: boolean;
  attribution: string | null;
  radiusKm?: number;
  queriesAttempted?: number;
  includePureServiceAreaBusinesses?: boolean;
}

const EMPTY_SEARCH: SearchState = {
  loading: false,
  loaded: false,
  providers: [],
  error: null,
  errorCode: null,
  widerArea: false,
  attribution: null,
  radiusKm: undefined,
  queriesAttempted: undefined,
  includePureServiceAreaBusinesses: undefined,
};

function groupIcon(groupId: LocalServiceGroup["id"]) {
  if (groupId === "plan-build") return Hammer;
  if (groupId === "protect-maintain") return ShieldCheck;
  if (groupId === "connect-property") return PlugZap;
  return CircleDollarSign;
}

function categoryIcon(categoryId: string) {
  if (categoryId.includes("internet")) return Wifi;
  if (categoryId.includes("estate") || categoryId.includes("valuer")) return Building2;
  if (categoryId.includes("builder") || categoryId.includes("engineer")) return Hammer;
  if (categoryId.includes("insurance") || categoryId.includes("security")) return ShieldCheck;
  return Search;
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm == null) return null;
  if (distanceKm < 1) return `${Math.max(1, Math.round(distanceKm * 1000))} m away`;
  return `${distanceKm.toFixed(1)} km away`;
}

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

const GOOGLE_PLACES_ATTRIBUTION_LOGO =
  "https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png";

function GooglePlacesAttribution({ providers }: { providers: LocalProvider[] }) {
  const attributions = Array.from(
    new Set(providers.flatMap((provider) => provider.attributions ?? []).filter(Boolean)),
  );
  return (
    <div className="mt-3 flex flex-col gap-2 text-[11px] text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex min-h-6 items-center rounded-md bg-white px-2 py-1">
        <img
          src={GOOGLE_PLACES_ATTRIBUTION_LOGO}
          alt="Powered by Google"
          width={120}
          height={14}
          className="h-[14px] w-[120px] object-contain"
          loading="lazy"
          decoding="async"
        />
      </div>
      {attributions.length ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Google Places third-party attributions">
          {attributions.map((attribution) => (
            <li key={attribution}>{attribution}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ProviderCard({
  provider,
  category,
  saved,
  onToggleSaved,
}: {
  provider: LocalProvider;
  category: LocalServiceCategory;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  const distance = formatDistance(provider.distanceKm);
  return (
    <article className="rounded-2xl border border-[#D9E6F2] bg-white p-4 shadow-[0_14px_34px_-30px_rgba(13,27,42,0.65)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
            <span>Google place result</span>
          </div>
          <h5 className="mt-1 text-sm font-semibold leading-5 text-[#0D1B2A]">{provider.name}</h5>
          <p className="mt-1 text-[11px] font-medium text-[#64748B]">{category.label}</p>
        </div>
        <button
          type="button"
          onClick={onToggleSaved}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#0D1B2A]/10 bg-[#F7FBFF] text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fff8ec]"
          aria-label={saved ? `Remove ${provider.name} from saved providers` : `Save ${provider.name}`}
          title={saved ? "Saved provider" : "Save provider"}
        >
          {saved ? (
            <BookmarkCheck className="h-4 w-4 text-[#FF6A00]" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#0D1B2A]/68">
        {provider.rating != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff8ec] px-2.5 py-1">
            <Star className="h-3.5 w-3.5 fill-[#FFB020] text-[#FFB020]" />
            {provider.rating.toFixed(1)}
            {provider.userRatingCount != null ? ` (${provider.userRatingCount.toLocaleString()})` : ""}
          </span>
        )}
        {provider.openNow != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F7FBFF] px-2.5 py-1">
            {provider.openNow ? "Open now" : "Closed now"}
          </span>
        )}
        {distance && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F7FBFF] px-2.5 py-1">
            <MapPin className="h-3.5 w-3.5" /> {distance}
          </span>
        )}
      </div>

      {provider.address && (
        <p className="mt-3 text-xs leading-5 text-[#0D1B2A]/62">{provider.address}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {provider.phone && (
          <a
            href={phoneHref(provider.phone)}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#142941]"
          >
            <Phone className="h-3.5 w-3.5" /> Call
          </a>
        )}
        {provider.website && (
          <a
            href={provider.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fff8ec]"
          >
            Website <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <a
          href={provider.googleMapsUrl}
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

export function LocalPropertyTeam({
  parcel,
  siteMode,
  marketAddress,
  marketAddressLoading = false,
  onOpenMarket,
}: Props) {
  const propertyState = useMemo(
    () => inferLocalPropertyState(parcel, siteMode),
    [parcel, siteMode],
  );
  const groups = useMemo(() => orderedLocalServiceGroups(propertyState), [propertyState]);
  const [activeGroupId, setActiveGroupId] = useState(groups[0]?.id ?? "buy-sell-manage");
  const activeCategories = useMemo(
    () => categoriesForGroup(activeGroupId, propertyState),
    [activeGroupId, propertyState],
  );
  const [activeCategoryId, setActiveCategoryId] = useState(activeCategories[0]?.id ?? "estate-agents");
  const activeCategory =
    activeCategories.find((category) => category.id === activeCategoryId) ?? activeCategories[0];
  const [searches, setSearches] = useState<Record<string, SearchState>>({});
  const [savedProviders, setSavedProviders] = useState<SavedLocalProvider[]>(() =>
    readSavedLocalProviders(parcel.id),
  );
  const activeRequestRef = useRef<{
    id: number;
    parcelId: string;
    categoryId: string;
    address: string;
    controller: AbortController;
  } | null>(null);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    const nextGroups = orderedLocalServiceGroups(propertyState);
    const nextGroup = nextGroups[0]?.id ?? "buy-sell-manage";
    const nextCategory = categoriesForGroup(nextGroup, propertyState)[0]?.id ?? "estate-agents";
    setActiveGroupId(nextGroup);
    setActiveCategoryId(nextCategory);
    setSearches({});
    setSavedProviders(readSavedLocalProviders(parcel.id));
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
  }, [parcel.id, propertyState]);

  useEffect(() => {
    const categories = categoriesForGroup(activeGroupId, propertyState);
    if (!categories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(categories[0]?.id ?? "estate-agents");
    }
  }, [activeCategoryId, activeGroupId, propertyState]);

  const currentSearch = activeCategory ? searches[activeCategory.id] ?? EMPTY_SEARCH : EMPTY_SEARCH;
  const marketAddressLabel = marketAddress?.formattedAddress.trim() ?? "";
  const hasMarketAddress = Boolean(marketAddressLabel);
  const fallbackUrl =
    activeCategory && hasMarketAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${activeCategory.searchQuery} near ${marketAddressLabel}`)}`
      : null;
  const locationLabel = marketAddressLabel || "Property address not set";
  const stateLabel =
    propertyState === "vacant_land"
      ? "Vacant land priorities"
      : propertyState === "existing_home"
        ? "Existing home priorities"
      : "General property priorities";

  useEffect(() => {
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
    setSearches({});
  }, [parcel.id, marketAddressLabel]);

  async function searchCategory(category: LocalServiceCategory, widerArea = false) {
    if (!hasMarketAddress) {
      onOpenMarket();
      return;
    }

    activeRequestRef.current?.controller.abort();
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    const controller = new AbortController();
    activeRequestRef.current = {
      id: requestId,
      parcelId: parcel.id,
      categoryId: category.id,
      address: marketAddressLabel,
      controller,
    };

    setSearches((current) => ({
      ...current,
      [category.id]: {
        ...(current[category.id] ?? EMPTY_SEARCH),
        loading: true,
        error: null,
        errorCode: null,
        widerArea,
        attribution: null,
      },
    }));
    try {
      const response = await fetch("/api/local-services/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          serviceCategory: category.id,
          parcelId: parcel.id,
          confirmedAddress: marketAddressLabel,
          latitude: marketAddress?.lat ?? null,
          longitude: marketAddress?.lng ?? null,
          widerArea,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            providers?: LocalProvider[];
            error?: string;
            code?: string;
            attribution?: string;
            parcelId?: string;
            categoryId?: string;
            confirmedAddress?: string;
            radiusKm?: number;
            queriesAttempted?: number;
            includePureServiceAreaBusinesses?: boolean;
          }
        | null;
      if (!response.ok || !payload?.success) {
        throw new LocalSearchError(
          payload?.error || "Local provider results could not be loaded.",
          payload?.code || "provider_search_failed",
        );
      }
      if (!isCurrentSearch(requestId, category.id, marketAddressLabel, payload)) return;
      setSearches((current) => ({
        ...current,
        [category.id]: {
          loading: false,
          loaded: true,
          providers: Array.isArray(payload.providers) ? payload.providers.slice(0, 3) : [],
          error: null,
          errorCode: null,
          widerArea,
          attribution: payload.attribution ?? "Google",
          radiusKm: typeof payload.radiusKm === "number" ? payload.radiusKm : undefined,
          queriesAttempted:
            typeof payload.queriesAttempted === "number" ? payload.queriesAttempted : undefined,
          includePureServiceAreaBusinesses: Boolean(payload.includePureServiceAreaBusinesses),
        },
      }));
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!isCurrentSearch(requestId, category.id, marketAddressLabel)) return;
      setSearches((current) => ({
        ...current,
        [category.id]: {
          loading: false,
          loaded: true,
          providers: [],
          error: error instanceof Error ? error.message : "Local provider results are unavailable.",
          errorCode: error instanceof LocalSearchError ? error.code : "provider_search_failed",
          widerArea,
          attribution: null,
        },
      }));
    }
  }

  function isCurrentSearch(
    requestId: number,
    categoryId: string,
    address: string,
    payload?: { parcelId?: string; categoryId?: string; confirmedAddress?: string } | null,
  ) {
    return (
      activeRequestRef.current?.id === requestId &&
      activeRequestRef.current.parcelId === parcel.id &&
      activeRequestRef.current.categoryId === categoryId &&
      activeRequestRef.current.address === address &&
      (!payload ||
        (payload.parcelId === parcel.id &&
          payload.categoryId === categoryId &&
          payload.confirmedAddress === address))
    );
  }

  function cancelSearch() {
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
    if (!activeCategory) return;
    setSearches((current) => ({
      ...current,
      [activeCategory.id]: {
        ...(current[activeCategory.id] ?? EMPTY_SEARCH),
        loading: false,
        error: null,
        errorCode: null,
      },
    }));
  }

  function chooseGroup(groupId: LocalServiceGroup["id"]) {
    setActiveGroupId(groupId);
    const category = categoriesForGroup(groupId, propertyState)[0];
    if (category) {
      setActiveCategoryId(category.id);
      if (hasMarketAddress) void searchCategory(category, false);
    }
  }

  function chooseCategory(category: LocalServiceCategory) {
    setActiveCategoryId(category.id);
    if (hasMarketAddress) void searchCategory(category, false);
  }

  function toggleSaved(provider: LocalProvider) {
    setSavedProviders(toggleSavedLocalProvider(parcel.id, provider));
  }

  if (marketAddressLoading) {
    return (
      <section className="rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-[0_18px_45px_-36px_rgba(13,27,42,0.42)]">
        <div className="flex min-h-40 items-center justify-center text-sm font-semibold text-[#0D1B2A]/62">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking the saved Market address
        </div>
      </section>
    );
  }

  if (!hasMarketAddress) {
    return (
      <section className="rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-[0_18px_45px_-36px_rgba(13,27,42,0.42)]">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
          <MapPin className="h-3.5 w-3.5" /> Local Property Team
        </div>
        <div className="mt-5 rounded-[1.5rem] border border-[#FF6A00]/25 bg-[#FFF7ED] p-5">
          <h3 className="text-xl font-semibold tracking-tight text-[#0D1B2A]">
            Add the property address first
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/68">
            Local provider results are searched around the confirmed property address, not the erf
            number or parcel description. Open Market, add or correct the address, then return here.
          </p>
          <button
            type="button"
            onClick={onOpenMarket}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff7d1f]"
          >
            Go to Market and update address <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-[#0D1B2A]/10 bg-white p-5 shadow-[0_18px_45px_-36px_rgba(13,27,42,0.42)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
            <MapPin className="h-3.5 w-3.5" /> Local Property Team
          </div>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[#0D1B2A]">
            Find local help for this erf
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/68">
            Choose the service you need and Easy Erf will return up to three relevant Google results
            around the confirmed Market address. Results are not based on the erf number or parcel label.
          </p>
        </div>
        <div className="rounded-2xl border border-[#D9E6F2] bg-[#F7FBFF] px-4 py-3 text-xs leading-5 text-[#0D1B2A]/66 lg:max-w-sm">
          <div className="font-semibold text-[#0D1B2A]">Searching around</div>
          <div className="mt-1">{locationLabel}</div>
          <button
            type="button"
            onClick={onOpenMarket}
            className="mt-2 font-semibold text-[#B24A00] underline underline-offset-2"
          >
            Change address in Market
          </button>
          <div className="mt-2">{stateLabel} - {savedProviders.length} provider{savedProviders.length === 1 ? "" : "s"} saved</div>
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {groups.map((group) => {
          const active = group.id === activeGroupId;
          const Icon = groupIcon(group.id);
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => chooseGroup(group.id)}
              className={cn(
                "min-w-[16rem] rounded-2xl border p-4 text-left transition lg:min-w-0",
                active
                  ? "border-[#FF6A00]/40 bg-[#fff8ec] shadow-[0_14px_34px_-28px_rgba(255,106,0,0.7)]"
                  : "border-[#D9E6F2] bg-[#F7FBFF] hover:border-[#0D1B2A]/20 hover:bg-white",
              )}
              aria-pressed={active}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
                  <Icon className="h-4 w-4" /> {group.label}
                </div>
                <ChevronRight className={cn("h-4 w-4", active && "text-[#FF6A00]")} />
              </div>
              <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/60">{group.description}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Local service categories">
        {activeCategories.map((category) => {
          const active = category.id === activeCategory?.id;
          const Icon = categoryIcon(category.id);
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => chooseCategory(category)}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition",
                active
                  ? "border-[#0D1B2A] bg-[#0D1B2A] text-white"
                  : "border-[#0D1B2A]/10 bg-white text-[#0D1B2A] hover:border-[#FF6A00]/35 hover:bg-[#fff8ec]",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {category.label}
            </button>
          );
        })}
      </div>

      {activeCategory && (
        <section className="mt-4 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                Top local Google results
              </p>
              <h4 className="text-base font-semibold text-[#0D1B2A]">{activeCategory.label}</h4>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-[#0D1B2A]/62">
                {activeCategory.reason[propertyState]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={currentSearch.loading}
                onClick={() => void searchCategory(activeCategory, false)}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#ff7d1f] disabled:cursor-wait disabled:opacity-60"
              >
                {currentSearch.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                {currentSearch.loaded ? "Refresh nearby results" : "Find nearby providers"}
              </button>
              {fallbackUrl && (
                <a
                  href={fallbackUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fff8ec]"
                >
                  Open this search in Google Maps <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {currentSearch.loading && (
                <button
                  type="button"
                  onClick={cancelSearch}
                  className="inline-flex min-h-9 items-center justify-center rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A]"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {currentSearch.loading ? (
            <div className="mt-4 flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-[#D9E6F2] bg-white text-sm text-[#0D1B2A]/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finding local providers
            </div>
          ) : currentSearch.providers.length ? (
            <>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {currentSearch.providers.slice(0, 3).map((provider) => (
                  <ProviderCard
                    key={provider.placeId}
                    provider={provider}
                    category={activeCategory}
                    saved={savedProviders.some((item) => item.placeId === provider.placeId)}
                    onToggleSaved={() => toggleSaved(provider)}
                  />
                ))}
              </div>
              <p className="mt-3 text-[11px] font-medium text-[#64748B]">
                Results provided by {currentSearch.attribution ?? "Google"}.{" "}
                {currentSearch.radiusKm ? `Search radius: ${currentSearch.radiusKm} km.` : null}
              </p>
              <GooglePlacesAttribution providers={currentSearch.providers.slice(0, 3)} />
            </>
          ) : currentSearch.loaded ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#D9E6F2] bg-white px-4 py-4 text-sm leading-6 text-[#0D1B2A]/62">
              <p>
                {currentSearch.error
                  ? currentSearch.error
                  : "No matching Google providers were found in this search area."}
              </p>
              {!currentSearch.error && (
                <p className="mt-1 text-xs text-[#0D1B2A]/54">
                  Service-area businesses may not always appear near the property pin. Try the wider
                  area or open this search in Google Maps.
                </p>
              )}
              {!currentSearch.error && currentSearch.queriesAttempted ? (
                <p className="mt-1 text-[11px] text-[#64748B]">
                  Checked {currentSearch.queriesAttempted} Google search{" "}
                  {currentSearch.queriesAttempted === 1 ? "variant" : "variants"}
                  {currentSearch.radiusKm ? ` within ${currentSearch.radiusKm} km` : ""}.
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={currentSearch.loading || currentSearch.widerArea}
                  onClick={() => void searchCategory(activeCategory, true)}
                  className="inline-flex min-h-9 items-center justify-center rounded-full bg-[#0D1B2A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#142941] disabled:opacity-50"
                >
                  Try wider area
                </button>
                {fallbackUrl && (
                  <a
                    href={fallbackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A]"
                  >
                    Open this search in Google Maps <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[#D9E6F2] bg-white px-4 py-4 text-sm leading-6 text-[#0D1B2A]/62">
              Search only when you need this category. Easy Erf will show up to three genuine Google business results or an honest fallback.
            </div>
          )}
        </section>
      )}

      <div className="mt-5 rounded-2xl border border-[#FF6A00]/20 bg-[#fff8ec] px-4 py-3 text-xs leading-5 text-[#0D1B2A]/66">
        Results are sourced from Google and have not been independently vetted or endorsed by Easy
        Erf. Confirm credentials, registration, insurance, pricing, and references before appointing
        a provider.
      </div>
    </section>
  );
}

class LocalSearchError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}
