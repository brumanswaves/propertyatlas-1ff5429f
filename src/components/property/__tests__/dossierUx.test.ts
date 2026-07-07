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
    expect(nav).toContain("ErfStoep");
    expect(home).toContain("Every erf. All the facts.");
    expect(home).toContain("Research any");
    expect(home).toContain("South African erf.");
    expect(home).toContain("officialParcels={officialParcelIndex}");
    expect(home).toContain("onOpenOfficialWorkbench={handleOfficialSearchPick}");
    expect(home).toContain("onHighlightOfficialFromSearch={handleOfficialSearchHighlight}");
    expect(home).toContain("addressSearchTarget={addressSearchTarget}");
    expect(home).toContain("searchHighlightOfficialParcel={searchHighlight}");
    expect(home).toContain('searchHighlightStatus === "fallback"');
    expect(home).toContain("headerSubtitle");
    expect(home).not.toContain("max-w-xl rounded-[1.35rem]");
    expect(nav).toContain("fixed inset-x-0 top-0 z-[70]");
    expect(nav).toContain("pt-[calc(env(safe-area-inset-top)+0.375rem)]");
    expect(nav).toContain("hidden rounded-xl");
    expect(nav).toContain("center?: ReactNode");
    expect(nav).toContain("mobileCenter?: ReactNode");
    expect(nav).toContain("rounded-xl");
    expect(nav).toContain("h-4 w-auto md:h-5");
    expect(nav).toContain("max-w-[1500px]");
    expect(search).toContain("Search address, erf number, suburb, LPI, or parcel key");
    expect(search).toContain("Address Search");
    expect(search).toContain("Erf Search");
    expect(search).toContain("Search by street address or place name.");
    expect(search).toContain(
      "Search by Deeds Office, township, erf number, portion, LPI, or parcel key.",
    );
    expect(search).toContain("No official parcel match found yet");
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
    expect(search).toContain("Suggested from loaded map area");
    expect(search).toContain("loadedAreaTerms");
    expect(search).toContain("Registry label:");
    expect(search).toContain("selectedOfficeHasLoadedCoverage");
    expect(search).toContain("Erf numbers repeat across South Africa");
    expect(search).toContain("confidenceLabel");
    expect(search).toContain("erfResults.length === 0");
    expect(search).toContain("z-[90]");
    expect(search).toContain("max-h-[min(74vh,34rem)]");
    expect(search).toContain("Zoom in and click a CSG or Kouga parcel");
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
    expect(home).toContain("md:top-[5.15rem]");
    expect(home).toContain("w-full max-w-[23rem]");
    expect(home).toContain("sm:w-auto sm:max-w-none");
    expect(home).toContain("overflow-x-auto");
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

  it("keeps map controls cleanly spaced on mobile", () => {
    const filters = read("src/components/map/FilterPanel.tsx");
    const layers = read("src/components/map/LayerSwitcher.tsx");

    expect(filters).toContain("relative shrink-0");
    expect(filters).toContain("items-center justify-center");
    expect(filters).not.toContain("min-w-[6.5rem] flex-1 sm:flex-none");
    expect(layers).toContain("relative shrink-0");
    expect(layers).toContain("items-center justify-center");
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
    expect(panel).toContain('label: "Reports"');
    expect(panel).toContain('label: "Notes"');
    expect(panel).toContain("WORKBENCH_NAV.map");
    expect(panel).not.toContain("TABS.map");
    expect(panel).not.toContain("overflow-x-auto");
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
    expect(panel).toContain("Back to full map");
    expect(panel).toContain("onBackToMap={handleBackToMap}");
    expect(panel).toContain("map.remove()");
    expect(panel).not.toContain("onSelectOfficial");
  });

  it("adds a real official identity verification workflow before source links", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("Official parcel identity check");
    expect(panel).toContain("StoepSteps / Step 1");
    expect(panel).toContain("I checked this source");
    expect(panel).toContain("Identity looks correct");
    expect(panel).toContain("Identity uncertain");
    expect(panel).toContain("Copy parcel identifiers");
    expect(panel).toContain("CSG Property Viewer");
    expect(panel).toContain("Kouga Public Map");
    expect(panel).toContain("SG document list");
    expect(panel).toContain("Deeds registry guidance");
    expect(panel).toContain("Not opened");
    expect(panel).toContain("Opened");
    expect(panel).toContain("Reviewed");
    expect(panel).toContain("Unavailable");
    expect(panel).toContain("Mark reviewed");
    expect(panel).toContain("Source unavailable");
    expect(panel).toContain("SG document list unavailable until buildable fields exist");
    expect(panel).toContain("not a guaranteed per-erf deep link");
    expect(panel).toContain("Use the copied LPI, parcel key or coordinates");
    expect(panel).toContain("Official government guidance for deeds registry information");
    expect(panel).toContain("GOVZA_DEEDS_GUIDANCE_URL");
    expect(panel).not.toContain("Open DeedsWeb");
    expect(panel).not.toContain("href=\"\"");
    expect(panel).toContain("Source quality label");
    expect(panel).toContain("Township / area");
    expect(panel).toContain("User checked, not legally verified");
    expect(panel).toContain("it is not legal, surveying or ownership verification");
    expect(panel).toContain("erfstoep.identityCheck.");
    expect(panel).toContain("openedSourceIds");
    expect(panel).toContain("reviewedSourceIds");
    expect(panel).toContain("markSourceOpened");
    expect(panel).toContain("markSourceReviewed");
    expect(panel).toContain("window.localStorage.setItem(identityStatusKey(parcelId), nextStatus)");
    expect(panel).toContain("identityStatusToWorkspace");
    expect(panel).toContain("buildErfWorkspaceNextStep");
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
    expect(panel).toContain('title: "Report Vault"');
    expect(panel).toContain("Add or upload Lightstone, WinDeed, SG, zoning, title deed");
  });

  it("clarifies the active workbench section and keeps overview as the only first-read section", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("WORKBENCH_SECTIONS");
    expect(panel).toContain("Workbench / {activeSection.title}");
    expect(panel).toContain('title: "Overview"');
    expect(panel).toContain(
      "Start with the first read, evidence readiness, and the recommended next step.",
    );
    expect(panel).toContain('title: "Official Sources"');
    expect(panel).toContain("Check public records and source links tied to this erf.");
    expect(panel).toContain('title: "Market Evidence"');
    expect(panel).toContain("Build comps, listing evidence, and manual market notes.");
    expect(panel).toContain('title: "Report Vault"');
    expect(panel).toContain(
      "Add or upload Lightstone, WinDeed, SG, zoning, title deed, or other evidence.",
    );
    expect(panel).toContain('title: "Strategy Lab"');
    expect(panel).toContain(
      "Run the numbers before deciding whether to buy, hold, flip, or build.",
    );
    expect(panel).toContain('title: "Notes"');
    expect(panel).toContain("Capture your research, questions, and decision notes.");
    expect(panel).toContain("isOverview ? (");
    expect(panel).toContain("{isOverview && (");
    expect(panel).toContain("{activeSection.guidanceTitle}");
    expect(panel).toContain("{activeSection.guidance}");
  });

  it("keeps mobile official parcel close and save controls visible", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");

    expect(panel).toContain("h-[100dvh]");
    expect(panel).toContain("max-md:pt-[calc(env(safe-area-inset-top)+0.75rem)]");
    expect(panel).toContain("Save erf");
    expect(panel).toContain("Back to map");
    expect(panel).toContain("Back to full map");
    expect(panel).toContain("min-h-11");
    expect(panel).toContain("sticky top-0 z-30");
  });

  it("surfaces ErfStoep intelligence immediately on official map click", () => {
    const panel = read("src/components/property/OfficialParcelPanel.tsx");
    const workspace = read("src/lib/workbench/erfWorkspaceState.ts");

    expect(panel).toContain("Every erf. All the facts.");
    expect(panel).toContain("Ownership, valuation, zoning, sales history and GIS precision");
    expect(panel).toContain("How ErfStoep builds your report");
    expect(panel).toContain("Know this erf");
    expect(panel).toContain(
      "Confirm the parcel, save evidence, run numbers, and create one Stoep",
    );
    expect(panel).toContain("Mini report");
    expect(panel).toContain('["Identity", "Checked", "text-emerald-700"]');
    expect(panel).toContain('["Evidence", "2 sources", "text-[#0D1B2A]"]');
    expect(panel).toContain('["Market", "Needs comps", "text-[#9A4A09]"]');
    expect(panel).toContain('["Strategy", "Not started", "text-[#64748B]"]');
    expect(panel).toContain("Evidence Vault");
    expect(panel).toContain("Save source checks, uploaded reports, notes, listings and comps.");
    expect(panel).toContain("Strategy Lab");
    expect(panel).toContain("Run build, flip, hold and max-offer calculators.");
    expect(panel).toContain("Stoep Report");
    expect(panel).toContain(
      "Stoep AI uses saved evidence and assumptions to create one clear report.",
    );
    expect(panel).toContain("bg-[#F7FBFF]");
    expect(panel).toContain("border-[#D9E6F2]");
    expect(panel).toContain(
      "Optional confidence upgrades. Buy a report or upload a PDF you already purchased; the",
    );
    expect(panel).toContain("Ask Stoep");
    expect(panel).toContain("What do you want to understand first?");
    expect(panel).toContain("What is risky?");
    expect(panel).toContain("What should I verify?");
    expect(panel).toContain("Run the numbers");
    expect(panel).toContain("Recommended next step");
    expect(panel).toContain("buildErfWorkspaceNextStep");
    expect(panel).toContain("{nextStep.title}");
    expect(panel).toContain("{nextStep.action}");
    expect(panel).toContain("Skip to Strategy Lab");
    expect(panel).toContain("Verify official records");
    expect(panel).toContain("Build market evidence");
    expect(panel).toContain("Run Strategy Lab");
    expect(panel).toContain("Add/upload evidence");
    expect(panel).toContain("Coming soon");
    expect(panel).toContain('["Identity", identityReadiness]');
    expect(panel).toContain('["Ownership", "Needs evidence"]');
    expect(panel).toContain('["Market value", "Needs evidence"]');
    expect(panel).toContain('["Strategy", "Not chosen"]');
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
    expect(panel).toContain("readErfWorkspaceState");
    expect(panel).toContain("updateErfWorkspaceState");
    expect(panel).toContain("buildErfWorkspaceNextStep");
    expect(panel).toContain("marketEvidenceStarted: true");
    expect(panel).toContain("calculatorStarted: true");
    expect(panel).toContain("reportStarted: true");
    expect(panel).toContain("Stoep AI First Read");
    expect(panel).toContain("needs evidence");
    expect(panel).toContain("Ownership, valuation, zoning, sales history and GIS precision");
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
    expect(dossier).toContain("Next best action:");
    expect(dossier).toContain("Checked");
  });

  it("renders the listings and comps tab and BRRRR explanation", () => {
    const dossier = read("src/components/property/ErfResearchDossier.tsx");
    const marketEvidence = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(dossier).toContain("Listings & Comps");
    expect(marketEvidence).toContain("Find listings and comps for this erf");
    expect(marketEvidence).toContain("Address Intelligence");
    expect(marketEvidence).toContain("Active Listing Radar");
    expect(marketEvidence).toContain("No confirmed street address yet");
    expect(marketEvidence).toContain("Fallback Search Tools");
    expect(marketEvidence).toContain("Saved Market Evidence");
    expect(marketEvidence).toContain("Market Thesis from saved evidence");
    expect(dossier).toContain("BRRRR means Buy, Rehab, Rent, Refinance, Repeat");
  });

  it("renders the ErfStoep intelligence dashboard shell without fake paid data", () => {
    const dossier = read("src/components/property/ErfResearchDossier.tsx");

    expect(dossier).toContain("Stoep AI First Read");
    expect(dossier).toContain("What is this property?");
    expect(dossier).toContain("Stoep Score placeholder");
    expect(dossier).toContain("Early signal:");
    expect(dossier).toContain("StoepSteps preview");
    expect(dossier).toContain("Property First Read");
    expect(dossier).toContain("Generate Stoep Report");
    expect(dossier).toContain("Strategy Lab preview");
    expect(dossier).toContain("Land Flip");
    expect(dossier).toContain("Build and Sell");
    expect(dossier).toContain("Hold vs Cash");
    expect(dossier).toContain("Max Offer");
    expect(dossier).toContain("Stoep Reports preview");
    expect(dossier).toContain("Report Vault / Upload PDF placeholder");
    expect(dossier).toContain("Purchase Lightstone");
    expect(dossier).toContain("Purchase WinDeed");
    expect(dossier).toContain("Paid reports are optional confidence upgrades");
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
    expect(hook).toContain("propertyIdentity");
    expect(hook).toContain("marketAddressIntelligence");
    expect(tab).toContain("Saved Market Evidence");
    expect(tab).toContain("Save comp");
  });

  it("keeps Active Listing Radar primary and search tools as fallback", () => {
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(tab).toContain("Active Listing Radar");
    expect(tab).toContain("Find possible exact match");
    expect(tab).toContain("Search area listings");
    expect(tab).toContain("Run Area Radar");
    expect(tab).toContain("Run Exact Radar");
    expect(tab).toContain("Fallback Search Tools");
    expect(tab).toContain("ErfStoep does not scan portals live");
    expect(tab).toContain("Use these manual tools only when the radar has no candidates");
    expect(tab).not.toContain("Show hidden / weak candidates");
  });

  it("keeps manual address, candidate import and triage actions explicit", () => {
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(tab).toContain("Save market address");
    expect(tab).toContain(
      "Address autocomplete is skipped unless a Google Places service is available",
    );
    expect(tab).toContain("marketAddressIntelligence");
    expect(tab).toContain("No listing candidates have been added for this area yet.");
    expect(tab).toContain("No candidates matched this area/source/type filter.");
    expect(tab).toContain("Import listing candidate");
    expect(tab).toContain("Target property");
    expect(tab).toContain("Same street comp");
    expect(tab).toContain("Same node comp");
    expect(tab).toContain("Vacant land comp");
    expect(tab).toContain("Nearby comp");
    expect(tab).toContain("Broader comp");
    expect(tab).toContain("Dismiss");
  });

  it("uses warmer simple listings and comps surfaces", () => {
    const tab = read("src/features/marketEvidence/components/MarketEvidenceTab.tsx");

    expect(tab).toContain("from-[#fff8ec]");
    expect(tab).toContain("border-accent/20");
    expect(tab).toContain("text-stone-950");
    expect(tab).toContain("bg-[#fff8ec]");
  });
});
