import { useMemo, useState } from "react";
import { BookmarkCheck, Copy, ExternalLink, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { copyToClipboard, openExternalUrl } from "@/lib/external";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CONFIDENCE_COPY,
  CONFIDENCE_LABELS,
  RELATIONSHIP_LABELS,
  type MarketEvidenceConfidence,
  type MarketEvidenceRelationship,
  type SavedMarketEvidence,
} from "../types";
import { RELATIONSHIP_OPTIONS } from "../constants";
import {
  calculateMarketEvidenceSummary,
  generateMarketEvidenceActions,
} from "../generateMarketEvidenceActions";
import { useSavedMarketEvidence } from "../hooks/useSavedMarketEvidence";

const CONFIDENCE_OPTIONS: MarketEvidenceConfidence[] = ["high", "medium", "low", "excluded"];

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

type Draft = {
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

function emptyDraft(): Draft {
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

function draftFromEvidence(item: SavedMarketEvidence): Draft {
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
  const { loading, savedPropertyExists, evidence, upsertEvidence, deleteEvidence } =
    useSavedMarketEvidence(parcel.id);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [showForm, setShowForm] = useState(false);
  const summary = useMemo(() => calculateMarketEvidenceSummary(evidence), [evidence]);
  const hasEvidence = evidence.length > 0;
  const noArea = !context.suburb && !context.town && !context.municipality;

  async function copy(phrase: string) {
    const ok = await copyToClipboard(phrase);
    if (ok) toast.success("Search phrase copied");
    else toast.error("Could not copy phrase");
  }

  async function saveDraft() {
    if (!draft.sourceUrl.trim()) {
      toast.error("URL is required");
      return;
    }
    if (!draft.relationship || !draft.confidence) {
      toast.error("Relationship and confidence are required");
      return;
    }
    await upsertEvidence({
      id: draft.id,
      sourceUrl: draft.sourceUrl.trim(),
      sourcePortal: draft.sourcePortal.trim() || portalFromUrl(draft.sourceUrl),
      title: draft.title.trim() || "Saved market evidence",
      askingPrice: n(draft.askingPrice),
      propertyType: draft.propertyType.trim() || null,
      beds: n(draft.beds),
      baths: n(draft.baths),
      landSizeM2: n(draft.landSizeM2),
      buildingSizeM2: n(draft.buildingSizeM2),
      relationship: draft.relationship,
      confidence: draft.confidence,
      includeInSummary:
        draft.relationship !== "not_related" &&
        draft.confidence !== "excluded" &&
        draft.includeInSummary,
      notes: draft.notes.trim() || null,
    });
    setDraft(emptyDraft());
    setShowForm(false);
  }

  return (
    <div className="space-y-5">
      <AssetIdentityCard
        parcel={parcel}
        warnings={context.warnings}
        evidenceCount={evidence.length}
      />

      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
        <div className="text-sm font-semibold text-foreground">Portal Reality Check</div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Property portals usually market by suburb, street, estate, beds, price, or area. Exact erf
          searches often return no results. Use the search ladder below, then save useful listings
          as market evidence.
        </p>
        <p className="mt-2 text-[12px] font-semibold text-foreground">
          {hasEvidence
            ? `${evidence.length} saved market evidence item${evidence.length === 1 ? "" : "s"} for this erf.`
            : "No confirmed market evidence has been saved for this erf yet."}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle>Search Ladder</SectionTitle>
        {noArea ? (
          <p className="text-[12px] text-muted-foreground">
            No area context is available. Use the manual portal actions below and verify any result
            before saving it.
          </p>
        ) : (
          <div className="grid gap-2">
            {searchLadder.map((item) => (
              <article key={item.id} className="rounded-xl border border-border bg-background p-3">
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
                    onClick={() => copy(item.phrase)}
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

      <section className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle>Portal Action Cards</SectionTitle>
        <div className="grid gap-2 md:grid-cols-2">
          {portalActions.map((action, index) => (
            <article
              key={action.id}
              className={cn(
                "rounded-xl border bg-background p-3",
                index < 2 ? "border-primary/30 ring-1 ring-primary/10" : "border-border",
              )}
            >
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
                  onClick={() => copy(action.searchPhrase)}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
                >
                  <Copy className="h-3 w-3" /> Copy phrase
                </button>
                <button
                  type="button"
                  disabled={!savedPropertyExists}
                  onClick={() => {
                    setDraft({ ...emptyDraft(), sourcePortal: action.portal, title: action.title });
                    setShowForm(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" /> Save evidence
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Saved Market Evidence Ledger</SectionTitle>
          <button
            type="button"
            disabled={!savedPropertyExists}
            onClick={() => {
              setDraft(emptyDraft());
              setShowForm((value) => !value);
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
        {showForm && savedPropertyExists && (
          <EvidenceForm draft={draft} setDraft={setDraft} onSave={saveDraft} />
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
                  setDraft(draftFromEvidence(item));
                  setShowForm(true);
                }}
                onDelete={() => deleteEvidence(item.id)}
              />
            ))}
          </div>
        )}
      </section>

      {hasEvidence && (
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <SectionTitle>Market thesis from saved evidence</SectionTitle>
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

function EvidenceForm({
  draft,
  setDraft,
  onSave,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
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
