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
import {
  buildCustomServiceCategory,
  customServiceGoogleMapsUrl,
  customServiceResultsHeading,
  isCustomServiceCategoryId,
  MAX_CUSTOM_SERVICE_QUERY_LENGTH,
  readRecentCustomServiceSearches,
  recordRecentCustomServiceSearch,
  sanitizeCustomServiceQuery,
} from "@/lib/localServices/customServiceSearch";
import { cn } from "@/lib/utils";
import { useVendorWorkspace } from "@/lib/vendors/useVendorWorkspace";
import { vendorRoleForLocalServiceCategory } from "@/lib/vendors/localServiceRoleMap";
import type { VendorAssignmentInput, VendorRole } from "@/lib/vendors/types";
import { MyPropertyTeam } from "@/components/property/vendors/MyPropertyTeam";
import { VendorLibraryPanel } from "@/components/property/vendors/VendorLibraryPanel";
import { ManualVendorForm } from "@/components/property/vendors/ManualVendorForm";
import { AssignVendorDialog } from "@/components/property/vendors/AssignVendorDialog";
import { BookmarkPlus, ClipboardList } from "lucide-react";

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

const GOOGLE_MAPS_ATTRIBUTION_LOGO = "/third-party/google-maps/google-maps-logo-dark-gray.svg";

function GooglePlacesAttribution({ providers }: { providers: LocalProvider[] }) {
  const attributions = providers
    .flatMap((provider) => provider.attributions ?? [])
    .reduce<Array<{ provider: string; providerUri: string | null }>>((items, attribution) => {
      const provider = attribution.provider.trim();
      const providerUri = safeHttpsUrl(attribution.providerUri);
      const key = `${provider.toLowerCase()}|${providerUri ?? ""}`;
      if (
        provider &&
        !items.some((item) => `${item.provider.toLowerCase()}|${item.providerUri ?? ""}` === key)
      ) {
        items.push({ provider, providerUri });
      }
      return items;
    }, []);
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-[#D9E6F2] bg-white px-3 py-2 text-[11px] text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex items-center rounded-md bg-white px-[10px] pb-[5px] pt-[10px]">
        <img
          src={GOOGLE_MAPS_ATTRIBUTION_LOGO}
          alt="Google Maps"
          width={98}
          height={18}
          className="h-[18px] w-auto object-contain"
          loading="lazy"
          decoding="async"
        />
      </div>
      {attributions.length ? (
        <ul
          className="flex flex-wrap gap-x-3 gap-y-1"
          aria-label="Google Maps third-party attributions"
        >
          {attributions.map((attribution) => (
            <li key={`${attribution.provider}|${attribution.providerUri ?? ""}`}>
              {attribution.providerUri ? (
                <a
                  href={attribution.providerUri}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#334155] underline underline-offset-2"
                >
                  {attribution.provider}
                </a>
              ) : (
                attribution.provider
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function safeHttpsUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function ProviderCard({
  provider,
  category,
  saved,
  onToggleSaved,
  isVendorSaved,
  onSaveVendor,
  onAddToProperty,
}: {
  provider: LocalProvider;
  category: LocalServiceCategory;
  saved: boolean;
  onToggleSaved: () => void;
  isVendorSaved: boolean;
  onSaveVendor: () => void;
  onAddToProperty: () => void;
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
          aria-label={
            saved ? `Remove ${provider.name} from saved providers` : `Save ${provider.name}`
          }
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
            {provider.userRatingCount != null
              ? ` (${provider.userRatingCount.toLocaleString()})`
              : ""}
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

      <div className="mt-2 flex flex-wrap gap-2 border-t border-[#D9E6F2] pt-3">
        <button
          type="button"
          onClick={onSaveVendor}
          disabled={isVendorSaved}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fff8ec] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <BookmarkPlus className="h-3.5 w-3.5" /> {isVendorSaved ? "Saved vendor" : "Save vendor"}
        </button>
        <button
          type="button"
          onClick={onAddToProperty}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-[#FF6A00] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#ff7d1f]"
        >
          <ClipboardList className="h-3.5 w-3.5" /> Add to this property
        </button>
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
  const [activeCategoryId, setActiveCategoryId] = useState(
    activeCategories[0]?.id ?? "estate-agents",
  );
  const presetCategory =
    activeCategories.find((category) => category.id === activeCategoryId) ?? activeCategories[0];
  const [customCategory, setCustomCategory] = useState<LocalServiceCategory | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [recentCustomSearches, setRecentCustomSearches] = useState<string[]>(() =>
    readRecentCustomServiceSearches(parcel.id),
  );
  const activeCategory = customCategory ?? presetCategory;
  const isCustomActive = Boolean(customCategory);
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

  const vendorWorkspace = useVendorWorkspace(parcel.id);
  const [activeLibraryTab, setActiveLibraryTab] = useState<"search" | "my-vendors" | "add-manual">(
    "search",
  );
  const [assigningProvider, setAssigningProvider] = useState<LocalProvider | null>(null);
  const [assigningProviderCategory, setAssigningProviderCategory] = useState<LocalServiceCategory | null>(
    null,
  );

  useEffect(() => {
    const nextGroups = orderedLocalServiceGroups(propertyState);
    const nextGroup = nextGroups[0]?.id ?? "buy-sell-manage";
    const nextCategory = categoriesForGroup(nextGroup, propertyState)[0]?.id ?? "estate-agents";
    setActiveGroupId(nextGroup);
    setActiveCategoryId(nextCategory);
    setSearches({});
    setCustomCategory(null);
    setCustomInput("");
    setCustomError(null);
    setRecentCustomSearches(readRecentCustomServiceSearches(parcel.id));
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

  const currentSearch = activeCategory
    ? (searches[activeCategory.id] ?? EMPTY_SEARCH)
    : EMPTY_SEARCH;
  const marketAddressLabel = marketAddress?.formattedAddress.trim() ?? "";
  const hasMarketAddress = Boolean(marketAddressLabel);
  const fallbackUrl =
    activeCategory && hasMarketAddress
      ? customServiceGoogleMapsUrl(activeCategory.searchQuery, marketAddressLabel)
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
    setCustomCategory(null);
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
          customQuery: isCustomServiceCategoryId(category.id) ? category.searchQuery : undefined,
          parcelId: parcel.id,
          confirmedAddress: marketAddressLabel,
          latitude: marketAddress?.lat ?? null,
          longitude: marketAddress?.lng ?? null,
          widerArea,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
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
      } | null;
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
    setCustomCategory(null);
    setActiveGroupId(groupId);
    const category = categoriesForGroup(groupId, propertyState)[0];
    if (category) {
      setActiveCategoryId(category.id);
      if (hasMarketAddress) void searchCategory(category, false);
    }
  }

  function chooseCategory(category: LocalServiceCategory) {
    setCustomCategory(null);
    setActiveCategoryId(category.id);
    if (hasMarketAddress) void searchCategory(category, false);
  }

  function runCustomSearch(rawQuery: string) {
    const category = buildCustomServiceCategory(rawQuery);
    if (!category) {
      setCustomError(
        `Enter the service you need, for example "security company" (up to ${MAX_CUSTOM_SERVICE_QUERY_LENGTH} characters).`,
      );
      return;
    }
    setCustomError(null);
    setCustomInput(category.searchQuery);
    setCustomCategory(category);
    setRecentCustomSearches(recordRecentCustomServiceSearch(parcel.id, category.searchQuery));
    if (hasMarketAddress) void searchCategory(category, false);
    else onOpenMarket();
  }

  function toggleSaved(provider: LocalProvider) {
    setSavedProviders(toggleSavedLocalProvider(parcel.id, provider));
  }

  function providerToVendorInput(provider: LocalProvider, category: LocalServiceCategory) {
    const custom = isCustomServiceCategoryId(category.id);
    return {
      name: provider.name,
      company: null,
      role: vendorRoleForLocalServiceCategory(category.id),
      phone: provider.phone,
      email: null,
      website: provider.website ?? provider.websiteUrl ?? null,
      serviceArea: provider.address,
      source: custom ? `Google search - ${category.label}` : "Google search",
      notes: custom ? `Found via custom search: ${category.label}` : null,
      originPlaceId: provider.placeId,
    };
  }

  async function handleSaveVendorFromProvider(provider: LocalProvider, category: LocalServiceCategory) {
    await vendorWorkspace.saveVendor(providerToVendorInput(provider, category));
  }

  function isProviderSaved(provider: LocalProvider) {
    return vendorWorkspace.directory.some((vendor) => vendor.originPlaceId === provider.placeId);
  }

  function openAssignForProvider(provider: LocalProvider, category: LocalServiceCategory) {
    setAssigningProvider(provider);
    setAssigningProviderCategory(category);
  }

  const providerVendorForAssign = assigningProvider
    ? (vendorWorkspace.directory.find((vendor) => vendor.originPlaceId === assigningProvider.placeId) ??
      null)
    : null;

  async function handleAssignProviderVendor(input: VendorAssignmentInput & { roleOnProperty: VendorRole }) {
    if (!assigningProvider || !assigningProviderCategory) return;
    let vendor = providerVendorForAssign;
    if (!vendor) {
      vendor = await vendorWorkspace.saveVendor(
        providerToVendorInput(assigningProvider, assigningProviderCategory),
      );
    }
    await vendorWorkspace.assignVendor(vendor.id, input);
  }

  const parcelTeamLabel =
    marketAddressLabel ||
    (parcel.erfNumber ? `Erf ${parcel.erfNumber}` : "This property");

  const myPropertyTeamSection = (
    <MyPropertyTeam
      parcelLabel={parcelTeamLabel}
      vendors={vendorWorkspace.directory}
      assignments={vendorWorkspace.assignments}
      onUpdateAssignment={(assignmentId, patch) =>
        void vendorWorkspace.updateAssignment(assignmentId, patch)
      }
      onRemoveAssignment={(assignmentId) => void vendorWorkspace.removeFromProperty(assignmentId)}
      onOpenSearch={() => setActiveLibraryTab("search")}
      onOpenLibrary={() => setActiveLibraryTab("add-manual")}
    />
  );

  const libraryTabs = (
    <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Vendor workspace areas">
      {[
        { id: "search" as const, label: "Search local professionals" },
        { id: "my-vendors" as const, label: `My vendors (${vendorWorkspace.directory.length})` },
        { id: "add-manual" as const, label: "Add vendor manually" },
      ].map((tabItem) => (
        <button
          key={tabItem.id}
          type="button"
          onClick={() => setActiveLibraryTab(tabItem.id)}
          className={cn(
            "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition",
            activeLibraryTab === tabItem.id
              ? "border-[#0D1B2A] bg-[#0D1B2A] text-white"
              : "border-[#0D1B2A]/10 bg-white text-[#0D1B2A] hover:border-[#FF6A00]/35 hover:bg-[#fff8ec]",
          )}
        >
          {tabItem.label}
        </button>
      ))}
    </div>
  );

  const assignDialog = (
    <AssignVendorDialog
      vendor={assigningProvider ? (providerVendorForAssign ?? {
        id: "__pending__",
        name: assigningProvider.name,
        company: null,
        role: assigningProviderCategory
          ? vendorRoleForLocalServiceCategory(assigningProviderCategory.id)
          : "other",
        phone: assigningProvider.phone,
        email: null,
        website: assigningProvider.website ?? assigningProvider.websiteUrl ?? null,
        serviceArea: assigningProvider.address,
        source: "Google search",
        notes: null,
        originPlaceId: assigningProvider.placeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }) : null}
      parcelLabel={parcelTeamLabel}
      defaultScopeOfWork={
        assigningProviderCategory && isCustomServiceCategoryId(assigningProviderCategory.id)
          ? assigningProviderCategory.label
          : null
      }
      onClose={() => {
        setAssigningProvider(null);
        setAssigningProviderCategory(null);
      }}
      onAssign={handleAssignProviderVendor}
    />
  );

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
    <div className="space-y-5">
      {myPropertyTeamSection}
      {libraryTabs}
      {activeLibraryTab === "my-vendors" ? (
        <VendorLibraryPanel
          parcelLabel={parcelTeamLabel}
          vendors={vendorWorkspace.directory}
          assignments={vendorWorkspace.assignments}
          onAssignVendor={(vendorId, input) => void vendorWorkspace.assignVendor(vendorId, input)}
          onDeleteVendor={(vendorId) => vendorWorkspace.deleteVendor(vendorId, true)}
        />
      ) : activeLibraryTab === "add-manual" ? (
        <ManualVendorForm onSave={(input) => void vendorWorkspace.saveVendor(input)} />
      ) : (
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
            around the confirmed Market address. Results are not based on the erf number or parcel
            label.
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
          <div className="mt-2">
            {stateLabel} - {savedProviders.length} provider{savedProviders.length === 1 ? "" : "s"}{" "}
            saved
          </div>
        </div>
      </div>

      <form
        className="mt-5 rounded-[1.5rem] border border-[#FF6A00]/25 bg-[#FFF7ED] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          runCustomSearch(customInput);
        }}
      >
        <label
          htmlFor="custom-service-query"
          className="text-sm font-semibold text-[#0D1B2A]"
        >
          What service do you need?
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="custom-service-query"
            type="text"
            value={customInput}
            maxLength={MAX_CUSTOM_SERVICE_QUERY_LENGTH}
            onChange={(event) => {
              setCustomInput(event.target.value);
              if (customError) setCustomError(null);
            }}
            placeholder="Try security company, home staging, pool maintenance..."
            className="min-h-11 w-full rounded-full border border-[#0D1B2A]/12 bg-white px-4 text-sm text-[#0D1B2A] outline-none transition focus:border-[#FF6A00]/50"
          />
          <button
            type="submit"
            disabled={!sanitizeCustomServiceQuery(customInput) || currentSearch.loading}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#FF6A00] px-5 text-sm font-semibold text-white transition hover:bg-[#ff7d1f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="h-4 w-4" /> Search nearby
          </button>
        </div>
        {customError && (
          <p className="mt-2 text-xs font-semibold text-[#B24A00]">{customError}</p>
        )}
        {recentCustomSearches.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              Recent
            </span>
            {recentCustomSearches.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => runCustomSearch(entry)}
                className="inline-flex min-h-8 items-center rounded-full border border-[#0D1B2A]/10 bg-white px-3 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/35 hover:bg-[#fff8ec]"
              >
                {entry}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] leading-5 text-[#0D1B2A]/60">
          Searched around the saved Market address, never the erf number.
        </p>
      </form>

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
                {isCustomActive ? "Your search" : "Top local Google results"}
              </p>
              <h4 className="text-base font-semibold text-[#0D1B2A]">
                {isCustomActive
                  ? customServiceResultsHeading(activeCategory.searchQuery)
                  : activeCategory.label}
              </h4>
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
                {currentSearch.loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
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
                    isVendorSaved={isProviderSaved(provider)}
                    onSaveVendor={() => void handleSaveVendorFromProvider(provider, activeCategory)}
                    onAddToProperty={() => openAssignForProvider(provider, activeCategory)}
                  />
                ))}
              </div>
              <p className="mt-3 text-[11px] font-medium text-[#64748B]">
                Results provided by Google Maps.{" "}
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
              Search only when you need this category. Easy Erf will show up to three genuine Google
              business results or an honest fallback.
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
      )}
      {assignDialog}
    </div>
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
