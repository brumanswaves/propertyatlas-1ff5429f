import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ResearchSource } from "@/lib/research/sourceTypes";

export type InvestorWorkflowView =
  | "research"
  | "site-potential"
  | "listings"
  | "reports"
  | "notes"
  | "calculators"
  | "stoep-report";

export type DueDiligenceStatus =
  | "Available"
  | "Professional source required"
  | "Estimate only"
  | "Missing"
  | "Fallback"
  | "Login required"
  | "Source link available";

export interface NextBestStepModel {
  sourceId?: string;
  title: string;
  explanation: string;
  status: DueDiligenceStatus;
  primaryLabel: string;
  primaryUrl?: string;
  primaryView?: InvestorWorkflowView;
  secondaryLabel?: string;
  secondaryView?: InvestorWorkflowView;
}

export interface DueDiligenceStage {
  id: string;
  label: string;
  status: DueDiligenceStatus;
  detail: string;
  view?: InvestorWorkflowView;
}

function hasSource(sources: ResearchSource[], predicate: (source: ResearchSource) => boolean) {
  return sources.some((source) => source.status !== "unavailable" && predicate(source));
}

function sourceById(sources: ResearchSource[], id: string) {
  return sources.find((source) => source.id === id && source.status !== "unavailable");
}

function hasKnownField(parcel: NormalizedOfficialParcel, pattern: RegExp) {
  return parcel.knownFields.some(
    (field) => pattern.test(field.label) && String(field.value).trim().length > 0,
  );
}

export function buildNextBestStep(
  parcel: NormalizedOfficialParcel,
  sources: ResearchSource[],
  completedSourceIds: Set<string> = new Set(),
): NextBestStepModel {
  const csgViewer = completedSourceIds.has("csg-property-viewer")
    ? undefined
    : sourceById(sources, "csg-property-viewer");
  const sgDocuments = completedSourceIds.has("sg-document-list")
    ? undefined
    : sourceById(sources, "sg-document-list");
  const valuationRoll = completedSourceIds.has("municipal-valuation-roll")
    ? undefined
    : sourceById(sources, "municipal-valuation-roll");

  if (csgViewer?.url) {
    return {
      title: "Verify this erf against the official CSG parcel record.",
      explanation:
        "Start by confirming that the erf, portion, LPI or parcel key match the official cadastral source before relying on downstream research.",
      status: parcel.lpi || parcel.parcelKey ? "Available" : "Source link available",
      sourceId: csgViewer.id,
      primaryLabel: "Open CSG Property Viewer",
      primaryUrl: csgViewer.url,
      secondaryLabel: "View due diligence sources",
      secondaryView: "research",
    };
  }

  if (sgDocuments?.url) {
    return {
      title: "Open the SG document trail for this erf.",
      explanation:
        "Use the Surveyor-General document list to verify diagrams or registered parcel documents when the source can be built.",
      status: "Source link available",
      sourceId: sgDocuments.id,
      primaryLabel: sgDocuments.actionLabel,
      primaryUrl: sgDocuments.url,
      secondaryLabel: "View due diligence sources",
      secondaryView: "research",
    };
  }

  if (valuationRoll?.url) {
    return {
      title: "Check the municipal valuation and rates trail.",
      explanation:
        "Municipal values and rates clues must be verified at source; they are not attached as confirmed current values here.",
      status: "Source link available",
      sourceId: valuationRoll.id,
      primaryLabel: valuationRoll.actionLabel,
      primaryUrl: valuationRoll.url,
      secondaryLabel: "Save notes",
      secondaryView: "notes",
    };
  }

  if (!completedSourceIds.has("market-evidence")) {
    return {
      title: "Build Listings & Comps from saved source URLs.",
      explanation:
        "Use portal and agency searches as a workflow, then save only evidence you manually verify.",
      status: "Source link available",
      sourceId: "market-evidence",
      primaryLabel: "Open Listings & Comps",
      primaryView: "listings",
      secondaryLabel: "Run calculator",
      secondaryView: "calculators",
    };
  }

  return {
    title: "Save the known parcel identity and continue manual due diligence.",
    explanation:
      "The dossier can still organize notes, links and estimates while professional ownership, valuation and deeds sources are checked.",
    status: "Fallback",
    primaryLabel: "Save notes",
    primaryView: "notes",
    secondaryLabel: "View due diligence sources",
    secondaryView: "research",
  };
}

export function buildDueDiligenceProgress(
  parcel: NormalizedOfficialParcel,
  sources: ResearchSource[],
): DueDiligenceStage[] {
  const identityAvailable = Boolean(
    parcel.lpi || parcel.parcelKey || (parcel.erfNumber && parcel.municipality),
  );
  const zoningKnown = hasKnownField(parcel, /zoning/i);
  const valuationSourceAvailable = hasSource(
    sources,
    (source) =>
      source.category === "municipal-valuation-rates" ||
      source.dossierGroup === "municipal-evidence",
  );
  const riskSourcesAvailable = hasSource(
    sources,
    (source) => source.dossierGroup === "environmental-coastal-risk",
  );
  const listingSourcesAvailable = hasSource(
    sources,
    (source) => source.category === "listings-market-evidence",
  );
  const areaSourcesAvailable = hasSource(
    sources,
    (source) =>
      source.category === "neighbourhood-intelligence" ||
      source.category === "roads-access-infrastructure",
  );

  return [
    {
      id: "identity",
      label: "Identity",
      status: identityAvailable ? "Available" : "Source link available",
      detail: identityAvailable
        ? "Official parcel identifiers are present and should still be verified at source."
        : "Use CSG and SG sources to confirm the erf identity.",
      view: "research",
    },
    {
      id: "ownership",
      label: "Ownership",
      status: "Professional source required",
      detail: "Owner and deeds data are not attached. Use lawful professional sources.",
      view: "reports",
    },
    {
      id: "sales-history",
      label: "Sales History",
      status: "Professional source required",
      detail: "Transfer history requires verified deeds or paid-provider reports.",
      view: "reports",
    },
    {
      id: "valuation",
      label: "Valuation",
      status: valuationSourceAvailable ? "Source link available" : "Professional source required",
      detail: valuationSourceAvailable
        ? "Municipal or professional valuation sources can be checked; no current valuation is attached."
        : "A verified valuation or provider report is required.",
      view: "reports",
    },
    {
      id: "planning",
      label: "Planning",
      status: zoningKnown ? "Available" : "Source link available",
      detail: zoningKnown
        ? "A public zoning field is visible; verify buildability with the municipality."
        : "Municipal planning and zoning links are available for manual verification.",
      view: "research",
    },
    {
      id: "risk",
      label: "Risk",
      status: riskSourcesAvailable ? "Source link available" : "Missing",
      detail: "Environmental, heritage and coastal risk are screening links, not verified results.",
      view: "research",
    },
    {
      id: "income",
      label: "Income",
      status: "Estimate only",
      detail: "Income potential depends on user assumptions and saved market evidence.",
      view: "calculators",
    },
    {
      id: "area-intelligence",
      label: "Area Intelligence",
      status: areaSourcesAvailable ? "Source link available" : "Fallback",
      detail: "Area context can be researched through map, road and neighbourhood sources.",
      view: "research",
    },
    {
      id: "deal-flow",
      label: "Deal Flow",
      status: listingSourcesAvailable ? "Source link available" : "Missing",
      detail: "Listing and market searches are external and must be verified manually.",
      view: "listings",
    },
    {
      id: "costs",
      label: "Costs",
      status: "Estimate only",
      detail: "Use your own purchase, transfer, holding and build assumptions.",
      view: "calculators",
    },
  ];
}
