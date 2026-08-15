import { calculateBuildableEnvelope } from "./buildableEnvelope";
import { zoningRulesForErfArea } from "./zoningRuleApplicability";
import {
  canAttemptOfficialZoningDetection,
  findMunicipalityPlanningRegistry,
  findZone,
  guidelinesForPlanningArea,
  matchPlanningArea,
  planningSourcesFor,
} from "./municipalityPlanningRegistry";
import type {
  ParcelPlanningAssessment,
  PlanningAction,
  PlanningChecklistItem,
  PlanningRiskFlag,
  PossibleRestriction,
  VerifiedParcelRight,
  ZoningDetection,
  ZoningRule,
} from "./municipalityPlanningTypes";

/**
 * Evidence signals the assessment reads. Everything is explicit and boolean:
 * the assessment never guesses that evidence exists.
 */
export interface ParcelPlanningEvidenceSignals {
  zoningCertificateUploaded: boolean;
  approvedBuildingPlansUploaded: boolean;
  titleDeedSearchable: boolean;
  sgDiagramSearchable: boolean;
  servitudesConfirmed: boolean;
  departureOrRezoningHistoryConfirmed: boolean;
  hoaOrDesignApprovalOnFile: boolean;
  occupancyCertificateUploaded: boolean;
  environmentalOverlayChecked: boolean;
}

export interface ParcelPlanningAssessmentInput {
  parcelId: string;
  municipality: string | null;
  /** Free-text hints: suburb, market address, town, parcel description. */
  locationHints: Array<string | null | undefined>;
  erfAreaM2: number | null;
  /** Zone chosen by the user in the Zoning & Build tab, if any. */
  manualZoneCode?: string | null;
  /** The selected zone the user explicitly confirmed as their working conclusion. */
  userConfirmedZoneCode?: string | null;
  /** Zone supported by an uploaded zoning certificate, if any. */
  documentZoneCode?: string | null;
  documentZoneAssetId?: string | null;
  /** Zoning value read off a map/scheme service or listing, when present. */
  observedZoneLabel?: string | null;
  hasParcelPolygon?: boolean;
  hasStreetEdgeReference?: boolean;
  evidence?: Partial<ParcelPlanningEvidenceSignals>;
  now?: Date;
}

const DEFAULT_SIGNALS: ParcelPlanningEvidenceSignals = {
  zoningCertificateUploaded: false,
  approvedBuildingPlansUploaded: false,
  titleDeedSearchable: false,
  sgDiagramSearchable: false,
  servitudesConfirmed: false,
  departureOrRezoningHistoryConfirmed: false,
  hoaOrDesignApprovalOnFile: false,
  occupancyCertificateUploaded: false,
  environmentalOverlayChecked: false,
};

const HEADLINE_WARNING =
  "These are published general rules for the matched zone. Property-specific departures, title conditions, servitudes and approved plans have not yet been confirmed for this erf.";

function ruleOfType(rules: ZoningRule[], type: ZoningRule["ruleType"]) {
  return rules.find((rule) => rule.ruleType === type) ?? null;
}

function buildDetection(
  input: ParcelPlanningAssessmentInput,
  registryMatched: boolean,
  zoneCode: string | null,
  zoneName: string | null,
): ZoningDetection {
  if (!registryMatched) {
    return {
      method: "not_detected",
      zoneCode: null,
      zoneName: null,
      confidence: "unverified",
      suppliedBy: "No planning registry for this municipality",
      supportingAssetId: null,
      statement:
        "Zoning is not automatically confirmed. Easy Erf does not yet hold a published planning rule set for this municipality.",
    };
  }
  if (input.documentZoneCode && zoneCode) {
    return {
      method: "document_supported",
      zoneCode,
      zoneName,
      confidence: "medium",
      suppliedBy: "Uploaded zoning document supplied by the user",
      supportingAssetId: input.documentZoneAssetId ?? null,
      statement:
        "Zoning is taken from a zoning document attached to this erf. Easy Erf does not certify the document; confirm it with the municipality.",
    };
  }
  if (input.manualZoneCode && zoneCode) {
    return {
      method: "manual_selection",
      zoneCode,
      zoneName,
      confidence: "low",
      suppliedBy: "Selected manually by the user",
      supportingAssetId: null,
      statement:
        "Zoning was selected manually, not detected from an official zoning polygon. It has not been confirmed with the municipality.",
    };
  }
  return {
    method: "not_detected",
    zoneCode: null,
    zoneName: null,
    confidence: "unverified",
    suppliedBy: "No official zoning polygon service confirmed",
    supportingAssetId: null,
    statement:
      "Zoning not automatically confirmed. No dependable official zoning polygon service is available for this municipality, so select the zone manually or attach a zoning certificate.",
  };
}

/**
 * Deterministic, cautious planning assessment for one parcel.
 * No sentence produced here may assert a confirmed parcel-specific right.
 */
export function buildParcelPlanningAssessment(
  input: ParcelPlanningAssessmentInput,
): ParcelPlanningAssessment {
  const signals = { ...DEFAULT_SIGNALS, ...(input.evidence ?? {}) };
  const entry = findMunicipalityPlanningRegistry(input.municipality);
  const registryMatched = Boolean(entry);
  const planningArea = entry ? matchPlanningArea(entry, input.locationHints) : null;

  const requestedZoneCode = input.documentZoneCode ?? input.manualZoneCode ?? null;
  const zone = entry ? findZone(entry, requestedZoneCode) : null;
  const detection = buildDetection(input, registryMatched, zone?.code ?? null, zone?.name ?? null);

  const publishedRules = zone ? zoningRulesForErfArea(zone.rules, input.erfAreaM2) : [];
  const guidelines = entry ? guidelinesForPlanningArea(entry, planningArea) : [];
  const sources = entry ? planningSourcesFor(entry, planningArea) : [];

  const envelope = calculateBuildableEnvelope({
    erfAreaM2: input.erfAreaM2,
    coverageRule: ruleOfType(publishedRules, "coverage"),
    heightRule: ruleOfType(publishedRules, "height"),
    hasParcelPolygon: Boolean(input.hasParcelPolygon),
    hasStreetEdgeReference: Boolean(input.hasStreetEdgeReference),
    missingConstraints: signals.servitudesConfirmed ? [] : ["Servitude positions"],
  });

  /* ---------------- verified parcel rights ---------------- */
  const verifiedRights: VerifiedParcelRight[] = [];
  if (signals.approvedBuildingPlansUploaded) {
    verifiedRights.push({
      id: "right-approved-plans",
      label: "Approved building plans",
      value: "Approved plan set attached to this erf",
      evidenceLabel: "Uploaded document",
      assetId: null,
    });
  }
  if (signals.zoningCertificateUploaded) {
    verifiedRights.push({
      id: "right-zoning-certificate",
      label: "Zoning certificate on file",
      value: "Zoning document attached to this erf",
      evidenceLabel: "Uploaded document",
      assetId: input.documentZoneAssetId ?? null,
    });
  }
  if (signals.occupancyCertificateUploaded) {
    verifiedRights.push({
      id: "right-occupancy-certificate",
      label: "Occupancy certificate on file",
      value: "Occupancy certificate attached to this erf",
      evidenceLabel: "Uploaded document",
      assetId: null,
    });
  }

  /* ---------------- possible restrictions ---------------- */
  const possibleRestrictions: PossibleRestriction[] = [];
  if (!signals.titleDeedSearchable) {
    possibleRestrictions.push({
      id: "restriction-title-conditions",
      label: "Title conditions",
      detail:
        "Title deed conditions can restrict use, building lines, subdivision and additional dwellings. The deed has not been read for this erf.",
    });
  }
  if (!signals.servitudesConfirmed) {
    possibleRestrictions.push({
      id: "restriction-servitudes",
      label: "Servitudes",
      detail:
        "Servitudes shown on the Surveyor-General diagram can remove buildable area. Servitude positions have not been confirmed.",
    });
  }
  if (!signals.departureOrRezoningHistoryConfirmed) {
    possibleRestrictions.push({
      id: "restriction-departures",
      label: "Departures and rezoning history",
      detail:
        "Previous departures, consent approvals or rezonings can change what applies to this erf. That history has not been confirmed.",
    });
  }
  for (const guideline of guidelines) {
    possibleRestrictions.push({
      id: `restriction-guideline-${guideline.id}`,
      label: guideline.title,
      detail:
        guideline.status === "draft" || guideline.status === "pending"
          ? `${guideline.summary} Status: ${guideline.status}. Not proved to be enforceable.`
          : guideline.summary,
    });
  }

  /* ---------------- risk flags ---------------- */
  const riskFlags: PlanningRiskFlag[] = [];
  if (detection.method !== "official_polygon") {
    riskFlags.push({
      id: "risk-zoning-not-confirmed",
      title: "Property-specific zoning not confirmed",
      severity: "high",
      why: detection.statement,
      nextAction:
        "Confirm the zoning of this erf with Kouga planning or attach a zoning certificate.",
    });
  }
  if (
    input.observedZoneLabel &&
    zone &&
    !input.observedZoneLabel.toLowerCase().includes(zone.code.toLowerCase()) &&
    !input.observedZoneLabel.toLowerCase().includes(zone.name.toLowerCase())
  ) {
    riskFlags.push({
      id: "risk-map-scheme-conflict",
      title: "Map and scheme values differ",
      severity: "high",
      why: `A zoning value of "${input.observedZoneLabel}" was observed elsewhere, but "${zone.name}" is selected here. The conflict has not been resolved.`,
      nextAction: "Ask the municipality which zoning applies to this erf.",
    });
  }
  if (!signals.titleDeedSearchable) {
    riskFlags.push({
      id: "risk-title-restrictions",
      title: "Title restrictions not checked",
      severity: "medium",
      why: "No searchable title deed is attached, so restrictive conditions cannot be ruled out.",
      nextAction: "Upload the title deed so its conditions can be read.",
    });
  }
  if (!signals.sgDiagramSearchable || !signals.servitudesConfirmed) {
    riskFlags.push({
      id: "risk-sg-servitudes",
      title: "SG and servitude constraints not confirmed",
      severity: "medium",
      why: "Servitudes and diagram-based constraints have not been confirmed for this erf.",
      nextAction: "Upload the Surveyor-General diagram and have servitudes checked.",
    });
  }
  if (!signals.approvedBuildingPlansUploaded) {
    riskFlags.push({
      id: "risk-approved-plans-missing",
      title: "Approved building plans missing",
      severity: "medium",
      why: "No approved municipal plan set is attached, so existing structures cannot be compared with what was approved.",
      nextAction: "Request the approved plan set from the municipality.",
    });
  }
  if (ruleOfType(publishedRules, "dwelling_units")) {
    riskFlags.push({
      id: "risk-second-dwelling-consent",
      title: "Consent required for an additional dwelling",
      severity: "low",
      why: "The published zone rules treat an additional dwelling unit as a consent use, which requires a municipal application.",
      nextAction:
        "Confirm the consent-use process with Kouga planning before assuming a second dwelling.",
    });
  }
  if (guidelines.length) {
    riskFlags.push({
      id: "risk-architectural-guidelines",
      title: "Architectural guidelines may apply",
      severity: "low",
      why: `${guidelines.length} local design document${guidelines.length === 1 ? "" : "s"} may apply to this planning area. Draft and pending documents are not proved to be enforceable.`,
      nextAction: "Check the design requirements with the municipality or the local association.",
    });
  }
  if (!signals.environmentalOverlayChecked) {
    riskFlags.push({
      id: "risk-environmental-overlay",
      title: "Environmental or coastal overlay not checked",
      severity: "medium",
      why: "Coastal, estuarine and environmental overlays can add controls. None has been checked for this erf.",
      nextAction: "Check whether a coastal or environmental overlay applies.",
    });
  }
  if (!signals.departureOrRezoningHistoryConfirmed) {
    riskFlags.push({
      id: "risk-departure-history",
      title: "Departure and rezoning history not confirmed",
      severity: "low",
      why: "Any previous departure, consent or rezoning affecting this erf is unknown.",
      nextAction: "Request the planning application history for this erf.",
    });
  }
  // Boundary/setback flags require geometry. Without it, no flag is raised.
  if (
    input.hasParcelPolygon &&
    input.hasStreetEdgeReference &&
    signals.approvedBuildingPlansUploaded
  ) {
    riskFlags.push({
      id: "risk-setback-geometry-review",
      title: "Building line positions should be reviewed against geometry",
      severity: "low",
      why: "Parcel geometry, a street edge reference and an approved plan set are available, so setback positions can be reviewed by a professional.",
      nextAction: "Ask a land surveyor or architect to compare plan positions with the boundaries.",
    });
  }

  /* ---------------- evidence checklist ---------------- */
  const checklist: PlanningChecklistItem[] = [
    {
      id: "check-zoning",
      label: "Zoning of this erf",
      status:
        detection.method === "document_supported"
          ? "uploaded"
          : detection.method === "manual_selection"
            ? "detected"
            : "missing",
      detail: detection.statement,
    },
    {
      id: "check-published-rules",
      label: "Published zone rules",
      status: publishedRules.length ? "published_general_rule" : "missing",
      detail: publishedRules.length
        ? "General rules published for the matched zone. They are not confirmed rights for this erf."
        : "No published rule set is matched for this erf yet.",
    },
    {
      id: "check-title-deed",
      label: "Title deed conditions",
      status: signals.titleDeedSearchable ? "verified" : "missing",
      detail: signals.titleDeedSearchable
        ? "A searchable title deed is attached to this erf."
        : "No searchable title deed is attached.",
    },
    {
      id: "check-sg",
      label: "Surveyor-General diagram",
      status: signals.sgDiagramSearchable ? "verified" : "missing",
      detail: signals.sgDiagramSearchable
        ? "A searchable SG diagram is attached to this erf."
        : "No searchable SG diagram is attached.",
    },
    {
      id: "check-servitudes",
      label: "Servitudes",
      status: signals.servitudesConfirmed ? "verified" : "needs_professional_confirmation",
      detail: signals.servitudesConfirmed
        ? "Servitude positions have been confirmed."
        : "Servitude positions should be confirmed by a land surveyor or conveyancer.",
    },
    {
      id: "check-approved-plans",
      label: "Approved building plans",
      status: signals.approvedBuildingPlansUploaded ? "uploaded" : "missing",
      detail: signals.approvedBuildingPlansUploaded
        ? "An approved plan set is attached to this erf."
        : "No approved plan set is attached.",
    },
    {
      id: "check-departures",
      label: "Departure / consent history",
      status: signals.departureOrRezoningHistoryConfirmed ? "verified" : "missing",
      detail: signals.departureOrRezoningHistoryConfirmed
        ? "Planning application history has been confirmed."
        : "Planning application history has not been requested.",
    },
    {
      id: "check-guidelines",
      label: "Local design guidelines",
      status: guidelines.length
        ? signals.hoaOrDesignApprovalOnFile
          ? "uploaded"
          : "published_general_rule"
        : "missing",
      detail: guidelines.length
        ? `${guidelines.length} local design document${guidelines.length === 1 ? "" : "s"} matched for this planning area.`
        : "No local design document matched for this planning area.",
    },
    {
      id: "check-overlay",
      label: "Environmental / coastal overlay",
      status: signals.environmentalOverlayChecked ? "verified" : "missing",
      detail: signals.environmentalOverlayChecked
        ? "An overlay check has been recorded for this erf."
        : "No overlay check has been recorded.",
    },
    {
      id: "check-occupancy",
      label: "Occupancy certificate",
      status: signals.occupancyCertificateUploaded ? "uploaded" : "missing",
      detail: signals.occupancyCertificateUploaded
        ? "An occupancy certificate is attached to this erf."
        : "No occupancy certificate is attached.",
    },
  ];

  if (
    input.observedZoneLabel &&
    zone &&
    !input.observedZoneLabel.toLowerCase().includes(zone.code.toLowerCase()) &&
    !input.observedZoneLabel.toLowerCase().includes(zone.name.toLowerCase())
  ) {
    checklist[0] = { ...checklist[0], status: "conflict" };
  }

  /* ---------------- actions ---------------- */
  const candidateActions: Array<Omit<PlanningAction, "order">> = [
    {
      id: "action-confirm-zoning",
      title: "Confirm zoning with the municipality",
      detail: "Ask Kouga planning to confirm the zoning that applies to this erf in writing.",
      actionLabel: "Open Sources",
      actionTab: "research",
      completed: detection.method === "document_supported",
    },
    {
      id: "action-upload-zoning-certificate",
      title: "Upload a zoning certificate",
      detail: "Attach the municipal zoning certificate so the zone becomes document-supported.",
      actionLabel: "Open Erf File",
      actionTab: "reports",
      completed: signals.zoningCertificateUploaded,
    },
    {
      id: "action-check-title",
      title: "Check title and servitude restrictions",
      detail: "Upload the title deed and have restrictive conditions and servitudes read.",
      actionLabel: "Open Erf File",
      actionTab: "reports",
      completed: signals.titleDeedSearchable && signals.servitudesConfirmed,
    },
    {
      id: "action-upload-plans",
      title: "Upload approved building plans",
      detail: "Request and attach the approved municipal plan set for this erf.",
      actionLabel: "Open Erf File",
      actionTab: "reports",
      completed: signals.approvedBuildingPlansUploaded,
    },
    {
      id: "action-departure-history",
      title: "Confirm departure and rezoning history",
      detail: "Request the planning application history for this erf from the municipality.",
      actionLabel: "Open Sources",
      actionTab: "research",
      completed: signals.departureOrRezoningHistoryConfirmed,
    },
    {
      id: "action-compare-structures",
      title: "Compare structures with approved plans",
      detail:
        "Once approved plans are attached, have a professional compare them with what is on site.",
      actionLabel: "Open Erf File",
      actionTab: "reports",
      completed: false,
    },
    {
      id: "action-design-approval",
      title: "Obtain HOA or design approval guidance",
      detail: "Check whether local design guidelines or an association approval apply here.",
      actionLabel: "Open Sources",
      actionTab: "research",
      completed: signals.hoaOrDesignApprovalOnFile,
    },
  ];

  const openActions = candidateActions.filter((action) => {
    if (!action.completed) {
      // Do not surface the compare step until plans actually exist.
      if (action.id === "action-compare-structures") {
        return signals.approvedBuildingPlansUploaded;
      }
      if (action.id === "action-design-approval") return guidelines.length > 0;
      return true;
    }
    return false;
  });

  const actions: PlanningAction[] = openActions.map((action, index) => ({
    ...action,
    order: index + 1,
  }));

  const missingEvidence = checklist
    .filter((item) => item.status === "missing" || item.status === "conflict")
    .map((item) => item.label);

  const permittedUseSummary = zone
    ? `${zone.name}. Published primary use: ${zone.permittedUses.join(", ")}. Consent uses include ${zone.consentUses.join(", ")}.`
    : "No zone is confirmed for this erf, so no permitted-use summary can be given.";

  return {
    parcelId: input.parcelId,
    municipality: entry?.municipality ?? input.municipality ?? null,
    planningArea,
    registryMatched,
    userConfirmedZoneCode:
      input.userConfirmedZoneCode && input.userConfirmedZoneCode === zone?.code
        ? input.userConfirmedZoneCode
        : null,
    detection,
    zone,
    publishedRules,
    verifiedRights,
    possibleRestrictions,
    guidelines,
    overlays: [],
    envelope,
    riskFlags,
    checklist,
    actions,
    missingEvidence,
    sources,
    permittedUseSummary,
    headlineWarning: HEADLINE_WARNING,
    assessedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function canDetectOfficialZoningFor(municipality: string | null | undefined) {
  return canAttemptOfficialZoningDetection(findMunicipalityPlanningRegistry(municipality));
}
