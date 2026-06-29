import { useMemo, useState } from "react";
import {
  BookmarkCheck,
  Copy,
  ExternalLink,
  Pencil,
  Plus,
  Radar,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { copyToClipboard, openExternalUrl } from "@/lib/external";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  evidenceFromCandidate,
  relationshipForRadarClassification,
  runActiveListingRadar,
  scoreListingCandidate,
} from "../activeListingRadar";
import {
  CONFIDENCE_COPY,
  CONFIDENCE_LABELS,
  RELATIONSHIP_LABELS,
  type ListingCandidate,
  type MarketEvidenceConfidence,
  type MarketEvidenceRelationship,
  type RadarCandidateResult,
  type SavedMarketEvidence,
} from "../types";
import { RELATIONSHIP_OPTIONS } from "../constants";
import {
  calculateMarketEvidenceSummary,
  generateMarketEvidenceActions,
} from "../generateMarketEvidenceActions";
import { useSavedMarketEvidence } from "../hooks/useSavedMarketEvidence";

const CONFIDENCE_OPTIONS: MarketEvidenceConfidence[] = ["high", "medium", "low", "excluded"];
const RADAR_ACTIONS: Array<{ label: string; relationship: MarketEvidenceRelationship }> = [
  { label: "Target property", relationship: "target_asset" },
  { label: "Possible target", relationship: "possible_target_asset" },
  { label: "Same street comp", relationship: "same_street_comp" },
  { label: "Same node comp", relationship: "same_node_comp" },
  { label: "Vacant land comp", relationship: "vacant_land_comp" },
  { label: "Nearby comp", relationship: "same_suburb_comp" },
  { label: "Broader comp", relationship: "broader_market_comp" },
  { label: "Not related", relationship: "not_related" },
];

function money(value: number | undefined | null) {
  if (!value) return "Not enough priced evidence yet";
  return `R ${Math.round(value).toLocaleString("en-ZA")}`;
}

function rate(value: number | undefined | null) {
  if (!value) return "Not enough priced evidence yet";
  return `R ${Math.round(value).toLocaleString("en-ZA")}/m2`;
}

function n(value: string) {
  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function portalFromUrl(url: string) {
  const lower = url.toLowerCase();
  if (lower.includes("property24")) return "Property24";
  if (lower.includes("privateproperty")) return "Private Property";
  if (lower.includes("pamgolding")) return "Pam Golding";
  if (lower.includes("seeff")) return "Seeff";
  if (lower.includes("remax")) return "RE/MAX";
  if (lower.includes("rawson")) return "Rawson";
  if (lower.includes("chaseveritt")) return "Chas Everitt";
  return "Other";
}

type EvidenceDraft = {
  id?: string;
  sourceUrl: string;
  sourcePortal: string;
  title: string;
  askingPrice: string;
  propertyType: string;
  beds: string;
  baths: string;
  landSizeM2: string;
  buildingSizeM2: string;
  relationship: MarketEvidenceRelationship;
  confidence: MarketEvidenceConfidence;
  includeInSummary: boolean;
  notes: string;
};

type CandidateDraft = {
  sourceUrl: string;
  sourcePortal: string;
  title: string;
  askingPrice: string;
  propertyType: string;
  locationText: string;
  streetName: string;
  suburb: string;
  microMarket: string;
  beds: string;
  baths: string;
  landSizeM2: string;
  buildingSizeM2: string;
  agencyName: string;
  descriptionText: string;
};

function emptyEvidenceDraft(): EvidenceDraft {
  return {
    sourceUrl: "",
    sourcePortal: "",
    title: "",
    askingPrice: "",
    propertyType: "",
    beds: "",
    baths: "",
    landSizeM2: "",
    buildingSizeM2: "",
    relationship: "same_suburb_comp",
    confidence: "medium",
    includeInSummary: true,
    notes: "",
  };
}

function emptyCandidateDraft(): CandidateDraft {
  return {
    sourceUrl: "",
    sourcePortal: "",
    title: "",
    askingPrice: "",
    propertyType: "",
    locationText: "",
    streetName: "",
    suburb: "",
    microMarket: "",
    beds: "",
    baths: "",
    landSizeM2: "",
    buildingSizeM2: "",
    agencyName: "",
    descriptionText: "",
  };
}

function draftFromEvidence(item: SavedMarketEvidence): EvidenceDraft {
  return {
    id: item.id,
    sourceUrl: item.sourceUrl,
    sourcePortal: item.sourcePortal,
    title: item.title,
    askingPrice: item.askingPrice ? String(item.askingPrice) : "",
    propertyType: item.propertyType ?? "",
    beds: item.beds ? String(item.beds) : "",
    baths: item.baths ? String(item.baths) : "",
    landSizeM2: item.landSizeM2 ? String(item.landSizeM2) : "",
    buildingSizeM2: item.buildingSizeM2 ? String(item.buildingSizeM2) : "",
    relationship: item.relationship,
    confidence: item.confidence,
    includeInSummary: item.includeInSummary,
    notes: item.notes ?? "",
  };
}

export function MarketEvidenceTab({ parcel }: { parcel: NormalizedOfficialParcel }) {
  const generated = useMemo(() => generateMarketEvidenceActions(parcel), [parcel]);
  const { context, searchLadder, portalActions } = generated;
  const {
    loading,
    savedPropertyExists,
    evidence,
    candidates,
    dismissedCandidateIds,
    upsertEvidence,
    deleteEvidence,
    upsertCandidate,
    dismissCandidate,
  } = useSavedMarketEvidence(parcel.id);
  const [evidenceDraft, setEvidenceDraft] = useState<EvidenceDraft>(() => emptyEvidenceDraft());
  const [candidateDraft, setCandidateDraft] = useState<CandidateDraft>(() => emptyCandidateDraft());
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [radarHasRun, setRadarHasRun] = useState(false);
  const [showWeakCandidates, setShowWeakCandidates] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const summary = useMemo(() => calculateMarketEvidenceSummary(evidence), [evidence]);
  const visibleCandidates = useMemo(
    () => candidates.filter((candidate) => !dismissedCandidateIds.includes(candidate.id)),
    [candidates, dismissedCandidateIds],
  );
  const radarResults = useMemo(
    () => runActiveListingRadar(parcel, visibleCandidates),
    [parcel, visibleCandidates],
  );
  const allRadarResults = useMemo(
    () =>
      visibleCandidates
        .map((candidate) => ({ candidate, match: scoreListingCandidate(parcel, candidate) }))
        .sort(
          (a, b) =>
            b.match.score - a.match.score || a.candidate.title.localeCompare(b.candidate.title),
        ),
    [parcel, visibleCandidates],
  );
  const triageResults = showWeakCandidates ? allRadarResults : radarResults;
  const hasEvidence = evidence.length > 0;
  const noArea = !context.suburb && !context.town && !context.municipality;

  async function copy(phrase: string) {
    const ok = await copyToClipboard(phrase);
    if (ok) toast.success("Search phrase copied");
    else toast.error("Could not copy phrase");
  }

  async function saveEvidenceDraft() {
    if (!evidenceDraft.sourceUrl.trim()) {
      toast.error("URL is required");
      return;
    }
    await upsertEvidence({
      id: evidenceDraft.id,
      sourceUrl: evidenceDraft.sourceUrl.trim(),
      sourcePortal: evidenceDraft.sourcePortal.trim() || portalFromUrl(evidenceDraft.sourceUrl),
      title: evidenceDraft.title.trim() || "Saved market evidence",
      askingPrice: n(evidenceDraft.askingPrice),
      propertyType: evidenceDraft.propertyType.trim() || null,
      beds: n(evidenceDraft.beds),
      baths: n(evidenceDraft.baths),
      landSizeM2: n(evidenceDraft.landSizeM2),
      buildingSizeM2: n(evidenceDraft.buildingSizeM2),
      relationship: evidenceDraft.relationship,
      confidence: evidenceDraft.confidence,
      includeInSummary:
        evidenceDraft.relationship !== "not_related" &&
        evidenceDraft.confidence !== "excluded" &&
        evidenceDraft.includeInSummary,
      notes: evidenceDraft.notes.trim() || null,
    });
    setEvidenceDraft(emptyEvidenceDraft());
    setShowEvidenceForm(false);
  }

  async function importCandidate() {
    if (!candidateDraft.sourceUrl.trim()) {
      toast.error("Candidate URL is required");
      return;
    }
    await upsertCandidate({
      sourceUrl: candidateDraft.sourceUrl.trim(),
      sourcePortal: candidateDraft.sourcePortal.trim() || portalFromUrl(candidateDraft.sourceUrl),
      title: candidateDraft.title.trim() || "Imported listing candidate",
      askingPrice: n(candidateDraft.askingPrice),
      propertyType: candidateDraft.propertyType.trim() || null,
      locationText: candidateDraft.locationText.trim() || null,
      streetName: candidateDraft.streetName.trim() || null,
      suburb: candidateDraft.suburb.trim() || null,
      microMarket: candidateDraft.microMarket.trim() || null,
      town: context.town ?? null,
      municipality: context.municipality ?? null,
      province: context.province ?? null,
      beds: n(candidateDraft.beds),
      baths: n(candidateDraft.baths),
      landSizeM2: n(candidateDraft.landSizeM2),
      buildingSizeM2: n(candidateDraft.buildingSizeM2),
      agencyName: candidateDraft.agencyName.trim() || null,
      descriptionText: candidateDraft.descriptionText.trim() || null,
    });
    setCandidateDraft(emptyCandidateDraft());
    setShowCandidateForm(false);
    setRadarHasRun(true);
  }

  async function saveRadarCandidate(
    result: RadarCandidateResult,
    relationship: MarketEvidenceRelationship,
  ) {
    await upsertEvidence(evidenceFromCandidate(result.candidate, result.match, relationship));
  }

  return (
    <div className="space-y-5">
      <AssetIdentityCard
        parcel={parcel}
        warnings={context.warnings}
        evidenceCount={evidence.length}
      />

      <section className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-[#fff8ec] via-[#fdfaf4] to-[#f7efe3] p-5 shadow-[0_18px_50px_rgba(120,72,24,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-200/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-900">
              <Radar className="h-3.5 w-3.5" /> Active Listing Radar
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
              Scan candidate listings before saving evidence.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">
              Scan source-backed listing candidates for possible exact matches and nearby comps.
              Radar results are not confirmed until you verify and save them.
            </p>
            <p className="mt-2 text-xs font-semibold text-stone-900">
              Radar candidates are hypotheses. Verify before adding to evidence.
            </p>
          </div>
          <div className="grid min-w-[190px] gap-2 text-sm">
            <Metric label="Candidate pool" value={String(visibleCandidates.length)} />
            <Metric label="Imported candidates" value={String(candidates.length)} />
            <Metric
              label="Sources"
              value={
                visibleCandidates.length
                  ? Array.from(new Set(visibleCandidates.map((item) => item.sourcePortal))).join(
                      ", ",
                    )
                  : "Manual import ready"
              }
            />
            <Metric
              label="Last updated"
              value={
                visibleCandidates[0]?.lastSeenAt ??
                visibleCandidates[0]?.fetchedAt ??
                visibleCandidates[0]?.importedAt ??
                "No candidates yet"
              }
            />
          </div>
        </div>
        {!savedPropertyExists && (
          <p className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-white/70 px-4 py-3 text-sm text-stone-700">
            Save this property first to import and store listing candidates.
          </p>
        )}
        {visibleCandidates.length === 0 && (
          <p className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm text-stone-700">
            No listing candidate pool is available for this parcel yet. Import a listing or use the
            fallback search tools below.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRadarHasRun(true)}
            className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800"
          >
            <Radar className="h-4 w-4" /> Run radar
          </button>
          <button
            type="button"
            disabled={!savedPropertyExists}
            onClick={() => setShowCandidateForm((value) => !value)}
            className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 shadow-sm hover:bg-amber-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Import candidate manually
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCandidateForm(true);
              setFallbackOpen(false);
            }}
            disabled={!savedPropertyExists}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/80 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add candidate from URL
          </button>
          <button
            type="button"
            onClick={() => setFallbackOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/70 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            Open fallback search tools
          </button>
        </div>
        {showCandidateForm && savedPropertyExists && (
          <CandidateImportForm
            draft={candidateDraft}
            setDraft={setCandidateDraft}
            onSave={importCandidate}
          />
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-[#fffdf8] p-4 shadow-sm">
        <SectionTitle>Candidate Triage</SectionTitle>
        {!radarHasRun ? (
          <p className="mt-2 text-sm text-stone-600">
            Run Active Listing Radar to score imported candidates against this subject erf.
          </p>
        ) : visibleCandidates.length === 0 ? (
          <RadarEmptyState
            onImport={() => setShowCandidateForm(true)}
            onFallback={() => setFallbackOpen(true)}
          />
        ) : radarResults.length === 0 && !showWeakCandidates ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-stone-700">
            <div className="font-semibold text-stone-950">
              No candidates cleared the radar threshold.
            </div>
            <p className="mt-1">
              You can lower the filter or review all imported candidates. Weak candidates are not
              saved to the thesis unless you classify them.
            </p>
            <button
              type="button"
              onClick={() => setShowWeakCandidates(true)}
              className="mt-3 rounded-full bg-stone-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
            >
              Show hidden / weak candidates
            </button>
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {showWeakCandidates && (
              <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
                <span>Showing weak and hidden candidates for manual review.</span>
                <button
                  type="button"
                  onClick={() => setShowWeakCandidates(false)}
                  className="font-semibold text-stone-950"
                >
                  Hide weak
                </button>
              </div>
            )}
            {triageResults.map((result) => (
              <CandidateCard
                key={result.candidate.id}
                result={result}
                onClassify={(relationship) => saveRadarCandidate(result, relationship)}
                onDismiss={() => dismissCandidate(result.candidate.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-[#fffdf8] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Saved Market Evidence Ledger</SectionTitle>
          <button
            type="button"
            disabled={!savedPropertyExists}
            onClick={() => {
              setEvidenceDraft(emptyEvidenceDraft());
              setShowEvidenceForm((value) => !value);
            }}
            className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> Add evidence
          </button>
        </div>
        {!savedPropertyExists && (
          <p className="mt-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
            Save this property first to store market evidence.
          </p>
        )}
        {showEvidenceForm && savedPropertyExists && (
          <EvidenceForm
            draft={evidenceDraft}
            setDraft={setEvidenceDraft}
            onSave={saveEvidenceDraft}
          />
        )}
        {loading ? (
          <p className="mt-3 text-[12px] text-muted-foreground">Loading saved evidence...</p>
        ) : evidence.length === 0 ? (
          <p className="mt-3 text-[12px] text-muted-foreground">
            No saved market evidence yet. Save only real listing URLs or source pages that you
            personally verify.
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {evidence.map((item) => (
              <EvidenceRow
                key={item.id}
                item={item}
                onEdit={() => {
                  setEvidenceDraft(draftFromEvidence(item));
                  setShowEvidenceForm(true);
                }}
                onDelete={() => deleteEvidence(item.id)}
              />
            ))}
          </div>
        )}
      </section>

      {hasEvidence && (
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <SectionTitle>Market thesis from verified evidence</SectionTitle>
          <p className="mb-3 text-[12px] text-muted-foreground">
            This is a manual thesis from saved evidence, not an automated valuation.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Total evidence" value={String(summary.totalEvidence)} />
            <Metric label="Included evidence" value={String(summary.includedEvidence)} />
            <Metric label="Average asking price" value={money(summary.averageAskingPrice)} />
            <Metric label="Median asking price" value={money(summary.medianAskingPrice)} />
            <Metric
              label="Price range"
              value={
                summary.priceRange
                  ? `${money(summary.priceRange.min)} - ${money(summary.priceRange.max)}`
                  : "Not enough priced evidence yet"
              }
            />
            <Metric label="Average land R/m2" value={rate(summary.averageLandPricePerM2)} />
            <Metric label="Median land R/m2" value={rate(summary.medianLandPricePerM2)} />
            <Metric label="Average building R/m2" value={rate(summary.averageBuildingPricePerM2)} />
            <Metric label="Median building R/m2" value={rate(summary.medianBuildingPricePerM2)} />
          </div>
          {!summary.hasUsablePriceData && (
            <p className="mt-3 rounded-xl bg-background/70 px-3 py-2 text-[12px] text-muted-foreground">
              Not enough priced evidence yet.
            </p>
          )}
        </section>
      )}

      <details
        open={fallbackOpen}
        onToggle={(event) => setFallbackOpen(event.currentTarget.open)}
        className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4"
      >
        <summary className="cursor-pointer text-sm font-semibold tracking-tight text-foreground">
          Fallback Search Tools
        </summary>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Use these when radar has no candidates or when you want to search portals manually.
        </p>
        <div className="mt-4 grid gap-4">
          <FallbackSearchLadder noArea={noArea} searchLadder={searchLadder} onCopy={copy} />
          <PortalActionCards
            portalActions={portalActions}
            onCopy={copy}
            onSaveEvidence={(portal, title) => {
              setEvidenceDraft({ ...emptyEvidenceDraft(), sourcePortal: portal, title });
              setShowEvidenceForm(true);
            }}
          />
        </div>
      </details>
    </div>
  );
}

function AssetIdentityCard({
  parcel,
  warnings,
  evidenceCount,
}: {
  parcel: NormalizedOfficialParcel;
  warnings: string[];
  evidenceCount: number;
}) {
  const rows = [
    ["Erf", parcel.erfNumber],
    ["Portion", parcel.portion],
    ["Address", parcel.knownFields.find((field) => /address/i.test(field.label))?.value],
    ["Street", parcel.knownFields.find((field) => /street|road/i.test(field.label))?.value],
    ["Suburb/Town", parcel.suburbOrArea ?? parcel.town],
    ["Municipality", parcel.municipality],
    ["Province", parcel.province],
    ["Land size", parcel.knownFields.find((field) => /area|size/i.test(field.label))?.value],
    ["LPI", parcel.lpi],
    ["Parcel key", parcel.parcelKey],
    [
      "Coordinates",
      parcel.coordinates
        ? `${parcel.coordinates.lat.toFixed(6)}, ${parcel.coordinates.lng.toFixed(6)}`
        : null,
    ],
  ];
  const chips = [
    ["Erf known", Boolean(parcel.erfNumber)],
    ["Address known", rows.some(([label, value]) => label === "Address" && Boolean(value))],
    ["Street known", rows.some(([label, value]) => label === "Street" && Boolean(value))],
    ["Suburb known", Boolean(parcel.suburbOrArea ?? parcel.town)],
    ["Coordinates known", Boolean(parcel.coordinates)],
    ["Land size known", rows.some(([label, value]) => label === "Land size" && Boolean(value))],
    ["LPI known", Boolean(parcel.lpi)],
    ["Parcel key known", Boolean(parcel.parcelKey)],
    ["No saved market evidence yet", evidenceCount === 0],
  ] as const;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Asset Identity Card</SectionTitle>
        <Badge>
          <ShieldCheck className="h-3 w-3" /> {parcel.sourceLabel}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-muted/35 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="mt-0.5 break-words text-[12px] font-semibold">
              {value ? String(value) : "Not known"}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map(([label, ok]) => (
          <span
            key={label}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              ok ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground",
            )}
          >
            {label}
          </span>
        ))}
        {warnings.map((warning) => (
          <span
            key={warning}
            className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
          >
            {warning}
          </span>
        ))}
      </div>
    </section>
  );
}

function CandidateImportForm({
  draft,
  setDraft,
  onSave,
}: {
  draft: CandidateDraft;
  setDraft: (draft: CandidateDraft) => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 grid gap-2 rounded-2xl border border-border bg-background/80 p-3">
      <input
        className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
        placeholder="Source URL required"
        value={draft.sourceUrl}
        onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ["sourcePortal", "Source portal"],
          ["title", "Listing title"],
          ["askingPrice", "Asking price"],
          ["propertyType", "Property type"],
          ["locationText", "Location text"],
          ["streetName", "Street name"],
          ["suburb", "Suburb"],
          ["microMarket", "Micro-market"],
          ["beds", "Beds"],
          ["baths", "Baths"],
          ["landSizeM2", "Land size m2"],
          ["buildingSizeM2", "Building size m2"],
          ["agencyName", "Agency name"],
        ].map(([key, placeholder]) => (
          <input
            key={key}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
            placeholder={placeholder}
            value={draft[key as keyof CandidateDraft]}
            onChange={(event) =>
              setDraft({ ...draft, [key]: event.target.value } as CandidateDraft)
            }
          />
        ))}
      </div>
      <textarea
        className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
        rows={2}
        placeholder="Notes or description text"
        value={draft.descriptionText}
        onChange={(event) => setDraft({ ...draft, descriptionText: event.target.value })}
      />
      <button
        type="button"
        onClick={onSave}
        className="inline-flex w-fit items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90"
      >
        <Plus className="h-3 w-3" /> Import listing candidate
      </button>
    </div>
  );
}

function RadarEmptyState({
  onImport,
  onFallback,
}: {
  onImport: () => void;
  onFallback: () => void;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-stone-50 p-4 text-sm text-stone-700">
      <div className="font-semibold text-stone-950">
        No listing candidates are loaded for this area yet.
      </div>
      <p className="mt-1 leading-relaxed">
        Active Listing Radar needs source-backed candidates to scan. Import a candidate manually
        now, or use the fallback search tools until the Kouga cached listing pool is added.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onImport}
          className="rounded-full bg-stone-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
        >
          Import candidate manually
        </button>
        <button
          type="button"
          onClick={onImport}
          className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-amber-50"
        >
          Add candidate from URL
        </button>
        <button
          type="button"
          onClick={onFallback}
          className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50"
        >
          Open fallback search tools
        </button>
      </div>
    </div>
  );
}

function CandidateCard({
  result,
  onClassify,
  onDismiss,
}: {
  result: RadarCandidateResult;
  onClassify: (relationship: MarketEvidenceRelationship) => void;
  onDismiss: () => void;
}) {
  const { candidate, match } = result;
  const suggestion = relationshipForRadarClassification(match.classification);
  return (
    <article className="rounded-2xl border border-stone-200 bg-gradient-to-br from-white to-[#fbf5ea] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <Badge>{match.classification.replace(/_/g, " ")}</Badge>
            <Badge>{match.score} match strength</Badge>
            <Badge>Suggested: {RELATIONSHIP_LABELS[suggestion]}</Badge>
          </div>
          <h4 className="mt-2 break-words text-base font-semibold">{candidate.title}</h4>
          <p className="mt-1 text-sm text-stone-700">
            {money(candidate.askingPrice)}{" "}
            {candidate.propertyType ? ` / ${candidate.propertyType}` : ""}
          </p>
          <p className="mt-1 text-[12px] text-stone-600">
            {[candidate.locationText, candidate.streetName, candidate.suburb, candidate.microMarket]
              .filter(Boolean)
              .join(" / ") || "Location not supplied"}
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => openExternalUrl(candidate.sourceUrl, event)}
          className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-900 hover:bg-amber-50"
        >
          <ExternalLink className="h-3 w-3" /> Source
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Metric
          label="Land"
          value={candidate.landSizeM2 ? `${candidate.landSizeM2} m2` : "Unknown"}
        />
        <Metric
          label="Building"
          value={candidate.buildingSizeM2 ? `${candidate.buildingSizeM2} m2` : "Unknown"}
        />
        <Metric label="Beds/Baths" value={`${candidate.beds ?? "-"} / ${candidate.baths ?? "-"}`} />
        <Metric label="Source" value={candidate.sourcePortal} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {match.reasons.map((reason) => (
          <Badge key={reason}>{reason}</Badge>
        ))}
        {match.distanceMeters != null && <Badge>{match.distanceMeters}m from parcel</Badge>}
        {match.sizeVariancePercent != null && (
          <Badge>{match.sizeVariancePercent}% size variance</Badge>
        )}
      </div>
      <div className="mt-4">
        <div className="text-[12px] font-semibold">How does this relate to the subject erf?</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {RADAR_ACTIONS.map((action) => (
            <button
              type="button"
              key={action.relationship}
              onClick={() => onClassify(action.relationship)}
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-900 hover:bg-amber-50"
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-stone-300 px-3 py-1.5 text-[11px] font-semibold text-stone-600 hover:bg-stone-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </article>
  );
}

function EvidenceForm({
  draft,
  setDraft,
  onSave,
}: {
  draft: EvidenceDraft;
  setDraft: (draft: EvidenceDraft) => void;
  onSave: () => void;
}) {
  const includeDefault =
    draft.relationship !== "not_related" &&
    draft.confidence !== "excluded" &&
    draft.includeInSummary;

  return (
    <div className="mt-3 grid gap-2 rounded-2xl border border-border bg-background p-3">
      <input
        className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
        placeholder="Source URL required"
        value={draft.sourceUrl}
        onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          placeholder="Portal"
          value={draft.sourcePortal}
          onChange={(event) => setDraft({ ...draft, sourcePortal: event.target.value })}
        />
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          placeholder="Title"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          placeholder="Asking price"
          inputMode="decimal"
          value={draft.askingPrice}
          onChange={(event) => setDraft({ ...draft, askingPrice: event.target.value })}
        />
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          placeholder="Property type"
          value={draft.propertyType}
          onChange={(event) => setDraft({ ...draft, propertyType: event.target.value })}
        />
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          placeholder="Beds"
          inputMode="decimal"
          value={draft.beds}
          onChange={(event) => setDraft({ ...draft, beds: event.target.value })}
        />
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          placeholder="Baths"
          inputMode="decimal"
          value={draft.baths}
          onChange={(event) => setDraft({ ...draft, baths: event.target.value })}
        />
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          placeholder="Land size m2"
          inputMode="decimal"
          value={draft.landSizeM2}
          onChange={(event) => setDraft({ ...draft, landSizeM2: event.target.value })}
        />
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          placeholder="Building size m2"
          inputMode="decimal"
          value={draft.buildingSizeM2}
          onChange={(event) => setDraft({ ...draft, buildingSizeM2: event.target.value })}
        />
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          value={draft.relationship}
          onChange={(event) => {
            const relationship = event.target.value as MarketEvidenceRelationship;
            setDraft({
              ...draft,
              relationship,
              includeInSummary: relationship !== "not_related" && draft.confidence !== "excluded",
            });
          }}
        >
          {RELATIONSHIP_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {RELATIONSHIP_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          value={draft.confidence}
          onChange={(event) => {
            const confidence = event.target.value as MarketEvidenceConfidence;
            setDraft({
              ...draft,
              confidence,
              includeInSummary: draft.relationship !== "not_related" && confidence !== "excluded",
            });
          }}
        >
          {CONFIDENCE_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {CONFIDENCE_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[11px] text-muted-foreground">{CONFIDENCE_COPY[draft.confidence]}</p>
      <textarea
        className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
        rows={2}
        placeholder="Notes"
        value={draft.notes}
        onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
      />
      <label className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
        <input
          type="checkbox"
          checked={includeDefault}
          disabled={draft.relationship === "not_related" || draft.confidence === "excluded"}
          onChange={(event) => setDraft({ ...draft, includeInSummary: event.target.checked })}
        />
        Include in Market Thesis Summary
      </label>
      <button
        type="button"
        onClick={onSave}
        className="inline-flex w-fit items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90"
      >
        <BookmarkCheck className="h-3 w-3" /> Save evidence
      </button>
    </div>
  );
}

function EvidenceRow({
  item,
  onEdit,
  onDelete,
}: {
  item: SavedMarketEvidence;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{item.title}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge>{item.sourcePortal}</Badge>
            <Badge>{RELATIONSHIP_LABELS[item.relationship]}</Badge>
            <Badge>{CONFIDENCE_LABELS[item.confidence]}</Badge>
            {!item.includeInSummary && <Badge>Excluded from summary</Badge>}
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">
            {money(item.askingPrice)} {item.landSizeM2 ? ` / ${item.landSizeM2} m2 land` : ""}
          </p>
          {item.notes && <p className="mt-1 text-[12px] text-muted-foreground">{item.notes}</p>}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={(event) => openExternalUrl(item.sourceUrl, event)}
            className="rounded-full p-1.5 hover:bg-muted"
            aria-label="Open source"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full p-1.5 hover:bg-muted"
            aria-label="Edit evidence"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full p-1.5 hover:bg-muted hover:text-destructive"
            aria-label="Delete evidence"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

function FallbackSearchLadder({
  noArea,
  searchLadder,
  onCopy,
}: {
  noArea: boolean;
  searchLadder: Array<{
    id: string;
    level: number;
    label: string;
    phrase: string;
    helper: string;
    confidence: MarketEvidenceConfidence;
    relationshipSuggestion: MarketEvidenceRelationship;
  }>;
  onCopy: (phrase: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-background p-4">
      <SectionTitle>Search Ladder</SectionTitle>
      {noArea ? (
        <p className="text-[12px] text-muted-foreground">
          No area context is available. Use manual portal actions and verify results carefully.
        </p>
      ) : (
        <div className="mt-2 grid gap-2">
          {searchLadder.map((item) => (
            <article key={item.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Level {item.level} / {item.label}
                  </div>
                  <div className="mt-1 break-words text-sm font-semibold">{item.phrase}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {item.helper}
                  </p>
                </div>
                <Badge>{CONFIDENCE_LABELS[item.confidence]}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge>{RELATIONSHIP_LABELS[item.relationshipSuggestion]}</Badge>
                <button
                  type="button"
                  onClick={() => onCopy(item.phrase)}
                  className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background hover:opacity-90"
                >
                  <Copy className="h-3 w-3" /> Copy phrase
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PortalActionCards({
  portalActions,
  onCopy,
  onSaveEvidence,
}: {
  portalActions: Array<{
    id: string;
    portal: string;
    title: string;
    description: string;
    url: string;
    searchPhrase: string;
    group: string;
    helperText: string;
  }>;
  onCopy: (phrase: string) => void;
  onSaveEvidence: (portal: string, title: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-background p-4">
      <SectionTitle>Portal Action Cards</SectionTitle>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {portalActions.map((action) => (
          <article key={action.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{action.title}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {action.description}
                </p>
              </div>
              <Badge>{action.group.replace(/_/g, " ")}</Badge>
            </div>
            <div className="mt-2 rounded-lg bg-muted/40 px-2 py-1.5 text-[11px]">
              <span className="font-semibold">Phrase:</span>{" "}
              {action.searchPhrase || "Manual search"}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {action.helperText}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(event) => openExternalUrl(action.url, event)}
                className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background hover:opacity-90"
              >
                <ExternalLink className="h-3 w-3" /> Open portal
              </button>
              <button
                type="button"
                onClick={() => onCopy(action.searchPhrase)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
              >
                <Copy className="h-3 w-3" /> Copy phrase
              </button>
              <button
                type="button"
                onClick={() => onSaveEvidence(action.portal, action.title)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
              >
                <Plus className="h-3 w-3" /> Save evidence
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold tracking-tight text-foreground">{children}</h3>;
}
