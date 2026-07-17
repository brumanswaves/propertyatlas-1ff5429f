import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("official dossier UX guardrails", () => {
  it("keeps the map homepage hero readable and removes public demo search results", () => {
    const home = read("src/routes/index.tsx");
    const search = read("src/components/map/SearchBar.tsx");
    const autocomplete = read("src/lib/search/addressAutocomplete.ts");
    const nav = read("src/components/layout/TopNav.tsx");

    expect(home).toContain("BRAND.site");
    expect(nav).toContain("Easy Erf");
    expect(home).toContain("Every erf. All the facts.");
    expect(home).toContain("Research any");
    expect(home).toContain("South African erf.");
    expect(home).toContain("officialParcels={officialParcelIndex}");
    expect(home).toContain("onOpenOfficialWorkbench={handleOfficialSearchPick}");
    expect(home).toContain("onHighlightOfficialFromSearch={handleOfficialSearchHighlight}");
    expect(home).toContain("addressSearchTarget={addressSearchTarget}");
    expect(home).toContain("searchHighlightOfficialParcel={searchHighlight}");
    expect(home).toContain('searchHighlightStatus === "fallback"');
    expect(home).toContain("handleLogoHomeClick");
    expect(home).toContain("onLogoClick={handleLogoHomeClick}");
    expect(home).toContain("setSelectedOfficial(null)");
    expect(home).toContain("setSelectedId(null)");
    expect(home).toContain("headerSubtitle");
    expect(home).not.toContain("max-w-xl rounded-[1.35rem]");
    expect(nav).toContain("fixed inset-x-0 top-0 z-[70]");
    expect(nav).toContain("bg-[#06152A]/85");
    expect(nav).toContain("pt-[calc(env(safe-area-inset-top)+0.5rem)]");
    expect(nav).toContain("hidden rounded-xl");
    expect(nav).toContain("center?: ReactNode");
    expect(nav).toContain("mobileCenter?: ReactNode");
    expect(nav).toContain("onLogoClick?: () => void");
    expect(nav).toContain("onClick={onLogoClick}");
    expect(nav).toContain('aria-label="Easy Erf home"');
    expect(nav).toContain("w-[148px]");
    expect(nav).toContain('variant="horizontal"');
    expect(nav).toContain("h-[24px] w-auto");
    expect(nav).toContain("md:h-[26px]");
    expect(nav).toContain("max-w-[1600px]");
    expect(search).toContain("Search address, erf number, suburb, LPI, or parcel key");
    expect(search).toContain("Address Search");
    expect(search).toContain("Erf Search");
    expect(search).toContain("Search by street address or place name.");
    expect(search).toContain(
      "Search by Deeds Office, township, erf number, portion, LPI, or parcel key.",
    );
    expect(search).toContain("loadPilotParcelRegistry");
    expect(search).toContain("searchPilotParcelRegistry");
    expect(search.indexOf("searchPilotParcelRegistry")).toBeLessThan(
      search.indexOf("searchOfficialParcels(submittedErfQuery"),
    );
    expect(search).toContain("Kouga / St Francis pilot registry");
    expect(search).toContain("No indexed pilot parcel match found");
    expect(search).toContain("Pilot registry loaded:");
    expect(search).toContain("Google address suggestion");
    expect(search).toContain("fetchAddressAutocompleteSuggestions");
    expect(search).toContain("fetchAddressPlaceDetails");
    expect(search).toContain("isAddressAutocompleteConfigured");
    expect(search).toContain("searchByCoordinate");
    expect(search).toContain("Checking official parcel match...");
    expect(search).toContain("Address matched to official parcel");
    expect(search).toContain("Likely nearby parcel match");
    expect(search).toContain("Highlight erf on map");
    expect(search).toContain("Open Workbench");
    expect(search).toContain(
      "Address found, but no official parcel boundary match was found for this",
    );
    expect(search).toContain("Selecting this zooms to the coordinate");
    expect(search).toContain("Address suggestions are temporarily unavailable.");
    expect(search).toContain(
      "Address autocomplete is not configured yet. Add VITE_GOOGLE_MAPS_API_KEY",
    );
    expect(search).toContain("Address Search");
    expect(search).toContain("Erf Search");
    expect(search).toContain("Deeds Office");
    expect(search).toContain("Township / area");
    expect(search).toContain("Erf number");
    expect(search).toContain("Portion number, default 0");
    expect(search).toContain("LPI or parcel key");
    expect(search).toContain("Search official parcel identity");
    expect(search).toContain("searchOfficialPublicParcelsByIdentity");
    expect(search).toContain("Checking broader official data");
    expect(search).toContain("No indexed pilot parcel match found");
    expect(search).toContain("typed township/area");
    expect(search).toContain("Suggested from loaded map area");
    expect(search).toContain("loadedAreaTerms");
    expect(search).toContain("Registry label:");
    expect(search).toContain("selectedOfficeHasLoadedCoverage");
    expect(search).toContain("Erf numbers repeat across South Africa");
    expect(search).toContain("confidenceLabel");
    expect(search).toContain("erfResults.length === 0");
    expect(search).toContain("z-[90]");
    expect(search).toContain("max-h-[min(74vh,34rem)]");
    expect(search).toContain("click the parcel outline");
    expect(search).not.toMatch(/national erf search/i);
    expect(search).not.toMatch(/global erf search/i);
    expect(search).not.toContain("PROPERTIES");
    expect(search).not.toContain("Show pilot demo examples");
    expect(search).not.toContain("Hide pilot demo examples");
    expect(search).not.toContain("Optional pilot examples");
    expect(search).not.toContain("Demo records are secondary");
    expect(search).not.toContain("Pilot demo example");
    expect(search).not.toContain("Official parcel search");
    expect(search).not.toContain("Searching inside visible map area");
    expect(autocomplete).toContain("VITE_GOOGLE_MAPS_API_KEY");
    expect(autocomplete).toContain("places.googleapis.com/v1/places:autocomplete");
    expect(autocomplete).toContain('includedRegionCodes: ["za"]');
    expect(autocomplete).toContain("trimmed.length < 3");
    expect(autocomplete).not.toContain("AIza");
    expect(home).not.toContain("<FilterPanel");
    expect(home).not.toContain("<MapLegend");
    expect(home).not.toContain("<FooterMini");
    expect(home).not.toContain("<AddPropertyDialog");
    expect(home).not.toContain("Add property");
    expect(home).not.toContain("onClick={() => setAddOpen(true)}");
    expect(home).toContain("showHomeMapStatusCard = false");
    expect(home).toContain("{showHomeMapStatusCard && (");
  });

  it("keeps search highlight separate from immediate Workbench opening", () => {
    const home = read("src/routes/index.tsx");
    const map = read("src/components/map/MapCanvas.tsx");
    const search = read("src/components/map/SearchBar.tsx");

    expect(search).toContain("onHighlightOfficialFromSearch");
    expect(search).toContain("onLocateAddress");
    expect(search).toContain("onHighlightOfficialFromSearch?.(officialMatch)");
    expect(search).not.toContain("onOpenOfficialWorkbench?.(officialMatch)");
    expect(search).toContain("event.stopPropagation()");
    expect(search).toContain("onOpenOfficialWorkbench?.(result)");
    expect(home).toContain("handleOfficialSearchHighlight");
    expect(home).toContain("Click the highlighted erf to open the Workbench.");
    expect(home).toContain("Boundary highlight unavailable until the layer loads.");
    expect(map).toContain("searchHighlightOfficialParcel");
    expect(map).toContain("findMatchingSearchHighlightFeature");
    expect(map).toContain("searchHighlightMarkerRef");
    expect(map).toContain("map.fitBounds(searchHighlightOfficialParcel.bounds");
    expect(map).toContain(
      "map.setFeatureState({ source: match.layer, id: match.feature.id }, { selected: true })",
    );
    expect(map).not.toContain("onSelectOfficial?.(searchHighlightOfficialParcel");
  });

  it("renders locate me without storing precise user location", () => {
    const home = read("src/routes/index.tsx");
    const map = read("src/components/map/MapCanvas.tsx");

    expect(home).toContain("Locate me");
    expect(home).toContain("top-[calc(env(safe-area-inset-top)+8.75rem)]");
    expect(home).toContain("sm:top-[calc(env(safe-area-inset-top)+10.5rem)]");
    expect(home).toContain("md:top-[6.25rem]");
    expect(home).toContain("w-full max-w-[18rem]");
    expect(home).toContain("sm:w-auto sm:max-w-none");
    expect(home).toContain("overflow-visible");
    expect(home).not.toContain("rounded-2xl border border-[#0D1B2A]/8 bg-[#fbf8f1]/90");
    expect(home).toContain("locateRequestId");
    expect(home).toContain("onLocateResult={setLocateMessage}");
    expect(map).toContain("navigator.geolocation.getCurrentPosition");
    expect(map).toContain(
      "Location permission was not granted. You can still search by address, suburb, erf number, LPI, or parcel key.",
    );
    expect(map).toContain("position.coords.accuracy");
    expect(map).toContain("Location accuracy: about");
    expect(map).toContain(
      "Approximate location. Search or click a parcel for official erf research.",
    );
    expect(map).toContain("map.flyTo({");
    expect(map).toContain("center: lngLat");
    expect(map).not.toContain('localStorage.setItem("userLocation');
    expect(map).not.toContain("supabase.from");
  });

  it("keeps home map controls clean and layers overflow-safe", () => {
    const home = read("src/routes/index.tsx");
    const layers = read("src/components/map/LayerSwitcher.tsx");

    expect(home).toContain("Locate me");
    expect(home).toContain("<LayerSwitcher");
    expect(home).not.toContain("<FilterPanel");
    expect(home).not.toContain("<MapLegend");
    expect(home).not.toContain("<FooterMini");
    expect(home).not.toContain("Add property");
    expect(layers).toContain("relative z-50 shrink-0");
    expect(layers).toContain("items-center justify-center");
    expect(layers).toContain("w-[min(calc(100vw-1rem),20rem)]");
    expect(layers).toContain("overflow-x-hidden");
    expect(layers).toContain("z-[90]");
    expect(layers).toContain("activeLayers");
    expect(layers).not.toContain("min-w-[6.5rem] flex-1 sm:flex-none");
  });

  it("uses the left rail as the only primary workbench navigation", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("fixed inset-0");
    expect(panel).toContain("Workbench rail");
    expect(panel).toContain("Erf Workbench");
    expect(panel).toContain("Back to full map");
    expect(panel).toContain('label: "Overview"');
    expect(panel).toContain('label: "Market"');
    expect(panel).toContain('label: "Strategy"');
    expect(panel).toContain('label: "Sources"');
    expect(panel).toContain('label: "Paid Reports"');
    expect(panel).toContain('label: "Notes"');
    expect(panel).toContain('label: "Site Potential"');
    expect(panel).toContain('label: "Easy Erf Report"');
    expect(panel).toContain('label: "Local Services"');
    expect(panel.indexOf('label: "Market"')).toBeLessThan(panel.indexOf('label: "Strategy"'));
    expect(panel.indexOf('label: "Strategy"')).toBeLessThan(
      panel.indexOf('label: "Site Potential"'),
    );
    expect(panel.indexOf('label: "Site Potential"')).toBeLessThan(
      panel.indexOf('label: "Easy Erf Report"'),
    );
    expect(panel.indexOf('label: "Easy Erf Report"')).toBeLessThan(
      panel.indexOf('label: "Local Services"'),
    );
    expect(panel).toContain("WORKBENCH_NAV.map");
    expect(panel).not.toContain("TABS.map");
    expect(panel).not.toContain("Listings & Comps</button>");
    expect(panel).toContain('tab === "research"');
    expect(panel).toContain('view="research"');
    expect(panel).toContain('tab === "listings"');
    expect(panel).toContain('view="listings"');
    expect(panel).toContain('tab === "reports"');
    expect(panel).toContain('view="reports"');
    expect(panel).toContain('tab === "calculators"');
    expect(panel).toContain('view="calculators"');
    expect(panel).toContain('tab === "notes"');
    expect(panel).toContain('view="notes"');
    expect(panel).toContain('tab === "stoep-report"');
    expect(panel).toContain('view="stoep-report"');
    expect(panel).toContain('tab === "local-services"');
  });

  it("shows an interactive selected erf mini map without faking parcel precision", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("Selected erf map");
    expect(panel).toContain("SelectedErfMiniMap");
    expect(panel).toContain("new mapboxgl.Map");
    expect(panel).toContain("MINI_MAP_STYLE");
    expect(panel).toContain("map.addControl(new mapboxgl.NavigationControl");
    expect(panel).toContain("cooperativeGestures: true");
    expect(panel).toContain("Interactive selected-erf map for");
    expect(panel).not.toContain("absolute inset-x-3 top-3 rounded-xl bg-white/86");
    expect(panel).toContain("Pan and zoom to view the erf in area context");
    expect(panel).toContain("new mapboxgl.Marker");
    expect(panel).not.toContain("satellite-streets-v12/static");
    expect(panel).not.toContain("Static selected-erf map preview");
    expect(panel).not.toContain("interactive: false");
    expect(panel).toContain("h-64 min-h-[13rem]");
    expect(panel).toContain("Loading interactive selected-erf map");
    expect(panel).toContain("setMapLoaded");
    expect(panel).toContain("mapFailed");
    expect(panel).toContain("Interactive map could not render");
    expect(panel).toContain("Interactive map unavailable");
    expect(panel).toContain("Map context unavailable");
    expect(panel).toContain("Approximate selected-erf context");
    expect(panel).toContain("Approximate map context from selected parcel click");
    expect(panel).toContain("No parcel boundary or GIS precision");
    expect(panel).toContain("Coordinates are approximate");
    expect(panel).toContain("Coordinates");
    expect(panel).toContain("formatMapCoordinate");
    expect(panel).toContain("formatAreaM2");
    expect(panel).toContain("Open in Google Maps");
    expect(panel).toContain("googleMapsCoordinateUrl");
    expect(panel).toContain("https://www.google.com/maps/@");
    expect(panel).toContain("Back to full map");
    expect(panel).toContain("onBackToMap={handleBackToMap}");
    expect(panel).toContain("map.remove()");
    expect(panel).not.toContain("onSelectOfficial");
  });

  it("adds a real official identity verification workflow before source links", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("Official parcel identity check");
    expect(panel).toContain("Easy Erf Steps / Step 1");
    expect(panel).toContain("Parcel identity");
    expect(panel).toContain("Official identifiers");
    expect(panel).toContain("Map context");
    expect(panel).toContain("Parcel size / area");
    expect(panel).toContain("hasParcelArea ?");
    expect(panel).toContain("Boundary status");
    expect(panel).toContain("Boundary shown on map from selected public parcel layer");
    expect(panel).toContain("I checked this source");
    expect(panel).toContain("Identity looks correct");
    expect(panel).toContain("Identity uncertain");
    expect(panel).toContain("Copy parcel identifiers");
    expect(panel).toContain("Copy LPI");
    expect(panel).toContain("Copy parcel key");
    expect(panel).toContain("Copy coordinates");
    expect(panel).toContain("Copy CSG search details");
    expect(panel).toContain("CSG Property Viewer");
    expect(panel).toContain("Kouga Public Map");
    expect(panel).toContain("SG document list");
    expect(panel).toContain("Open SG document list");
    expect(panel.match(/Open SG document list/g) ?? []).toHaveLength(1);
    expect(panel).toContain("download the diagram");
    expect(panel).toContain("SG Diagram / Official Parcel Diagram");
    expect(panel).not.toContain("SG Diagram Evidence");
    expect(panel).not.toContain('name: "SG document list"');
    expect(panel).toContain("The SG diagram is the official parcel diagram / plot map");
    expect(panel).toContain("Upload SG files");
    expect(panel).toContain("multiple");
    expect(panel).toContain(".pdf,.png,.jpg,.jpeg,.tif,.tiff");
    expect(panel).toContain("cloud vault");
    expect(panel).toContain("Not attached");
    expect(panel).toContain(
      "Stored in the private cloud Erf File Vault for this signed-in user and parcel.",
    );
    expect(panel).toContain("User uploaded SG diagram");
    expect(panel).toContain("Open signed file");
    expect(panel).toContain("Remove attachment");
    expect(panel).toContain("is too large for the Erf File Vault");
    expect(panel).toContain("Automatic SG import is not enabled yet");
    expect(panel).toContain("No SG diagram attached yet");
    expect(panel).toContain("SG diagram file saved to the Erf File Vault");
    expect(panel).toContain("SG diagram files saved to the Erf File Vault");
    expect(panel).toContain("Deeds registry guidance");
    expect(panel).toContain("Not opened");
    expect(panel).toContain("Opened");
    expect(panel).toContain("Reviewed");
    expect(panel).toContain("Unavailable");
    expect(panel).toContain("Mark reviewed");
    expect(panel).toContain("Source unavailable");
    expect(panel).toContain("SG document list not available for this erf yet");
    expect(panel).toContain("not a guaranteed per-erf deep link");
    expect(panel).toContain("CSG may open at the national viewer");
    expect(panel).toContain("Use the copied identifiers or coordinates");
    expect(panel).toContain("Official government guidance for deeds registry information");
    expect(panel).toContain("GOVZA_DEEDS_GUIDANCE_URL");
    expect(panel).not.toContain("Open DeedsWeb");
    expect(panel).not.toContain('href=""');
    expect(panel).not.toMatch(/automatic SG document import is enabled|automatically fetch/i);
    expect(panel).toContain("Source layer");
    expect(panel).toContain("Source quality");
    expect(panel).toContain("Township / area");
    expect(panel).toContain("User checked, not legally verified");
    expect(panel).toContain("it is not legal, surveying or ownership verification");
    expect(panel).toContain("erfstoep.identityCheck.");
    expect(panel).toContain("openedSourceIds");
    expect(panel).toContain("reviewedSourceIds");
    expect(panel).toContain("sgDiagramAttachmentCount");
    expect(panel).toContain("markSourceOpened");
    expect(panel).toContain("markSourceReviewed");
    expect(panel).toContain("window.localStorage.setItem(identityStatusKey(parcelId), nextStatus)");
    expect(panel).toContain("identityStatusToWorkspace");
    expect(panel).toContain("buildWorkbenchPageNextStep");
    expect(panel).toContain("Needs verification");
    expect(panel).toContain("Checked by user");
    expect(panel).toContain("Looks correct, user checked");
    expect(panel).toContain("Uncertain");
    expect(panel).toContain("Selected: I checked this source");
    expect(panel).toContain("Selected: Identity looks correct");
    expect(panel).toContain("Selected: Identity uncertain");
  });

  it("keeps paid providers out of the official identity checklist", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");
    const checklistStart = panel.indexOf("Official parcel identity check");
    const checklistEnd = panel.indexOf("function OfficialParcelPanel");
    const checklist = panel.slice(checklistStart, checklistEnd);

    expect(checklist).not.toContain("Lightstone");
    expect(checklist).not.toContain("WinDeed");
    expect(panel).toContain('title: "Paid Reports"');
    expect(panel).toContain("Upload Lightstone, WinDeed, SG, zoning, title deed");
  });

  it("clarifies the active workbench section and keeps overview as the only first-read section", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("WORKBENCH_SECTIONS");
    expect(panel).toContain("Current erf file");
    expect(panel).toContain("buildWorkbenchIdentityLine");
    expect(panel).toContain(
      "Working address is stored separately from the official parcel identity.",
    );
    expect(panel).toContain("Workbench / {activeSection.title}");
    expect(panel).toContain('title: "Overview"');
    expect(panel).toContain(
      "Start with the first read, evidence readiness, and the recommended next step.",
    );
    expect(panel).toContain('title: "Official Sources"');
    expect(panel).toContain("Check public records and source links tied to this erf.");
    expect(panel).toContain('title: "Market Evidence"');
    expect(panel).toContain("Build listing, comp, and local market evidence for this erf.");
    expect(panel).toContain('title: "Paid Reports"');
    expect(panel).toContain(
      "Upload Lightstone, WinDeed, SG, zoning, title deed, or other source documents.",
    );
    expect(panel).toContain('title: "Strategy Lab"');
    expect(panel).toContain(
      "Run the numbers before deciding whether to buy, hold, flip, or build.",
    );
    expect(panel).toContain('title: "Notes"');
    expect(panel).toContain("Capture your research, questions, and decision notes.");
    expect(panel).toContain('title: "Easy Erf Report"');
    expect(panel).toContain("Assemble the final report from saved identity");
    expect(panel).toContain("!isOverview && (");
    expect(panel).toContain("<ReportBuilderOverview");
    expect(panel).toContain("parcel={normalizedParcel}");
    expect(panel).toContain("workspaceState={workspaceState}");
    expect(panel).toContain("onSelectView={(view)");
    expect(panel).toContain("{activeSection.guidance}");
    expect(panel).not.toContain("guidanceTitle");
    expect(panel).not.toContain("Comp-building guidance");
    expect(panel).not.toContain("Paid report guidance");
    expect(panel).not.toContain("Source-check guidance");
    expect(panel).toContain("{isOverview && (");
  });

  it("keeps mobile official parcel close and save controls visible", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("h-[100dvh]");
    expect(panel).toContain("max-md:pt-[calc(env(safe-area-inset-top)+0.75rem)]");
    expect(panel).toContain("Save erf");
    expect(panel).toContain("Back to map");
    expect(panel).toContain("Back to full map");
    expect(panel).toContain("Mobile Workbench navigation");
    expect(panel).toContain("mobile-workbench-nav");
    expect(panel).toContain("overflow-x-auto");
    expect(panel).toContain("onClick={() => selectWorkbenchTab(item.id)}");
    expect(panel).toContain('aria-current={active ? "page" : undefined}');
    expect(panel).toContain("workspaceState.saved");
    expect(panel).toContain("Saved / unsaved changes");
    expect(panel).toContain('"Unsaved"');
    expect(panel).toContain("handleBackToMap");
    expect(panel).toContain("min-h-11");
    expect(panel).toContain("sticky top-0 z-30");
  });

  it("surfaces Easy Erf intelligence immediately on official map click", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");
    const reportBuilder = read("src/components/property/dossier/ReportBuilderOverview.tsx");
    const reportProgress = read("src/lib/workbench/reportProgress.ts");
    const workspace = read("src/lib/workbench/erfWorkspaceState.ts");

    expect(panel).toContain("ownership, transfer, and deeds-level context");
    expect(panel).toContain("<ReportBuilderOverview");
    expect(panel).toContain("Enhance this erf file");
    expect(panel).toContain("Add Lightstone or WinDeed report documents");
    expect(panel).toContain("Public sources still");
    expect(panel).toContain("Add report documents");
    expect(panel).toContain('onClick={() => selectWorkbenchTab("reports", { markStarted: true })}');
    expect(panel).toContain("bg-[linear-gradient(135deg,#FF6A00_0%,#B64A09_45%,#0D1B2A_100%)]");
    expect(reportBuilder).toContain("Easy Erf Report Builder");
    expect(reportBuilder).toContain("Report progress");
    expect(reportBuilder).toContain("This erf file becomes one final report.");
    expect(reportBuilder).toContain("buildReportBuilderProgress");
    expect(reportBuilder).toContain("buildReportActionCards");
    expect(reportBuilder).toContain("About this erf");
    expect(reportBuilder).toContain("Recommended next step");
    expect(reportBuilder).toContain("ProgressRing");
    expect(reportBuilder).toContain("rows.map");
    expect(reportBuilder).toContain("onClick={() => step && onSelectView?.(step.view)}");
    expect(reportBuilder).toContain("group-hover:translate-x-0.5");
    expect(reportBuilder).toContain("{row.label}");
    expect(reportBuilder).toContain("{row.status}");
    expect(reportBuilder).toContain("{actionCards[0].title}");
    expect(reportBuilder).toContain("{actionCards[1].title}");
    expect(reportBuilder).toContain("{actionCards[2].title}");
    expect(reportBuilder).toContain("{actionCards[3].title}");
    expect(reportBuilder).toContain('view: "stoep-report"');
    expect(reportBuilder).toContain("Open Easy Erf Report");
    expect(reportProgress).toContain('title: "Verify the erf"');
    expect(reportProgress).toContain('action: "Check official identity"');
    expect(reportProgress).toContain('tab: "research"');
    expect(reportProgress).toContain('title: "Add evidence"');
    expect(reportProgress).toContain('action: "Add market evidence"');
    expect(reportProgress).toContain('tab: "listings"');
    expect(reportProgress).toContain('title: "Run numbers"');
    expect(reportProgress).toContain('action: "Open calculator"');
    expect(reportProgress).toContain('tab: "calculators"');
    expect(reportProgress).toContain('title: "Create report"');
    expect(reportProgress).toContain(
      'action: siteMissing ? "Open Site Potential" : "Open Easy Erf Report"',
    );
    expect(reportProgress).toContain('tab: siteMissing ? "site-potential" : "stoep-report"');
    expect(panel).toContain("WorkbenchNextStep");
    expect(panel).toContain("Next best step");
    expect(panel).toContain("Review uploaded files");
    expect(panel).toContain("paidReportCount > 0");
    expect(panel).not.toContain("Mini report");
    expect(panel).not.toContain('["Identity", "Checked", "text-emerald-700"]');
    expect(panel).not.toContain('["Evidence", "2 sources", "text-[#0D1B2A]"]');
    expect(panel).not.toContain('["Market", "Needs comps", "text-[#9A4A09]"]');
    expect(panel).not.toContain('["Strategy", "Not started", "text-[#64748B]"]');
    expect(panel).toContain(
      "Optional confidence upgrades. Buy a report or upload a PDF you already purchased; the",
    );
    expect(panel).not.toContain("What do you want to understand first?");
    expect(panel).not.toContain("Current StoepStep");
    expect(panel).not.toContain("Easy Erf Steps progress");
    expect(panel).toContain("Opened. Mark reviewed after checking the details.");
    expect(panel).toContain("Reviewed by user. This records progress, not legal verification.");
    expect(panel).toContain("Identity marked as looking correct. Next: build market evidence.");
    expect(panel).toContain(
      "Identity marked uncertain. Resolve identity before using market or strategy tools.",
    );
    expect(panel).toContain(
      "Market step started. Save a listing, comp, address or note to move toward Strategy.",
    );
    expect(panel).toContain("Buy a report");
    expect(panel).toContain("Upload report PDF");
    expect(panel).toContain("free");
    expect(panel).toContain("workflow still works");
    expect(panel).toContain("Erf File");
    expect(panel).toContain("Saved / unsaved changes");
    expect(panel).toContain("saveErfFile");
    expect(panel).toContain("shareErfFile");
    expect(panel).toContain("You made changes to this erf file. Leave without saving?");
    expect(workspace).toContain("erfstoep.workspace.");
    expect(workspace).toContain("buildStoepStepProgress");
    expect(workspace).toContain("Review the official source");
    expect(workspace).toContain("At least one official source is reviewed by user.");
    expect(workspace).toContain("Blocked / uncertain");
    expect(workspace).toContain(
      "Every comp, calculator and report depends on researching the correct erf.",
    );
    expect(panel).toContain("readErfWorkspaceState");
    expect(panel).toContain("updateErfWorkspaceState");
    expect(panel).toContain("buildWorkbenchPageNextStep");
    expect(panel).toContain("marketEvidenceStarted: true");
    expect(panel).toContain("calculatorStarted: true");
    expect(panel).toContain("reportStarted: true");
    expect(panel).toContain("Working address");
    expect(panel).toContain("User supplied market address");
    expect(panel).toContain("ReportBuilderOverview");
    expect(panel).toContain("needs evidence");
    expect(panel).toContain("ownership, transfer, and deeds-level context");
    expect(panel).not.toContain("Early consultant-style read only");
    expect(panel).not.toContain("Open full dossier");
    expect(panel).not.toMatch(/ownership verified|valuation verified|zoning verified/i);
    expect(panel).not.toMatch(/PDF extraction|listing scraping|auto-fill/i);
    expect(panel).toContain('{tab === "overview" && null}');
    expect(panel).toContain("bg-[#FF6A00]");
    expect(panel).not.toContain("bg-[radial-gradient");
    expect(panel).toContain("selectWorkbenchTab");
    expect(panel).toContain("border-b border-[#0D1B2A]/10");
  });

  it("marks source actions checked in local session state", () => {
    const dossier = read("src/components/property/ErfResearchDossier.tsx");

    expect(dossier).toContain("completedSourceIds");
    expect(dossier).toContain("setCompletedSourceIds");
    expect(dossier).not.toContain("Best next actions");
    expect(dossier).not.toContain("Market Evidence Search Builder");
    expect(dossier).not.toContain('section.id === "listings-market"');
    expect(dossier).toContain("Checked");
  });

  it("renders the listings and comps tab and BRRRR explanation", () => {
    const dossier = read("src/components/property/ErfResearchDossier.tsx");
    const strategyLab = read("src/components/property/strategy/StrategyLab.tsx");
    const marketEvidence = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");
    const importer = read("src/features/marketEvidence/listingImporter/ListingUrlImporter.tsx");
    const marketEvidenceHook = read("src/features/marketEvidence/hooks/useSavedMarketEvidence.ts");

    expect(dossier).toContain("Listings & Comps");
    expect(dossier).toContain("<StrategyLab");
    expect(dossier).toContain('onOpenReport={() => onSelectView?.("stoep-report")}');
    expect(strategyLab).toContain("Choose a strategy, adjust the assumptions");
    expect(strategyLab).toContain("Buy and hold rental");
    expect(strategyLab).toContain("Development to rent");
    expect(strategyLab).toContain("STR / Airbnb");
    expect(strategyLab).toContain("Land bank / hold vacant land");
    expect(strategyLab).toContain("Scenario chosen");
    expect(strategyLab).toContain("Choose another scenario");
    expect(strategyLab).toContain("Save as chosen scenario");
    expect(strategyLab).toContain("Continue to Easy Erf Report");
    expect(marketEvidence).toContain("Active listing for this erf");
    expect(marketEvidence).toContain("Import active listing for this erf");
    expect(marketEvidence).toContain("Import comparable listing or sale");
    expect(marketEvidence).toContain("Market Address");
    expect(marketEvidence).toContain("Add manual evidence");
    expect(marketEvidence).toContain("No confirmed street address yet");
    expect(marketEvidence).toContain("Fallback Search Tools");
    expect(marketEvidence).toContain("Saved Market Evidence");
    expect(marketEvidence).toContain("Comp summary");
    expect(marketEvidenceHook).toContain("erfstoep:market-evidence-updated");
    expect(strategyLab).toContain("Buy, renovate, rent, refinance");
  });

  it("renders the Easy Erf intelligence dashboard shell without fake paid data", () => {
    const dossier = read("src/components/property/ErfResearchDossier.tsx");
    const reportBuilder = read("src/components/property/dossier/ReportBuilderOverview.tsx");
    const panel = read("src/components/property/OfficialParcelPanel.tsx");
    const reportsTab = read("src/components/property/tabs/ReportsTab.tsx");
    const workspaceFiles = read("src/lib/workbench/erfWorkspaceFiles.ts");
    const vaultFiles = read("src/lib/workbench/erfFileVault.ts");
    const sitePotential = read("src/components/property/dossier/SitePotentialTab.tsx");
    const sitePotentialIntegrityMigration = read(
      "supabase/migrations/20260713100000_repair_site_potential_security_jobs.sql",
    );

    expect(dossier).toContain("ReportBuilderOverview");
    expect(reportBuilder).toContain("Easy Erf Report Builder");
    expect(reportBuilder).toContain("This erf file becomes one final report.");
    expect(reportBuilder).toContain("buildReportBuilderProgress");
    expect(reportBuilder).toContain("buildReportActionCards");
    expect(reportBuilder).toContain("readErfWorkspaceState");
    expect(reportBuilder).toContain("Recommended next step");
    expect(reportBuilder).toContain("Check official identity");
    expect(reportBuilder).toContain("Add market evidence");
    expect(reportBuilder).toContain("Open calculator");
    expect(reportBuilder).toContain("Open Easy Erf Report");
    expect(reportBuilder).not.toContain("0 reviewed");
    expect(reportBuilder).not.toContain("sourcesReviewed = 0");
    expect(reportBuilder).not.toContain("strategyDone = false");
    expect(dossier).toContain("Purchase Lightstone");
    expect(dossier).toContain("Purchase WinDeed");
    expect(panel).toContain("Enhance this erf file");
    expect(reportsTab).toContain("{label} report upload");
    expect(reportsTab).toContain('provider === "lightstone" ? "Lightstone" : "WinDeed"');
    expect(reportsTab).toContain(
      "Stored in the cloud Erf File Vault for reference. Extraction and AI summary are not",
    );
    expect(reportsTab).toContain("Replace PDF");
    expect(reportsTab).toContain("Remove");
    expect(reportsTab).toContain("useErfFileVault");
    expect(reportsTab).not.toContain("savePaidReportAttachment");
    expect(workspaceFiles).toContain("provider?: PaidReportProvider");
    expect(workspaceFiles).toContain("status?: ErfWorkspaceAttachmentStatus");
    expect(workspaceFiles).toContain('"uploaded_reference_only"');
    expect(vaultFiles).toContain('export const ERF_FILE_BUCKET = "erf-files"');
    expect(vaultFiles).toContain("migrateLocalWorkspaceAttachmentsToVault");
    expect(vaultFiles).toContain("createSignedUrl");
    expect(sitePotential).toContain("SITE_POTENTIAL_DISCLAIMER");
    expect(sitePotential).toContain("useErfFileVault");
    expect(sitePotential).toContain("/api/site-potential/generate");
    expect(sitePotential).toContain("generationInFlightRef");
    expect(sitePotential).toContain("activeDesignPackId");
    expect(sitePotential).toContain("assetDesignPackId(asset) === activeDesignPackId");
    expect(sitePotentialIntegrityMigration).toContain(
      "erf_site_projects_selected_design_integrity",
    );
    expect(sitePotentialIntegrityMigration).toContain("asset_row.user_id <> NEW.user_id");
    expect(sitePotentialIntegrityMigration).toContain("asset_row.parcel_id <> NEW.parcel_id");
    expect(sitePotential).toContain("GENERATION_UI_ENABLED");
    expect(sitePotential).toContain(
      "Concept generation is unavailable until secure entitlement is configured",
    );
    expect(sitePotential).toContain("Topographical survey");
    expect(sitePotential).toContain("Architectural plans");
    expect(sitePotential).toContain("Inspiration images");
    expect(sitePotential).toContain("Supporting documents");
    expect(sitePotential).toContain('uploadFiles(files, "architectural_plan")');
    expect(sitePotential).toContain('uploadFiles(files, "inspiration_image")');
    expect(sitePotential).toContain('uploadFiles(files, "other")');
    expect(sitePotential).not.toContain("Street View");
    expect(read("src/routes/api/site-potential.generate.ts")).toContain(
      "queueSitePotentialGeneration",
    );
    expect(read("src/routes/api/site-potential.generate.ts")).not.toContain(
      "requestImageGenerationWithOpenAI",
    );
    expect(read("src/lib/sitePotential/generationWorker.ts")).toContain("downloadReferenceAsset");
    expect(dossier).toContain("Uploaded files and source documents");
    expect(dossier).toContain("groupErfAssets");
    expect(dossier).toContain("workspaceAssetCategory");
    expect(dossier).toContain("getChosenStrategyScenario");
    expect(dossier).toContain("Chosen strategy scenario");
    expect(dossier).toContain("Selected property concept");
    expect(dossier).toContain("<SignedAssetPreview asset={selectedDesign} />");
    expect(dossier).toContain("Return to Site Potential");
    expect(dossier).toContain("sitePotentialSkipped");
    expect(dossier).toContain("sitePotentialReportModeLabel");
    expect(dossier).toContain("Stable asset ID");
    expect(dossier).toContain("SITE_POTENTIAL_DISCLAIMER");
    expect(dossier).toContain("newest saved scenario");
    expect(dossier).toContain("Open file");
    expect(dossier).toContain(
      "Stored in the cloud Erf File Vault for reference. Easy Erf AI extraction and PDF analysis",
    );
    expect(dossier).not.toMatch(/PDFs? (have been )?(parsed|analyzed|extracted)/i);
    expect(dossier).not.toContain("Concept image not selected");
  });

  it("hides empty market evidence/calculator dashboard sections and keeps run calculator action", () => {
    const dashboard = read("src/routes/dashboard.tsx");

    expect(dashboard).toContain("savedMarketEvidence(row).length > 0");
    expect(dashboard).not.toContain("No listing evidence saved yet");
    expect(dashboard).not.toContain("Calculators live inside each property dossier");
    expect(dashboard).toContain("Run calculator");
    expect(dashboard).toContain("tab=calc");
  });

  it("keeps saved comps storage compatible with saved market evidence", () => {
    const hook = read("src/features/marketEvidence/hooks/useSavedMarketEvidence.ts");
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(hook).toContain("savedMarketEvidence");
    expect(hook).toContain("localMarketEvidenceKey");
    expect(hook).toContain("writeLocalUserData");
    expect(hook).toContain(
      "Saved locally for this erf. Save to My Erfs to keep it in your dashboard.",
    );
    expect(hook).toContain("propertyIdentity");
    expect(hook).toContain("marketAddressIntelligence");
    expect(tab).toContain("Saved Market Evidence");
    expect(tab).toContain("Save evidence");
    expect(tab).toContain("sourceDomainFromUrl");
  });

  it("makes manual listing evidence the primary market workflow", () => {
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");
    const importer = read("src/features/marketEvidence/listingImporter/ListingUrlImporter.tsx");
    const service = read("src/features/marketEvidence/listingImporter/service.ts");
    const types = read("src/features/marketEvidence/listingImporter/types.ts");
    const route = read("src/routes/api/listings.import.ts");
    const reportsTab = read("src/components/property/tabs/ReportsTab.tsx");

    expect(importer).toContain('type ImportIntent = "active_listing" | "comparable"');
    expect(importer).toContain("importIntent: ImportIntent");
    expect(importer).toContain("Save active listing");
    expect(importer).toContain("Save comparable evidence");
    expect(importer).toContain("subject_active_listing");
    expect(importer).toContain("comparable_evidence");
    expect(importer).toContain("Easy Erf did not automatically match this listing to the erf");
    expect(importer).not.toContain("Import a property listing");
    expect(importer).not.toContain("Analyse and import");
    expect(service).toContain("importListingFromUrl");
    expect(service).toContain("POST /api/listings/import");
    expect(service).toContain("Listing import service is not connected yet");
    expect(service).toContain('"SERVICE_NOT_CONFIGURED"');
    expect(route).toContain("importListing");
    expect(route).toContain("handleListingImportRequest");
    expect(route).toContain("statusForError");
    expect(route).not.toContain('"SERVICE_NOT_CONFIGURED"');
    expect(types).toContain('| "SERVICE_NOT_CONFIGURED"');
    expect(tab).toContain("Manual evidence entry");
    expect(tab).toContain("Active listing for this erf");
    expect(tab).toContain("No active listing saved for this erf yet.");
    expect(tab).toContain("Import active listing for this erf");
    expect(tab).toContain("Paste listing URL");
    expect(tab).toContain("Analyse listing");
    expect(tab).toContain("Import comparable listing or sale");
    expect(tab).toContain("Paste comp URL");
    expect(tab).toContain("Analyse comp");
    expect(tab).toContain("listingRole");
    expect(tab).toContain("isSubjectActiveListing");
    expect(tab).toContain("comparableEvidence");
    expect(tab).toContain("includeInSummary:");
    expect(tab).toContain("Add manual evidence");
    expect(tab.match(/Add manual evidence/g)?.length).toBe(1);
    expect(importer).not.toContain("Import listing or comp evidence");
    expect(importer).not.toContain("Paste listing or comp URL");
    expect(importer).not.toContain("Analyse listing or comp");
    expect(tab).not.toContain("Add listing or comp evidence");
    expect(tab).not.toContain("Add comp");
    expect(tab).not.toContain("Find listings and comps for this erf");
    expect(tab).not.toContain('<Search className="h-3.5 w-3.5" /> Listings & Comps');
    expect(tab).toContain("Listing or comp URL required");
    expect(tab).toContain("Evidence type");
    expect(tab).toContain("Active listing");
    expect(tab).toContain("Sold comp");
    expect(tab).toContain("Nearby comp");
    expect(tab).toContain("Same street comp");
    expect(tab).toContain("Vacant land comp");
    expect(tab).toContain("Build cost evidence");
    expect(tab).toContain("Other");
    expect(tab).toContain("Detected source:");
    expect(tab).toContain("Fallback Search Tools");
    expect(importer).not.toContain("Property24 example result");
    expect(importer).not.toContain("hardcoded");
    expect(reportsTab).toContain("Report document uploads");
    expect(reportsTab).not.toContain("Paid property reports");
    expect(tab).not.toContain("Scan cached and imported listing candidates");
    expect(tab).not.toContain("Run Area Radar");
    expect(tab).not.toContain("Run Exact Radar");
    expect(tab).not.toContain("Active Listing Radar");
    expect(tab).not.toContain("Show hidden / weak candidates");
  });

  it("keeps market address autocomplete honest and marks market evidence progress on save", () => {
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(tab).toContain("Save market address");
    expect(tab).toContain(
      "Market address is used for portal matching. It does not replace official parcel data.",
    );
    expect(tab).toContain("fetchAddressAutocompleteSuggestions");
    expect(tab).toContain("fetchAddressPlaceDetails");
    expect(tab).toContain("inferAddressParts(details.formattedAddress)");
    expect(tab).toContain("Selected from Google Places autocomplete");
    expect(tab).toContain("Google Places autocomplete is not configured here");
    expect(tab).toContain("marketAddressIntelligence");
    expect(tab).toContain(
      "Street address not confirmed yet. Use area search or add a market address.",
    );
    expect(tab).toContain(
      "Saved locally for this erf. Save to My Erfs to keep it in your dashboard.",
    );
    expect(tab).toContain("marketEvidenceStarted: true");
    expect(tab).toContain("updateErfWorkspaceState(parcel.id");
    expect(tab).not.toContain("Save this erf first");
    expect(tab).not.toContain("showCompForm && savedPropertyExists");
    expect(tab).not.toContain("auto-fill portal content");
    expect(tab).not.toContain("listing scraping");
  });

  it("uses warmer simple listings and comps surfaces", () => {
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(tab).toContain("from-[#fff8ec]");
    expect(tab).toContain("border-accent/20");
    expect(tab).toContain("text-stone-950");
    expect(tab).toContain("bg-[#fff8ec]");
  });
});


describe("Local Property Team MVP guardrails", () => {
  it("connects the report to a real Local Property Team and hides purchases", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");
    const dossier = read("src/components/property/ErfResearchDossier.tsx");
    const localTeam = read("src/components/property/dossier/LocalPropertyTeam.tsx");
    const localCatalog = read("src/lib/localServices/catalog.ts");
    const sitePotential = read("src/components/property/dossier/SitePotentialTab.tsx");
    const serverRoute = read("src/routes/api/local-services.search.ts");

    expect(panel.indexOf('label: "Easy Erf Report"')).toBeLessThan(
      panel.indexOf('label: "Local Services"'),
    );
    expect(panel).toContain("<LocalPropertyTeam");
    expect(dossier).toContain("Find Local Property Team");
    expect(dossier).toContain('onSelectView?.("local-services")');
    expect(localCatalog).toContain("Plan and Build");
    expect(localCatalog).toContain("Protect and Maintain");
    expect(localCatalog).toContain("Connect the Property");
    expect(localCatalog).toContain("Buy, Sell or Manage");
    expect(localTeam).toContain("Google place result");
    expect(localTeam).toContain("Top local Google results");
    expect(localTeam).toContain("Try wider area");
    expect(localTeam).toContain("Try another service");
    expect(localTeam).toContain("Add the property address first");
    expect(localTeam).toContain("Go to Market and update address");
    expect(localTeam).toContain("Change address in Market");
    expect(localTeam).toContain("marketAddress?.formattedAddress");
    expect(localTeam).toContain("onOpenMarket");
    expect(localTeam).toContain("AbortController");
    expect(localTeam).toContain("activeRequestRef");
    expect(localTeam).toContain("isCurrentSearch");
    expect(localTeam).toContain("serviceCategory: category.id");
    expect(localTeam).toContain("parcelId: parcel.id");
    expect(localTeam).toContain("confirmedAddress: marketAddressLabel");
    expect(localTeam).toContain("Open this search in Google Maps");
    expect(localTeam).toContain("Results are sourced from Google");
    expect(localTeam).not.toContain("places.googleapis.com");
    expect(localTeam).not.toContain("GOOGLE_PLACES_API_KEY");
    expect(serverRoute).toContain("process.env.GOOGLE_PLACES_API_KEY");
    expect(serverRoute).not.toContain("VITE_GOOGLE_PLACES_API_KEY");
    expect(serverRoute).toContain("pageSize: 3");
    expect(serverRoute).toContain("MAX_PROVIDERS = 3");
    expect(serverRoute).toContain("MAX_REQUEST_BYTES");
    expect(serverRoute).toContain("buildServiceQuery(category.searchQuery, address)");
    expect(serverRoute).toContain("invalid_query");
    expect(serverRoute).toContain("places_not_configured");
    expect(serverRoute).toContain("Live Google provider results are not configured yet.");
    expect(serverRoute).toContain("address_required");
    expect(serverRoute).not.toContain("cleanText(body.suburb)");
    expect(serverRoute).toContain('place.businessStatus === "CLOSED_PERMANENTLY"');
    expect(serverRoute).toContain("seenPlaceIds");
    expect(serverRoute).toContain("seenBusinessKeys");
    expect(serverRoute).toContain("place.displayName");
    expect(serverRoute).not.toContain('"Google place result"');
    expect(sitePotential).not.toContain('id="site-potential-credits"');
    expect(sitePotential).not.toContain("Checkout connection pending");
  });
});
