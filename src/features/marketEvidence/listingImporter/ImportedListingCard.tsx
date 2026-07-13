import { ExternalLink, ImageOff, Pencil, Trash2 } from "lucide-react";
import type { ListingCandidate } from "../types";
import { formatArea, formatCount, formatZar, safeDomain } from "./format";

export function ImportedListingCard({
  candidate,
  status = "Saved evidence",
  onOpen,
  onEdit,
  onRemove,
  distanceMeters,
}: {
  candidate: ListingCandidate;
  status?: string;
  onOpen?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  distanceMeters?: number | null;
}) {
  const domain = safeDomain(candidate.sourceUrl);
  const importedAt = candidate.importedAt
    ? new Date(candidate.importedAt).toLocaleDateString("en-ZA")
    : null;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="relative aspect-[16/10] w-full bg-stone-100">
        {candidate.imageUrl ? (
          <img
            src={candidate.imageUrl}
            alt={candidate.title || "Imported listing image"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-stone-400">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-stone-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          {status}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-lg font-semibold tracking-tight text-stone-950">
            {formatZar(candidate.askingPrice)}
          </p>
          <span className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
            {candidate.sourcePortal || domain}
          </span>
        </div>
        <h4 className="line-clamp-2 text-sm font-medium text-stone-800">
          {candidate.title || "Imported listing"}
        </h4>
        <dl className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-stone-600">
          <Cell label="Beds" value={formatCount(candidate.beds)} />
          <Cell label="Baths" value={formatCount(candidate.baths)} />
          <Cell label="Erf" value={formatArea(candidate.landSizeM2)} />
          <Cell label="Floor" value={formatArea(candidate.buildingSizeM2)} />
          <Cell label="Type" value={candidate.propertyType ?? "Not provided"} />
          <Cell
            label="Distance"
            value={
              distanceMeters == null
                ? "—"
                : distanceMeters < 1000
                  ? `${Math.round(distanceMeters)} m`
                  : `${(distanceMeters / 1000).toFixed(1)} km`
            }
          />
        </dl>
        {importedAt && (
          <p className="text-[10px] uppercase tracking-wide text-stone-400">Imported {importedAt}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <a
            href={candidate.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-800 hover:bg-stone-50"
            onClick={onOpen}
          >
            <ExternalLink className="h-3 w-3" /> Open original listing
          </a>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-800 hover:bg-stone-50"
            >
              <Pencil className="h-3 w-3" /> Review details
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="font-medium text-stone-800">{value}</dd>
    </div>
  );
}
