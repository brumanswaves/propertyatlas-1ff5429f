import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Link2, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { SavedMarketEvidence } from "../types";
import { ImportedListingReview } from "./ImportedListingReview";
import { ListingImportProgress } from "./ListingImportProgress";
import { importListingFromUrl } from "./service";
import type { ImportedListing, ListingImportError, ListingImportPhase } from "./types";
import { safeDomain } from "./format";

type Mode = "idle" | "loading" | "review" | "error";
type ImportIntent = "active_listing" | "comparable";

const PROGRESS_SEQUENCE: ListingImportPhase[] = [
  "opening",
  "extracting",
  "checking_missing",
  "preparing_evidence",
];

const INPUT =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-sm placeholder:text-stone-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/40";

export interface ListingUrlImporterProps {
  parcel: NormalizedOfficialParcel;
  importIntent: ImportIntent;
  title: string;
  description: string;
  placeholder: string;
  buttonLabel: string;
  onSaveEvidence: (
    evidence: Omit<SavedMarketEvidence, "id" | "parcelId" | "savedAt" | "updatedAt">,
  ) => Promise<boolean>;
}

export function ListingUrlImporter({
  parcel,
  importIntent,
  title,
  description,
  placeholder,
  buttonLabel,
  onSaveEvidence,
}: ListingUrlImporterProps) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [phase, setPhase] = useState<ListingImportPhase>("idle");
  const [listing, setListing] = useState<ImportedListing | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<ListingImportError | null>(null);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedErfLabel = useMemo(() => {
    const erf = parcel.erfNumber ? `Erf ${parcel.erfNumber}` : null;
    const suburb = parcel.suburbOrArea ?? parcel.town ?? null;
    return [erf, suburb].filter(Boolean).join(" - ") || parcel.id;
  }, [parcel]);

  function resetAll() {
    abortRef.current?.abort();
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    setMode("idle");
    setPhase("idle");
    setListing(null);
    setError(null);
    setEditing(false);
    setSaving(false);
  }

  async function runImport() {
    setError(null);
    setListing(null);
    setMode("loading");
    setPhase("opening");

    let idx = 0;
    phaseTimerRef.current = setInterval(() => {
      idx = Math.min(idx + 1, PROGRESS_SEQUENCE.length - 1);
      setPhase(PROGRESS_SEQUENCE[idx]);
    }, 900);

    const controller = new AbortController();
    abortRef.current = controller;

    const result = await importListingFromUrl(
      { url, selectedParcelId: parcel.id },
      { signal: controller.signal },
    );

    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);

    if (!result.success) {
      setError(result.error);
      setMode("error");
      return;
    }

    setListing(result.listing);
    setMode("review");
    setPhase("idle");
  }

  async function handleSave() {
    if (!listing) return;
    setSaving(true);
    try {
      const ok = await onSaveEvidence(evidenceFromImportedListing(listing, importIntent));
      if (!ok) return;
      toast.success(
        importIntent === "active_listing"
          ? "Active listing saved for this erf"
          : "Comparable evidence saved",
      );
      resetAll();
      setUrl("");
    } catch (err) {
      toast.error((err as Error)?.message ?? "Could not save the listing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-stone-900/10 bg-gradient-to-br from-stone-950 to-[#0d1b2a] p-5 text-white shadow-[0_20px_60px_rgba(6,21,42,0.25)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
            <Sparkles className="h-3 w-3" /> {title}
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">{title}</h3>
          <p className="mt-1 max-w-2xl text-sm text-white/70">{description}</p>
        </div>
        {mode !== "idle" && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80 hover:bg-white/10"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        )}
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === "loading") return;
          runImport();
        }}
      >
        <label className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="url"
            className={`${INPUT} pl-9 text-stone-900`}
            placeholder={placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={mode === "loading"}
          />
        </label>
        <button
          type="submit"
          disabled={mode === "loading" || url.trim().length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-stone-950 shadow-[0_10px_25px_rgba(255,106,0,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mode === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analysing...
            </>
          ) : (
            <>
              {buttonLabel} <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {mode === "loading" && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <ListingImportProgress phase={phase} />
        </div>
      )}

      {mode === "error" && error && (
        <div className="mt-4 rounded-2xl border border-red-300/50 bg-red-500/10 p-4 text-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-red-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            {error.code === "SERVICE_NOT_CONFIGURED"
              ? "Import service not configured"
              : error.code === "UNSUPPORTED_URL"
                ? "Unsupported source"
                : error.code === "INVALID_URL"
                  ? "Invalid URL"
                  : "Import failed"}
          </div>
          <p className="mt-1 text-red-50">{error.message}</p>
          {error.details && <p className="mt-1 text-[11px] text-red-100/70">{error.details}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => runImport()}
              className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20"
            >
              <RefreshCw className="h-3 w-3" /> Try again
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-full border border-white/20 bg-transparent px-3 py-1.5 text-[11px] font-semibold text-white/70 hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {mode === "review" && listing && (
        <div className="mt-4 rounded-2xl bg-white p-4 text-stone-950">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Review before saving
            </p>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[11px] font-medium text-stone-800 hover:bg-stone-50"
            >
              {editing ? "Done editing" : "Edit values"}
            </button>
          </div>

          <ImportedListingReview listing={listing} editing={editing} onListingChange={setListing} />

          <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
            {importIntent === "active_listing" ? (
              <p>
                Saving confirms this imported listing as the active listing for{" "}
                <strong>{selectedErfLabel}</strong>. Easy Erf will store your confirmation, but it
                will not claim the portal listing was automatically matched to the erf.
              </p>
            ) : (
              <p>
                Saving stores this import as comparable market evidence. It will update Comp Summary
                only after you save it.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={resetAll}
              className="rounded-full border border-stone-300 bg-white px-3 py-2 text-[12px] font-semibold text-stone-800 hover:bg-stone-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-stone-950 px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {importIntent === "active_listing"
                ? "Save active listing"
                : "Save comparable evidence"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function evidenceFromImportedListing(
  listing: ImportedListing,
  importIntent: ImportIntent,
): Omit<SavedMarketEvidence, "id" | "parcelId" | "savedAt" | "updatedAt"> {
  const p = listing.property;
  const isActive = importIntent === "active_listing";
  const title =
    p.title ??
    ([p.streetAddress, p.suburb, p.town].filter(Boolean).join(", ") ||
      (isActive ? "Imported active listing" : "Imported comparable listing"));
  const warnings = listing.warnings.length ? ` Import warnings: ${listing.warnings.join(" ")}` : "";
  const matchReasons = listing.match.reasons?.length
    ? ` Match notes: ${listing.match.reasons.join(" ")}`
    : "";

  return {
    sourceUrl: listing.source.url,
    sourcePortal: listing.source.portal ?? safeDomain(listing.source.url),
    title,
    askingPrice: p.askingPrice,
    propertyType: p.propertyType,
    beds: p.bedrooms,
    baths: p.bathrooms,
    garages: p.garages,
    parkingSpaces: p.parkingSpaces,
    landSizeM2: p.erfSizeM2,
    buildingSizeM2: p.floorSizeM2,
    relationship: isActive ? "target_asset" : "same_suburb_comp",
    confidence: isActive ? "high" : "medium",
    includeInSummary: !isActive,
    listingRole: isActive ? "subject_active_listing" : "comparable_evidence",
    importedListing: {
      listingId: listing.source.listingId,
      canonicalUrl: listing.source.canonicalUrl ?? null,
      importedAt: listing.source.importedAt ?? new Date().toISOString(),
      fetchedAt: listing.source.fetchedAt,
      contentHash: listing.source.contentHash ?? null,
      listingDate: listing.listing.listingDate ?? null,
      warnings: listing.warnings,
      missingFields: listing.missingFields,
      matchStatus: listing.match.status,
      matchReasons: listing.match.reasons ?? [],
      userConfirmedAttachment: isActive,
    },
    notes: isActive
      ? `User-confirmed active listing for this erf. Easy Erf did not automatically match this listing to the erf.${warnings}${matchReasons}`
      : `Imported as comparable market evidence.${warnings}${matchReasons}`,
  };
}
