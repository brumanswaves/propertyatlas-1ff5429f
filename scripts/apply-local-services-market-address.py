from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


# Local Property Team: require and use the saved Market address only.
path = "src/components/property/dossier/LocalPropertyTeam.tsx"
replace_once(
    path,
    'import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";\n',
    'import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";\nimport type { AddressCandidate } from "@/features/marketEvidence/types";\n',
)
replace_once(
    path,
    '''interface Props {
  parcel: NormalizedOfficialParcel;
  siteMode?: string | null;
}''',
    '''interface Props {
  parcel: NormalizedOfficialParcel;
  siteMode?: string | null;
  marketAddress?: AddressCandidate | null;
  marketAddressLoading?: boolean;
  onOpenMarket: () => void;
}''',
)
replace_once(
    path,
    'export function LocalPropertyTeam({ parcel, siteMode }: Props) {',
    '''export function LocalPropertyTeam({
  parcel,
  siteMode,
  marketAddress,
  marketAddressLoading = false,
  onOpenMarket,
}: Props) {''',
)
replace_once(
    path,
    '''  const currentSearch = activeCategory ? searches[activeCategory.id] ?? EMPTY_SEARCH : EMPTY_SEARCH;
  const fallbackUrl = activeCategory ? buildGoogleMapsFallbackUrl(activeCategory, parcel) : null;
  const locationLabel = localServiceLocationLabel(parcel) || "Selected erf area";''',
    '''  const currentSearch = activeCategory ? searches[activeCategory.id] ?? EMPTY_SEARCH : EMPTY_SEARCH;
  const marketAddressLabel = marketAddress?.formattedAddress.trim() ?? "";
  const hasMarketAddress = Boolean(marketAddressLabel);
  const fallbackUrl =
    activeCategory && hasMarketAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${activeCategory.searchQuery} near ${marketAddressLabel}`)}`
      : null;
  const locationLabel = marketAddressLabel || "Property address not set";''',
)
replace_once(
    path,
    '''  async function searchCategory(category: LocalServiceCategory, widerArea = false) {
    setSearches((current) => ({''',
    '''  async function searchCategory(category: LocalServiceCategory, widerArea = false) {
    if (!hasMarketAddress) {
      onOpenMarket();
      return;
    }
    setSearches((current) => ({''',
)
replace_once(
    path,
    '''        body: JSON.stringify({
          categoryId: category.id,
          parcelId: parcel.id,
          latitude: parcel.coordinates?.lat ?? null,
          longitude: parcel.coordinates?.lng ?? null,
          suburb: parcel.suburbOrArea,
          town: parcel.town,
          municipality: parcel.municipality,
          province: parcel.province,
          widerArea,
        }),''',
    '''        body: JSON.stringify({
          categoryId: category.id,
          parcelId: parcel.id,
          address: marketAddressLabel,
          latitude: marketAddress?.lat ?? null,
          longitude: marketAddress?.lng ?? null,
          widerArea,
        }),''',
)
replace_once(
    path,
    '''  function chooseGroup(groupId: LocalServiceGroup["id"]) {
    setActiveGroupId(groupId);
    const category = categoriesForGroup(groupId, propertyState)[0];
    if (category) setActiveCategoryId(category.id);
  }

  function chooseCategory(category: LocalServiceCategory) {
    setActiveCategoryId(category.id);
  }''',
    '''  function chooseGroup(groupId: LocalServiceGroup["id"]) {
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
  }''',
)
replace_once(
    path,
    '''  function toggleSaved(provider: LocalProvider) {
    setSavedProviders(toggleSavedLocalProvider(parcel.id, provider));
  }

  return (''',
    '''  function toggleSaved(provider: LocalProvider) {
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

  return (''',
)
replace_once(
    path,
    '''            Find local professionals, services, and property connections that may help you move this
            erf forward. Easy Erf prioritizes categories using the property state and available erf
            context.''',
    '''            Choose the service you need and Easy Erf will return up to three relevant Google results
            around the confirmed Market address. Results are not based on the erf number or parcel label.''',
)
replace_once(
    path,
    '''          <div className="font-semibold text-[#0D1B2A]">{stateLabel}</div>
          <div className="mt-1">{locationLabel}</div>
          <div className="mt-2">{savedProviders.length} provider{savedProviders.length === 1 ? "" : "s"} saved</div>''',
    '''          <div className="font-semibold text-[#0D1B2A]">Searching around</div>
          <div className="mt-1">{locationLabel}</div>
          <button
            type="button"
            onClick={onOpenMarket}
            className="mt-2 font-semibold text-[#B24A00] underline underline-offset-2"
          >
            Change address in Market
          </button>
          <div className="mt-2">{stateLabel} · {savedProviders.length} provider{savedProviders.length === 1 ? "" : "s"} saved</div>''',
)

# Remove the two now-unused location helpers from the import list.
text = Path(path).read_text()
text = text.replace('  buildGoogleMapsFallbackUrl,\n', '')
text = text.replace('  localServiceLocationLabel,\n', '')
Path(path).write_text(text)


# Workbench: pass the already-loaded Market address and a real navigation callback.
path = "src/components/property/OfficialParcelPanel.tsx"
replace_once(
    path,
    '  const { propertyIdentity, marketAddressIntelligence } = useSavedMarketEvidence(parcelId);',
    '''  const {
    loading: marketAddressLoading,
    propertyIdentity,
    marketAddressIntelligence,
  } = useSavedMarketEvidence(parcelId);''',
)
replace_once(
    path,
    '''            <LocalPropertyTeam
              parcel={normalizedParcel}
              siteMode={workspaceState.sitePotential.mode}
            />''',
    '''            <LocalPropertyTeam
              parcel={normalizedParcel}
              siteMode={workspaceState.sitePotential.mode}
              marketAddress={savedMarketAddress}
              marketAddressLoading={marketAddressLoading}
              onOpenMarket={() => selectWorkbenchTab("listings", { markStarted: true })}
            />''',
)


# Server route: require the saved address and use it as the Google query location.
path = "src/routes/api/local-services.search.ts"
replace_once(
    path,
    '''  latitude?: unknown;
  longitude?: unknown;
  suburb?: unknown;
  town?: unknown;
  municipality?: unknown;
  province?: unknown;
  widerArea?: unknown;''',
    '''  address?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  widerArea?: unknown;''',
)
replace_once(
    path,
    '''  const latitude = finiteNumber(body.latitude);
  const longitude = finiteNumber(body.longitude);''',
    '''  const address = cleanText(body.address);
  if (!address) {
    return json(
      {
        success: false,
        code: "address_required",
        error: "Add or confirm the property address in Market before searching for local providers.",
      },
      400,
    );
  }

  const latitude = finiteNumber(body.latitude);
  const longitude = finiteNumber(body.longitude);''',
)
replace_once(
    path,
    '''  const location = uniqueLocation([
    cleanText(body.suburb),
    cleanText(body.town),
    cleanText(body.municipality),
    cleanText(body.province),
    "South Africa",
  ]);
  const textQuery = [category.searchQuery, location ? `near ${location}` : null]
    .filter(Boolean)
    .join(" ");''',
    '''  const textQuery = [category.searchQuery, `near ${address}`].join(" ");''',
)
replace_once(path, '    location.toLowerCase(),', '    address.toLowerCase(),')
text = Path(path).read_text()
text = text.replace('function uniqueLocation(parts: string[]) {\n  return parts.filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(", ");\n}\n\n', '')
Path(path).write_text(text)


# Tests: use a confirmed address and prove parcel labels are not the search location.
path = "src/lib/localServices/__tests__/server.test.ts"
text = Path(path).read_text()
text = text.replace(
    'request({ categoryId: "estate-agents", latitude: -34.1, longitude: 24.8 })',
    'request({ categoryId: "estate-agents", address: "8 Harbour Drive, St Francis Bay", latitude: -34.1, longitude: 24.8 })',
)
text = text.replace(
    '''        latitude: -34.1,
        longitude: 24.8,
        suburb: "Sea Vista",
        municipality: "Kouga Local Municipality",''',
    '''        address: "8 Harbour Drive, St Francis Bay, Eastern Cape",
        latitude: -34.1,
        longitude: 24.8,''',
)
marker = '''  it("rejects unknown categories instead of becoming an open Google proxy", async () => {'''
address_test = '''  it("requires the saved Market address before provider search", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    const response = await handleLocalServicesSearchRequest(
      request({ categoryId: "estate-agents", latitude: -34.1, longitude: 24.8 }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("address_required");
  });

'''
if address_test not in text:
    if marker not in text:
        raise SystemExit("Server test insertion marker not found")
    text = text.replace(marker, address_test + marker, 1)
text = text.replace(
    '    expect(JSON.parse(String(options?.body)).pageSize).toBe(3);',
    '''    const googleBody = JSON.parse(String(options?.body));
    expect(googleBody.pageSize).toBe(3);
    expect(googleBody.textQuery).toContain("near 8 Harbour Drive, St Francis Bay, Eastern Cape");
    expect(googleBody.textQuery).not.toContain("Kouga Local Municipality");''',
)
Path(path).write_text(text)


path = "src/components/property/__tests__/dossierUx.test.ts"
text = Path(path).read_text()
needle = '''    expect(localTeam).toContain("Search wider area");
    expect(localTeam).toContain("Results are sourced from Google");'''
replacement = '''    expect(localTeam).toContain("Search wider area");
    expect(localTeam).toContain("Add the property address first");
    expect(localTeam).toContain("Go to Market and update address");
    expect(localTeam).toContain("Change address in Market");
    expect(localTeam).toContain("marketAddress.formattedAddress");
    expect(localTeam).toContain("onOpenMarket");
    expect(localTeam).toContain("Results are sourced from Google");'''
if needle not in text:
    raise SystemExit("Dossier Local Property Team test marker not found")
text = text.replace(needle, replacement, 1)
needle = '''    expect(serverRoute).toContain("pageSize: 3");
    expect(serverRoute).toContain('place.businessStatus !== "CLOSED_PERMANENTLY"');'''
replacement = '''    expect(serverRoute).toContain("pageSize: 3");
    expect(serverRoute).toContain("address_required");
    expect(serverRoute).toContain('`near ${address}`');
    expect(serverRoute).not.toContain("cleanText(body.suburb)");
    expect(serverRoute).toContain('place.businessStatus !== "CLOSED_PERMANENTLY"');'''
if needle not in text:
    raise SystemExit("Dossier server route test marker not found")
Path(path).write_text(text.replace(needle, replacement, 1))
