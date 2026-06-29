import { useEffect, useMemo, useState } from "react";
import {
  BookmarkCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { copyToClipboard, openExternalUrl } from "@/lib/external";
import { toast } from "sonner";
import { calculateMarketEvidenceSummary } from "../calculateMarketEvidenceSummary";
import {
  buildSimpleListingSearches,
  resolvePropertyIdentity,
  type PropertyIdentity,
  type PropertyIdentityOverride,
  type SimpleListingSearch,
} from "../propertyIdentity";
import {
  CONFIDENCE_LABELS,
  type MarketEvidenceConfidence,
  type MarketEvidenceRelationship,
  type SavedMarketEvidence,
} from "../types";
import { useSavedMarketEvidence } from "../hooks/useSavedMarketEvidence";

const COMP_RELATIONSHIPS: Array<{ value: MarketEvidenceRelationship; label: string }> = [
  { value: "target_asset", label: "Exact listing" },
  { value: "possible_target_asset", label: "Possible exact listing" },
  { value: "same_street_comp", label: "Same street comp" },
  { value: "same_suburb_comp", label: "Same area comp" },
  { value: "vacant_land_comp", label: "Vacant land comp" },
  { value: "broader_market_comp", label: "Broader market comp" },
  { value: "not_related", label: "Not relevant" },
];

const LOCAL_AGENCIES = [
  { name: "Pam Golding", url: "https://www.pamgolding.co.za/" },
  { name: "Seeff", url: "https://www.seeff.com/" },
  { name: "RE/MAX", url: "https://www.remax.co.za/" },
  { name: "Rawson", url: "https://www.rawson.co.za/" },
  { name: "Chas Everitt", url: "https://www.chaseveritt.co.za/" },
];

type CompDraft = {
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
  notes: string;
};

function emptyCompDraft(): CompDraft {
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
    notes: "",
  };
}

function draftFromComp(item: SavedMarketEvidence): CompDraft {
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
    notes: item.notes ?? "",
  };
}

function n(value: string) {
  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function money(value: number | undefined | null) {
  if (!value) return "Not enough priced comps yet";
  return `R ${Math.round(value).toLocaleString("en-ZA")}`;
}

function rate(value: number | undefined | null) {
  if (!value) return "Not enough priced comps yet";
  return `R ${Math.round(value).toLocaleString("en-ZA")}/m2`;
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

function confidenceLabel(identity: PropertyIdentity) {
  if (identity.confidence === "high") return "High confidence";
  if (identity.confidence === "medium") return "Medium confidence";
  if (identity.confidence === "low") return "Low confidence";
  return "Needs confirmation";
}

export function MarketEvidenceTab({ parcel }: { parcel: NormalizedOfficialParcel }) {
  const {
    loading,
    savedPropertyExists,
    evidence,
    propertyIdentity,
    upsertEvidence,
    deleteEvidence,
    savePropertyIdentity,
  } = useSavedMarketEvidence(parcel.id);
  const identity = useMemo(
    () => resolvePropertyIdentity(parcel, propertyIdentity),
    [parcel, propertyIdentity],
  );
  const searches = useMemo(() => buildSimpleListingSearches(identity), [identity]);
  const summary = useMemo(() => calculateMarketEvidenceSummary(evidence), [evidence]);
  const [identityDraft, setIdentityDraft] = useState<PropertyIdentityOverride>(() => ({
    address: identity.bestAddress ?? "",
    streetName: identity.streetName ?? "",
    marketSuburb: identity.marketSuburb ?? "",
    note: identity.userNote ?? "",
  }));
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [compDraft, setCompDraft] = useState<CompDraft>(() => emptyCompDraft());
  const [showCompForm, setShowCompForm] = useState(false);

  useEffect(() => {
    setIdentityDraft({
      address: identity.bestAddress ?? "",
      streetName: identity.streetName ?? "",
      marketSuburb: identity.marketSuburb ?? "",
      note: identity.userNote ?? "",
      confirmedAt: propertyIdentity?.confirmedAt ?? null,
    });
  }, [
    identity.bestAddress,
    identity.streetName,
    identity.marketSuburb,
    identity.userNote,
    propertyIdentity?.confirmedAt,
  ]);

  async function copy(phrase: string) {
    const ok = await copyToClipboard(phrase);
    if (ok) toast.success("Search phrase copied");
    else toast.error("Could not copy phrase");
  }

  async function confirmAddress() {
    await savePropertyIdentity({
      ...identityDraft,
      address: identity.bestAddress ?? identityDraft.address ?? null,
      streetName: identity.streetName ?? identityDraft.streetName ?? null,
      marketSuburb: identity.marketSuburb ?? identityDraft.marketSuburb ?? null,
      confirmedAt: new Date().toISOString(),
    });
    setEditingIdentity(false);
  }

  async function saveEditedIdentity() {
    await savePropertyIdentity(identityDraft);
    setEditingIdentity(false);
  }

  async function saveComp() {
    if (!compDraft.sourceUrl.trim()) {
      toast.error("Comp URL is required");
      return;
    }
    const confidence: MarketEvidenceConfidence =
      compDraft.relationship === "target_asset"
        ? "high"
        : compDraft.relationship === "not_related"
          ? "excluded"
          : compDraft.relationship === "broader_market_comp"
            ? "low"
            : "medium";
    await upsertEvidence({
      id: compDraft.id,
      sourceUrl: compDraft.sourceUrl.trim(),
      sourcePortal: compDraft.sourcePortal.trim() || portalFromUrl(compDraft.sourceUrl),
      title: compDraft.title.trim() || "Saved comp",
      askingPrice: n(compDraft.askingPrice),
      propertyType: compDraft.propertyType.trim() || null,
      beds: n(compDraft.beds),
      baths: n(compDraft.baths),
      landSizeM2: n(compDraft.landSizeM2),
      buildingSizeM2: n(compDraft.buildingSizeM2),
      relationship: compDraft.relationship,
      confidence,
      includeInSummary: compDraft.relationship !== "not_related" && confidence !== "excluded",
      notes: compDraft.notes.trim() || null,
    });
    setCompDraft(emptyCompDraft());
    setShowCompForm(false);
  }

  return (
    <div className="space-y-5 text-stone-950">
      <PropertyIdentityCard
        identity={identity}
        savedPropertyExists={savedPropertyExists}
        editing={editingIdentity}
        draft={identityDraft}
        setDraft={setIdentityDraft}
        onEdit={() => setEditingIdentity(true)}
        onConfirm={confirmAddress}
        onSave={saveEditedIdentity}
      />

      <section className="rounded-3xl border border-stone-200 bg-[#fffaf0] p-5 shadow-[0_16px_40px_rgba(120,72,24,0.10)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionTitle>Simple listing searches</SectionTitle>
            <p className="mt-1 text-sm text-stone-700">
              Copy a phrase, open a portal, and save useful comps you verify.
            </p>
          </div>
          <Badge>{searches.length} primary actions</Badge>
        </div>
        <div className="mt-4 grid gap-3">
          {searches.map((search) => (
            <SimpleSearchCard key={search.id} search={search} onCopy={copy} />
          ))}
        </div>
        <details className="mt-4 rounded-2xl border border-stone-200 bg-white/70 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-stone-900">
            More local agency searches
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {LOCAL_AGENCIES.map((agency) => (
              <button
                type="button"
                key={agency.name}
                onClick={(event) => openExternalUrl(agency.url, event)}
                className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-amber-50"
              >
                {agency.name}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-stone-600">
            Google is a deep-search fallback only. Prefer Property24 and Private Property first.
          </p>
        </details>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-[#fffdf8] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <SectionTitle>Saved Comps</SectionTitle>
            <p className="mt-1 text-sm text-stone-600">
              Save only listings or source pages you personally verify.
            </p>
          </div>
          <button
            type="button"
            disabled={!savedPropertyExists}
            onClick={() => {
              setCompDraft(emptyCompDraft());
              setShowCompForm((value) => !value);
            }}
            className="inline-flex items-center gap-1 rounded-full bg-stone-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add comp
          </button>
        </div>
        {!savedPropertyExists && (
          <p className="mt-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm text-stone-700">
            Save this erf first to store comps and edited addresses.
          </p>
        )}
        {showCompForm && savedPropertyExists && (
          <CompForm draft={compDraft} setDraft={setCompDraft} onSave={saveComp} />
        )}
        {loading ? (
          <p className="mt-3 text-sm text-stone-600">Loading saved comps...</p>
        ) : evidence.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">
            No saved comps yet. Search a portal, open a useful listing, then save the URL here.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {evidence.map((item) => (
              <CompRow
                key={item.id}
                item={item}
                onEdit={() => {
                  setCompDraft(draftFromComp(item));
                  setShowCompForm(true);
                }}
                onDelete={() => deleteEvidence(item.id)}
              />
            ))}
          </div>
        )}
      </section>

      {evidence.length > 0 && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5">
          <SectionTitle>Comp summary</SectionTitle>
          <p className="mt-1 text-sm text-emerald-900">
            Simple math from saved comps only. This is not an AVM or valuation.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Saved comps" value={String(summary.totalEvidence)} />
            <Metric label="Included comps" value={String(summary.includedEvidence)} />
            <Metric label="Average asking price" value={money(summary.averageAskingPrice)} />
            <Metric label="Median asking price" value={money(summary.medianAskingPrice)} />
            <Metric label="Average land R/m2" value={rate(summary.averageLandPricePerM2)} />
            <Metric label="Median land R/m2" value={rate(summary.medianLandPricePerM2)} />
          </div>
        </section>
      )}

      <details className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-stone-800">
          Advanced / Experimental tools
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-stone-600">
          Active Listing Radar is not shown as the primary workflow until PropertyAtlas has a real
          cached listing candidate pool. For now, confirm the property identity, use the simple
          searches, and save verified comps.
        </p>
      </details>
    </div>
  );
}

function PropertyIdentityCard({
  identity,
  savedPropertyExists,
  editing,
  draft,
  setDraft,
  onEdit,
  onConfirm,
  onSave,
}: {
  identity: PropertyIdentity;
  savedPropertyExists: boolean;
  editing: boolean;
  draft: PropertyIdentityOverride;
  setDraft: (draft: PropertyIdentityOverride) => void;
  onEdit: () => void;
  onConfirm: () => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-[#fff8ec] to-[#f8efe2] p-5 shadow-[0_18px_50px_rgba(120,72,24,0.10)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-200/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-900">
            <Search className="h-3.5 w-3.5" /> Listings & Comps
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight">
            Find listings and comps for this erf
          </h3>
          <p className="mt-1 text-sm text-stone-700">
            First confirm the property identity. Then search for the exact listing or nearby comps.
          </p>
        </div>
        <Badge>{confidenceLabel(identity)}</Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <IdentityField
          label="Subject"
          value={
            identity.officialErf
              ? `Erf ${identity.officialErf}, Portion ${identity.officialPortion ?? "0"}`
              : "Official erf not known"
          }
        />
        <IdentityField
          label="Best address"
          value={identity.bestAddress ?? "No confirmed street address yet"}
          strong={Boolean(identity.bestAddress)}
        />
        <IdentityField
          label="Market area"
          value={identity.marketSuburb ?? identity.officialSuburb ?? identity.town ?? "Not known"}
        />
        <IdentityField
          label="Broader market"
          value={identity.town ?? identity.municipality ?? identity.province ?? "Not known"}
        />
      </div>

      {identity.officialSuburb &&
        identity.marketSuburb &&
        identity.officialSuburb !== identity.marketSuburb && (
          <p className="mt-3 rounded-2xl bg-white/70 px-3 py-2 text-xs text-stone-700">
            Official suburb: <span className="font-semibold">{identity.officialSuburb}</span>.
            Market suburb: <span className="font-semibold">{identity.marketSuburb}</span>.
          </p>
        )}
      {identity.warnings.length > 0 && (
        <div className="mt-3 grid gap-1">
          {identity.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-2xl border border-clay-200 bg-orange-50 px-3 py-2 text-xs text-stone-700"
            >
              {warning}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!savedPropertyExists || !identity.bestAddress}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" /> Confirm address
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-amber-50"
        >
          <Pencil className="h-4 w-4" /> Edit address
        </button>
        {!savedPropertyExists && (
          <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-2 text-xs font-semibold text-stone-700">
            Save this erf first to store an edited address.
          </span>
        )}
      </div>

      {editing && (
        <div className="mt-4 grid gap-2 rounded-2xl border border-stone-200 bg-white/80 p-3">
          <input
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
            placeholder="Address"
            value={draft.address ?? ""}
            onChange={(event) => setDraft({ ...draft, address: event.target.value })}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
              placeholder="Street name"
              value={draft.streetName ?? ""}
              onChange={(event) => setDraft({ ...draft, streetName: event.target.value })}
            />
            <input
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
              placeholder="Market suburb"
              value={draft.marketSuburb ?? ""}
              onChange={(event) => setDraft({ ...draft, marketSuburb: event.target.value })}
            />
          </div>
          <textarea
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
            rows={2}
            placeholder="Identity note"
            value={draft.note ?? ""}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          />
          <button
            type="button"
            onClick={onSave}
            disabled={!savedPropertyExists}
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
          >
            <BookmarkCheck className="h-4 w-4" /> Save identity
          </button>
        </div>
      )}
    </section>
  );
}

function IdentityField({
  label,
  value,
  strong = true,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/70 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div className={strong ? "mt-1 text-sm font-semibold" : "mt-1 text-sm text-stone-600"}>
        {value}
      </div>
    </div>
  );
}

function SimpleSearchCard({
  search,
  onCopy,
}: {
  search: SimpleListingSearch;
  onCopy: (phrase: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold">{search.label}</h4>
          <p className="mt-1 text-sm text-stone-600">{search.helper}</p>
        </div>
        <button
          type="button"
          onClick={() => onCopy(search.phrase)}
          className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-amber-100"
        >
          <Copy className="h-3.5 w-3.5" /> Copy
        </button>
      </div>
      <div className="mt-3 rounded-2xl bg-stone-50 px-3 py-2 text-sm font-semibold">
        {search.phrase}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {search.primaryPortalUrls.map((portal) => (
          <button
            type="button"
            key={portal.portal}
            onClick={(event) => openExternalUrl(portal.url, event)}
            className="inline-flex items-center gap-1 rounded-full bg-stone-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open {portal.portal}
          </button>
        ))}
      </div>
    </article>
  );
}

function CompForm({
  draft,
  setDraft,
  onSave,
}: {
  draft: CompDraft;
  setDraft: (draft: CompDraft) => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 grid gap-2 rounded-2xl border border-stone-200 bg-white/80 p-3">
      <input
        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
        placeholder="Comp URL required"
        value={draft.sourceUrl}
        onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="Portal"
          value={draft.sourcePortal}
          onChange={(event) => setDraft({ ...draft, sourcePortal: event.target.value })}
        />
        <input
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="Title"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <input
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="Asking price"
          inputMode="decimal"
          value={draft.askingPrice}
          onChange={(event) => setDraft({ ...draft, askingPrice: event.target.value })}
        />
        <input
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="Property type"
          value={draft.propertyType}
          onChange={(event) => setDraft({ ...draft, propertyType: event.target.value })}
        />
        <input
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="Beds"
          inputMode="decimal"
          value={draft.beds}
          onChange={(event) => setDraft({ ...draft, beds: event.target.value })}
        />
        <input
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="Baths"
          inputMode="decimal"
          value={draft.baths}
          onChange={(event) => setDraft({ ...draft, baths: event.target.value })}
        />
        <input
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="Land size m2"
          inputMode="decimal"
          value={draft.landSizeM2}
          onChange={(event) => setDraft({ ...draft, landSizeM2: event.target.value })}
        />
        <input
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          placeholder="Building size m2"
          inputMode="decimal"
          value={draft.buildingSizeM2}
          onChange={(event) => setDraft({ ...draft, buildingSizeM2: event.target.value })}
        />
        <select
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          value={draft.relationship}
          onChange={(event) =>
            setDraft({ ...draft, relationship: event.target.value as MarketEvidenceRelationship })
          }
        >
          {COMP_RELATIONSHIPS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
        rows={2}
        placeholder="Notes"
        value={draft.notes}
        onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
      />
      <button
        type="button"
        onClick={onSave}
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
      >
        <BookmarkCheck className="h-4 w-4" /> Save comp
      </button>
    </div>
  );
}

function CompRow({
  item,
  onEdit,
  onDelete,
}: {
  item: SavedMarketEvidence;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const relationship = COMP_RELATIONSHIPS.find((option) => option.value === item.relationship);
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{item.title}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge>{item.sourcePortal}</Badge>
            <Badge>{relationship?.label ?? item.relationship}</Badge>
            <Badge>{CONFIDENCE_LABELS[item.confidence]}</Badge>
            {!item.includeInSummary && <Badge>Excluded</Badge>}
          </div>
          <p className="mt-2 text-sm text-stone-600">
            {money(item.askingPrice)} {item.landSizeM2 ? ` / ${item.landSizeM2} m2 land` : ""}
          </p>
          {item.notes && <p className="mt-1 text-xs text-stone-600">{item.notes}</p>}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={(event) => openExternalUrl(item.sourceUrl, event)}
            className="rounded-full p-1.5 hover:bg-amber-50"
            aria-label="Open source"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full p-1.5 hover:bg-amber-50"
            aria-label="Edit comp"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full p-1.5 hover:bg-orange-50 hover:text-destructive"
            aria-label="Delete comp"
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
    <div className="rounded-2xl border border-stone-200 bg-white/75 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold tracking-tight text-stone-950">{children}</h3>;
}
