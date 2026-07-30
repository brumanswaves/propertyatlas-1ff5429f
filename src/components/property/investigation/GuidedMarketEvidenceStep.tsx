import { useMemo, useState } from "react";
import {
  BarChart3,
  ExternalLink,
  Home,
  Loader2,
  Scale,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import { ListingUrlImporter } from "@/features/marketEvidence/listingImporter/ListingUrlImporter";
import { useSavedMarketEvidence } from "@/features/marketEvidence/hooks/useSavedMarketEvidence";
import {
  RELATIONSHIP_LABELS,
  type SavedMarketEvidence,
} from "@/features/marketEvidence/types";
import { cn } from "@/lib/utils";

interface GuidedMarketEvidenceStepProps {
  parcel: NormalizedOfficialParcel;
  onContinue: () => void;
}

type MarketImportMode = "active_listing" | "comparable";

function isSubjectListing(item: SavedMarketEvidence) {
  return item.listingRole === "subject_active_listing" || item.relationship === "target_asset";
}

function newestFirst(a: SavedMarketEvidence, b: SavedMarketEvidence) {
  return Date.parse(b.updatedAt || b.savedAt) - Date.parse(a.updatedAt || a.savedAt);
}

function formatPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Price not captured";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "listing source";
  }
}

export function GuidedMarketEvidenceStep({
  parcel,
  onContinue,
}: GuidedMarketEvidenceStepProps) {
  const {
    loading,
    evidence,
    upsertEvidence,
    deleteEvidence,
  } = useSavedMarketEvidence(parcel.id);
  const [mode, setMode] = useState<MarketImportMode>("active_listing");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeListings = useMemo(
    () => evidence.filter(isSubjectListing).sort(newestFirst),
    [evidence],
  );
  const comparableEvidence = useMemo(
    () => evidence.filter((item) => !isSubjectListing(item)).sort(newestFirst),
    [evidence],
  );
  const canContinue = evidence.length > 0;

  async function removeEvidence(item: SavedMarketEvidence) {
    setDeletingId(item.id);
    try {
      await deleteEvidence(item.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Market evidence could not be removed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-[#F8FAFC] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00]">
              Listings and comparable evidence
            </div>
            <h4 className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
              Paste a listing URL and review what Easy Erf captures
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/66">
              Save the active listing for this erf separately from comparable evidence. Easy Erf imports
              available listing facts for your review, but it does not treat a portal asking price as a
              valuation or claim that a hidden-address listing automatically matches this erf.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              canContinue
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-700",
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {canContinue
              ? `${evidence.length} market record${evidence.length === 1 ? "" : "s"} saved`
              : "No market evidence saved"}
          </span>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("active_listing")}
            className={cn(
              "rounded-xl border p-4 text-left transition",
              mode === "active_listing"
                ? "border-[#FF6A00]/55 bg-[#fff8ec] ring-2 ring-[#FF6A00]/10"
                : "border-[#0D1B2A]/10 bg-[#F8FAFC] hover:border-[#FF6A00]/30",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
              <Home className="h-4 w-4 text-[#FF6A00]" />
              Active listing for this erf
            </div>
            <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
              Use this only for the listing you believe belongs to the selected property. Your save is an
              explicit attachment decision, not an automatic cadastral match.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode("comparable")}
            className={cn(
              "rounded-xl border p-4 text-left transition",
              mode === "comparable"
                ? "border-[#FF6A00]/55 bg-[#fff8ec] ring-2 ring-[#FF6A00]/10"
                : "border-[#0D1B2A]/10 bg-[#F8FAFC] hover:border-[#FF6A00]/30",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0D1B2A]">
              <Scale className="h-4 w-4 text-[#FF6A00]" />
              Comparable listing or sale
            </div>
            <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/62">
              Save a nearby or similar property as market evidence. Review size, location, condition, and
              property type before relying on it as a comparison.
            </p>
          </button>
        </div>
      </section>

      {mode === "active_listing" ? (
        <ListingUrlImporter
          parcel={parcel}
          importIntent="active_listing"
          title="Import active listing for this erf"
          description="Paste the listing URL for the selected property. Review every captured value before confirming the attachment."
          placeholder="Paste Property24 listing URL"
          buttonLabel="Analyse listing"
          onSaveEvidence={upsertEvidence}
        />
      ) : (
        <ListingUrlImporter
          parcel={parcel}
          importIntent="comparable"
          title="Import comparable listing or sale"
          description="Paste a comparable listing URL. Review the imported price, size, location, and property details before saving it."
          placeholder="Paste comparable listing URL"
          buttonLabel="Analyse comparable"
          onSaveEvidence={upsertEvidence}
        />
      )}

      <section className="rounded-[1.25rem] border border-[#0D1B2A]/10 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[#0D1B2A]">Saved market evidence</h4>
            <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/60">
              Active listings stay separate from comparable calculations. Saved comps are evidence inputs,
              not a formal valuation.
            </p>
          </div>
          <div className="flex gap-2 text-xs font-semibold text-[#64748B]">
            <span>{activeListings.length} active</span>
            <span>·</span>
            <span>{comparableEvidence.length} comps</span>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 inline-flex items-center gap-2 text-sm text-[#0D1B2A]/58">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading market evidence...
          </div>
        ) : evidence.length ? (
          <div className="mt-4 space-y-4">
            {activeListings.length ? (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF6A00]">
                  Active listing
                </div>
                <div className="mt-2 grid gap-2">
                  {activeListings.map((item) => (
                    <EvidenceCard
                      key={item.id}
                      item={item}
                      deleting={deletingId === item.id}
                      onDelete={() => void removeEvidence(item)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {comparableEvidence.length ? (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF6A00]">
                  Comparable evidence
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {comparableEvidence.map((item) => (
                    <EvidenceCard
                      key={item.id}
                      item={item}
                      deleting={deletingId === item.id}
                      onDelete={() => void removeEvidence(item)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-[#0D1B2A]/14 bg-[#F8FAFC] p-4 text-sm text-[#0D1B2A]/58">
            No active listing or comparable evidence has been saved yet.
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF6A00] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_-20px_rgba(255,106,0,0.9)] transition hover:bg-[#FF7D1F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to Review report
        </button>
      </div>
    </div>
  );
}

function EvidenceCard({
  item,
  deleting,
  onDelete,
}: {
  item: SavedMarketEvidence;
  deleting: boolean;
  onDelete: () => void;
}) {
  const subject = isSubjectListing(item);
  return (
    <article className="rounded-xl border border-[#0D1B2A]/10 bg-[#F8FAFC] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[#0D1B2A]">{item.title}</div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-[#0D1B2A]">
            {formatPrice(item.askingPrice)}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0D1B2A]/68">
              {subject ? "Active listing" : RELATIONSHIP_LABELS[item.relationship]}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0D1B2A]/68">
              {item.confidence} confidence
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#0D1B2A]/68">
              {safeHost(item.sourceUrl)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/60">
            {[item.propertyType, item.landSizeM2 ? `${item.landSizeM2.toLocaleString()} m² land` : null,
              item.buildingSizeM2 ? `${item.buildingSizeM2.toLocaleString()} m² building` : null]
              .filter(Boolean)
              .join(" · ") || "Review the source for missing property details."}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-[#0D1B2A]/12 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0D1B2A]"
          >
            Open
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            type="button"
            disabled={deleting}
            onClick={onDelete}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-red-300/50 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-800 disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}

export default GuidedMarketEvidenceStep;
