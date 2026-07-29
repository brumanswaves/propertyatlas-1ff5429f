import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";
import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import type { SavedMarketEvidence } from "@/features/marketEvidence/types";
import type { ParcelPlanningAssessment } from "@/lib/planning/municipalityPlanningTypes";
import {
  erfAssetHasSearchableExtraction,
  erfAssetIdentityMatchStatus,
  erfAssetIsParentLineageMatch,
} from "@/lib/evidence/extractionMetadata";
import { canonicalAreaM2, formatAreaM2WithUnit } from "@/lib/evidence/parcelArea";
import {
  selectNextGuidedTask,
  toGuidedEvidenceTask,
  type InvestigationFacts,
} from "./guidedTaskRegistry";
import type {
  InvestigationFinding,
  InvestigationOverallStatus,
  InvestigationStage,
  PropertyInvestigation,
} from "./types";

export interface BuildPropertyInvestigationInput {
  parcel: NormalizedOfficialParcel;
  workspaceState: ErfWorkspaceState;
  assets?: ErfAsset[];
  savedEvidence?: SavedMarketEvidence[];
  planning?: ParcelPlanningAssessment | null;
  scenarioCount?: number;
  chosenScenarioId?: string | null;
  marketAddressLine?: string | null;
  skippedTaskIds?: string[];
  startedAt?: string | null;
  now?: Date;
}

function isLive(asset: ErfAsset) {
  return asset.status !== "deleted" && asset.status !== "archived" && asset.status !== "failed";
}

function isSubjectMatched(asset: ErfAsset) {
  return erfAssetIdentityMatchStatus(asset) === "matched";
}

export function deriveInvestigationFacts(
  input: BuildPropertyInvestigationInput,
): InvestigationFacts {
  const { parcel, workspaceState } = input;
  const assets = (input.assets ?? []).filter(isLive);
  const savedEvidence = input.savedEvidence ?? [];
  const planning = input.planning ?? null;

  const sgDiagrams = assets.filter((asset) => asset.asset_category === "sg_diagram");
  const paidReports = assets.filter((asset) => asset.asset_category === "paid_report");
  const titleDeeds = assets.filter((asset) => asset.asset_category === "title_deed");
  const plans = assets.filter((asset) => asset.asset_category === "architectural_plan");

  const detectionMethod = planning?.detection.method ?? null;

  return {
    parcelId: parcel.id,
    identityConfirmed:
      workspaceState.identityStatus === "looks_correct" ||
      workspaceState.identityStatus === "checked",
    identityUncertain: workspaceState.identityStatus === "uncertain",
    identityChecked: workspaceState.identityStatus !== "none",
    hasOfficialParcelKey: Boolean(parcel.lpi || parcel.parcelKey),
    hasAreaEvidence: canonicalAreaM2(parcel.rawProperties) != null,
    sgDiagramSearchable: sgDiagrams.some(
      (asset) => erfAssetHasSearchableExtraction(asset) && isSubjectMatched(asset),
    ),
    sgDiagramParentLineageOnly:
      sgDiagrams.some((asset) => erfAssetIsParentLineageMatch(asset)) &&
      !sgDiagrams.some(
        (asset) => erfAssetHasSearchableExtraction(asset) && isSubjectMatched(asset),
      ),
    sgDiagramCount: sgDiagrams.length,
    zoningConfirmedByDocument:
      detectionMethod === "document_supported" || detectionMethod === "official_polygon",
    zoningRegistryPublished: Boolean(planning?.registryMatched),
    zoningWorkingAssumption: detectionMethod === "manual_selection",
    approvedPlansOnFile: plans.length > 0,
    titleDeedSearchable: titleDeeds.some((asset) => erfAssetHasSearchableExtraction(asset)),
    paidReportSearchable: paidReports.some(
      (asset) => erfAssetHasSearchableExtraction(asset) && isSubjectMatched(asset),
    ),
    paidReportCount: paidReports.length,
    marketEvidenceCount: savedEvidence.length,
    marketAddressSaved: Boolean(workspaceState.marketAddressSaved || input.marketAddressLine),
    scenarioCount: input.scenarioCount ?? workspaceState.strategyScenarioCount,
    hasChosenScenario: Boolean(input.chosenScenarioId ?? workspaceState.chosenScenarioId),
    siteConceptCount: workspaceState.sitePotential.conceptCount,
    siteDesignSelected: Boolean(workspaceState.sitePotential.selectedDesignAssetId),
    siteSkipped:
      workspaceState.sitePotential.skipped ||
      workspaceState.sitePotential.progressState === "skipped",
    reportStarted: workspaceState.reportStarted,
  };
}

function stageOf(
  id: InvestigationStage["id"],
  label: string,
  status: InvestigationStage["status"],
  summary: string,
  evidenceCount: number,
  confidence: InvestigationStage["confidence"],
  targetTab: InvestigationStage["targetTab"],
): InvestigationStage {
  return { id, label, status, summary, evidenceCount, confidence, targetTab };
}

function buildStages(
  facts: InvestigationFacts,
  parcel: NormalizedOfficialParcel,
): InvestigationStage[] {
  const identityEvidence =
    (facts.hasOfficialParcelKey ? 1 : 0) +
    (facts.hasAreaEvidence ? 1 : 0) +
    (facts.sgDiagramSearchable ? 1 : 0);

  const identity = stageOf(
    "identify",
    "Identify",
    facts.identityUncertain
      ? "blocked"
      : facts.identityConfirmed
        ? "complete"
        : facts.hasOfficialParcelKey
          ? "in_progress"
          : "waiting",
    facts.identityUncertain
      ? "You flagged the parcel identity as uncertain, so downstream conclusions are held back."
      : facts.identityConfirmed
        ? "You confirmed this erf against the official parcel record."
        : facts.hasOfficialParcelKey
          ? "An official cadastral key is available, but you have not confirmed the identity yet."
          : "No official cadastral key is available for this selection yet.",
    identityEvidence,
    facts.identityConfirmed ? "supported" : facts.hasOfficialParcelKey ? "indicative" : "unconfirmed",
    "research",
  );

  const planning = stageOf(
    "planning",
    "Planning",
    facts.zoningConfirmedByDocument
      ? "complete"
      : facts.zoningWorkingAssumption
        ? "in_progress"
        : facts.zoningRegistryPublished
          ? "waiting"
          : "unavailable",
    facts.zoningConfirmedByDocument
      ? "The zoning for this erf is supported by a document on file."
      : facts.zoningWorkingAssumption
        ? "A zone is selected as a working assumption. It is not confirmed with the municipality."
        : facts.zoningRegistryPublished
          ? "Published planning rules exist for this municipality, but the zoning of this erf is not confirmed."
          : "Easy Erf does not yet hold a published planning rule set for this municipality.",
    facts.zoningConfirmedByDocument ? 1 : 0,
    facts.zoningConfirmedByDocument ? "supported" : "unconfirmed",
    "zoning-build",
  );

  const constraintEvidence =
    (facts.approvedPlansOnFile ? 1 : 0) +
    (facts.titleDeedSearchable ? 1 : 0) +
    (facts.paidReportSearchable ? 1 : 0);
  const constraints = stageOf(
    "constraints",
    "Constraints",
    constraintEvidence > 0 ? "in_progress" : "waiting",
    constraintEvidence > 0
      ? "Some title, deed or approved-plan evidence is on file. Servitudes and restrictions are still not confirmed."
      : "Title conditions, servitudes and approved plans have not been confirmed for this erf.",
    constraintEvidence,
    constraintEvidence > 0 ? "indicative" : "unconfirmed",
    "reports",
  );

  const site = stageOf(
    "site_potential",
    "Site potential",
    facts.siteSkipped
      ? "complete"
      : facts.siteDesignSelected
        ? "complete"
        : facts.siteConceptCount > 0
          ? "in_progress"
          : "waiting",
    facts.siteSkipped
      ? "You skipped Site Potential for this erf."
      : facts.siteDesignSelected
        ? "A concept is saved to this erf. It is conceptual, not an approved plan."
        : facts.siteConceptCount > 0
          ? "Concepts are generated but none is selected yet."
          : "No concept has been generated for this erf yet.",
    facts.siteConceptCount,
    "unconfirmed",
    "site-potential",
  );

  const market = stageOf(
    "market",
    "Market",
    facts.marketEvidenceCount > 0 ? "in_progress" : "waiting",
    facts.marketEvidenceCount > 0
      ? `${facts.marketEvidenceCount} saved market ${facts.marketEvidenceCount === 1 ? "record" : "records"} support the market view.`
      : "No market evidence has been saved for this erf yet.",
    facts.marketEvidenceCount,
    facts.marketEvidenceCount > 0 ? "indicative" : "unconfirmed",
    "listings",
  );

  const strategy = stageOf(
    "strategy",
    "Strategy",
    facts.hasChosenScenario ? "complete" : facts.scenarioCount > 0 ? "in_progress" : "waiting",
    facts.hasChosenScenario
      ? "A chosen scenario is saved. The figures are your assumptions, not a valuation."
      : facts.scenarioCount > 0
        ? "Scenarios are saved but none has been chosen yet."
        : "No strategy scenario has been saved for this erf yet.",
    facts.scenarioCount,
    facts.hasChosenScenario ? "indicative" : "unconfirmed",
    "calculators",
  );

  const report = stageOf(
    "report",
    "Report",
    facts.reportStarted ? "complete" : facts.identityConfirmed ? "in_progress" : "waiting",
    facts.reportStarted
      ? "The Easy Erf Report has been opened for this erf."
      : "The report can be assembled from whatever evidence is saved, and will label the gaps.",
    0,
    "indicative",
    "stoep-report",
  );

  void parcel;
  return [identity, planning, constraints, site, market, strategy, report];
}

function buildFindings(
  facts: InvestigationFacts,
  parcel: NormalizedOfficialParcel,
): InvestigationFinding[] {
  const findings: InvestigationFinding[] = [];
  const areaLabel = formatAreaM2WithUnit(canonicalAreaM2(parcel.rawProperties));

  if (facts.hasOfficialParcelKey) {
    findings.push({
      id: "finding-official-parcel",
      stageId: "identify",
      title: "Official cadastral record located",
      body: `I matched this selection to the official parcel record${
        parcel.municipality ? ` in ${parcel.municipality}` : ""
      }.`,
      status: facts.identityConfirmed ? "verified" : "supported",
      sourceLabel: parcel.sourceLabel ?? "Official parcel service",
      targetTab: "research",
    });
  }

  if (areaLabel) {
    findings.push({
      id: "finding-area",
      stageId: "identify",
      title: `Recorded extent ${areaLabel}`,
      body: "This extent comes from the cadastral record and is approximate until an SG diagram confirms it.",
      status: facts.sgDiagramSearchable ? "supported" : "estimated",
      sourceLabel: facts.sgDiagramSearchable ? "SG diagram on file" : "Cadastral record",
      targetTab: "research",
    });
  }

  if (facts.sgDiagramParentLineageOnly) {
    findings.push({
      id: "finding-sg-parent-lineage",
      stageId: "identify",
      title: "SG evidence matches the parent property only",
      body: "The diagram on file relates to the parent property in this erf's lineage. It provides context but does not confirm rights for this erf.",
      status: "conflicting",
      sourceLabel: "SG diagram on file",
      targetTab: "research",
    });
  }

  if (facts.paidReportSearchable) {
    findings.push({
      id: "finding-paid-report",
      stageId: "constraints",
      title: "Identity-matched property report on file",
      body: "A purchased report was read and matched to this erf. Its values are used where the report supports them.",
      status: "supported",
      sourceLabel: "Uploaded property report",
      targetTab: "reports",
    });
  }

  if (!facts.zoningConfirmedByDocument) {
    findings.push({
      id: "finding-zoning-unconfirmed",
      stageId: "planning",
      title: "Zoning is not confirmed for this erf",
      body: facts.zoningRegistryPublished
        ? "Published municipal planning rules are available, but nothing on file confirms which zone applies to this erf."
        : "Easy Erf does not hold a dependable published rule set for this municipality yet.",
      status: "missing",
      sourceLabel: "No zoning certificate on file",
      targetTab: "zoning-build",
    });
  }

  if (!facts.approvedPlansOnFile) {
    findings.push({
      id: "finding-plans-missing",
      stageId: "constraints",
      title: "Title restrictions, servitudes and approved plans are unconfirmed",
      body: "Nothing on file confirms what may be built or what already has approval. Missing evidence is not proof that no restriction exists.",
      status: "missing",
      sourceLabel: "No approved plans on file",
      targetTab: "reports",
    });
  }

  if (facts.marketEvidenceCount === 0) {
    findings.push({
      id: "finding-market-missing",
      stageId: "market",
      title: "No market evidence saved yet",
      body: "Easy Erf will not estimate value without saved comparable evidence for this erf.",
      status: "missing",
      sourceLabel: "No saved listings",
      targetTab: "listings",
    });
  }

  return findings.slice(0, 4);
}

function buildAssistantMessages(
  facts: InvestigationFacts,
  parcel: NormalizedOfficialParcel,
): string[] {
  const messages: string[] = [];
  const where = [parcel.suburbOrArea, parcel.town, parcel.municipality].filter(Boolean)[0];
  const erf = parcel.erfNumber != null ? `Erf ${parcel.erfNumber}` : "this parcel";
  messages.push(`I identified ${erf}${where ? ` in ${where}` : ""}.`);

  if (facts.hasOfficialParcelKey) {
    messages.push(
      facts.hasAreaEvidence
        ? "I found the official cadastral boundary and an approximate recorded area."
        : "I found the official cadastral boundary for this parcel.",
    );
  }

  messages.push(
    facts.zoningConfirmedByDocument
      ? "I found a zoning document attached to this erf."
      : facts.zoningRegistryPublished
        ? "I found published municipal planning sources, but the zoning of this erf is not yet confirmed."
        : "The next source to check is the municipal planning department, because no published rule set is available here yet.",
  );

  if (facts.paidReportSearchable) {
    messages.push("I found an identity-matched property report with ownership information.");
  }

  messages.push(
    "I have not confirmed title restrictions, servitudes or approved plans yet from the information currently saved.",
  );

  if (!facts.siteSkipped && !facts.siteDesignSelected) {
    messages.push(
      "I can improve the Site Potential result once the planning controls for this erf are confirmed.",
    );
  }

  return messages;
}

const STAGE_WEIGHT = 100 / 7;

export function buildPropertyInvestigation(
  input: BuildPropertyInvestigationInput,
): PropertyInvestigation {
  const facts = deriveInvestigationFacts(input);
  const stages = buildStages(facts, input.parcel);
  const definition = selectNextGuidedTask(facts, input.skippedTaskIds ?? []);
  const nextTask = definition ? toGuidedEvidenceTask(definition, facts) : null;

  const progress = stages.reduce((total, stage) => {
    if (stage.status === "complete") return total + STAGE_WEIGHT;
    if (stage.status === "in_progress") return total + STAGE_WEIGHT / 2;
    return total;
  }, 0);
  const overallProgressPercent = Math.max(0, Math.min(100, Math.round(progress)));

  const overallStatus: InvestigationOverallStatus = facts.identityUncertain
    ? "waiting_on_evidence"
    : !facts.identityConfirmed
      ? "starting"
      : nextTask
        ? "underway"
        : "ready_for_report";

  const erf = input.parcel.erfNumber != null ? `Erf ${input.parcel.erfNumber}` : "This erf";
  const location = [input.parcel.suburbOrArea, input.parcel.town, input.parcel.municipality]
    .filter(Boolean)
    .join(", ");

  return {
    parcelId: input.parcel.id,
    startedAt: input.startedAt ?? (input.now ?? new Date()).toISOString(),
    headline:
      overallStatus === "ready_for_report"
        ? "Initial investigation ready"
        : overallStatus === "waiting_on_evidence"
          ? "Investigation paused on identity"
          : "Initial investigation underway",
    identitySummary: location ? `${erf} — ${location}` : erf,
    overallStatus,
    overallProgressPercent,
    stages,
    latestFindings: buildFindings(facts, input.parcel),
    nextTask,
    assistantMessages: buildAssistantMessages(facts, input.parcel),
    reportReady: facts.identityConfirmed,
  };
}
