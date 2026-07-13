import { AlertTriangle, CheckCircle2, ExternalLink, ShieldAlert } from "lucide-react";
import type { ImportedListing } from "./types";
import { formatArea, formatCount, formatText, formatZar, safeDomain } from "./format";
import { ListingFieldEditor } from "./ListingFieldEditor";
import { ListingMissingFields } from "./ListingMissingFields";

export function ImportedListingReview({
  listing,
  editing,
  onListingChange,
}: {
  listing: ImportedListing;
  editing: boolean;
  onListingChange: (next: ImportedListing) => void;
}) {
  const { property, source, listing: body, agent, warnings } = listing;
  const domain = safeDomain(source.url);
  const listingDate = body.listingDate
    ? new Date(body.listingDate).toLocaleDateString("en-ZA")
    : null;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              {source.portal || domain}
              {source.listingId ? ` · Listing ${source.listingId}` : ""}
              {listingDate ? ` · Listed ${listingDate}` : ""}
            </p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">
              {formatZar(property.askingPrice)}
            </h3>
            <p className="mt-1 text-sm text-stone-700">
              {formatText(property.propertyType)} · Beds {formatCount(property.bedrooms)} · Baths{" "}
              {formatCount(property.bathrooms)} · Erf {formatArea(property.erfSizeM2)}
              {property.floorSizeM2 ? ` · Floor ${formatArea(property.floorSizeM2)}` : ""}
            </p>
            <p className="mt-1 text-[12px] text-stone-500">
              {[property.suburb, property.town, property.province].filter(Boolean).join(", ") ||
                "Location not provided"}
            </p>
          </div>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-800 hover:bg-stone-50"
          >
            <ExternalLink className="h-3 w-3" /> Open original
          </a>
        </div>
      </header>

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            <ShieldAlert className="h-3.5 w-3.5" /> Verify before relying on this
          </div>
          <ul className="mt-2 space-y-1 text-[13px] text-amber-900">
            {warnings.map((w) => (
              <li key={w} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SummaryGroup title="Confirmed from listing" tone="ok">
        <SummaryRow label="Asking price" value={formatZar(property.askingPrice)} />
        <SummaryRow label="Property type" value={formatText(property.propertyType)} />
        <SummaryRow label="Bedrooms" value={formatCount(property.bedrooms)} />
        <SummaryRow label="Bathrooms" value={formatCount(property.bathrooms)} />
        <SummaryRow label="Erf size" value={formatArea(property.erfSizeM2)} />
        <SummaryRow label="Suburb / Town" value={formatText(
          [property.suburb, property.town].filter(Boolean).join(", ") || null,
        )} />
      </SummaryGroup>

      <SummaryGroup title="Needs review" tone="warn">
        <SummaryRow label="Street address" value={formatText(property.streetAddress)} />
        <SummaryRow label="Erf number" value={formatText(property.erfNumber ?? null)} />
        <SummaryRow label="Floor size" value={formatArea(property.floorSizeM2)} />
        <SummaryRow label="Rates & taxes" value={formatZar(property.ratesMonthly)} />
        <SummaryRow label="Levies" value={formatZar(property.leviesMonthly)} />
      </SummaryGroup>

      <ListingMissingFields fields={listing.missingFields} />

      {editing && (
        <section className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-600">
            Edit imported values
          </p>
          <ListingFieldEditor listing={listing} onChange={onListingChange} />
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <MetaBlock title="Agent">
          <MetaRow k="Name" v={formatText(agent.name)} />
          <MetaRow k="Agency" v={formatText(agent.agency)} />
          <MetaRow k="Phone" v={formatText(agent.phone)} />
          <MetaRow k="Email" v={formatText(agent.email)} />
        </MetaBlock>
        <MetaBlock title="Listing detail">
          <MetaRow k="Description" v={body.description ? `${body.description.slice(0, 120)}…` : "Not provided"} />
          <MetaRow k="Features" v={body.features.length ? `${body.features.length} listed` : "Not provided"} />
          <MetaRow k="Images" v={body.imageUrls.length ? `${body.imageUrls.length} images` : "Not provided"} />
          <MetaRow k="Fetched" v={new Date(source.fetchedAt).toLocaleString("en-ZA")} />
        </MetaBlock>
      </div>
    </div>
  );
}

function SummaryGroup({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "ok" | "warn";
  children: React.ReactNode;
}) {
  const border =
    tone === "ok" ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60";
  const Icon = tone === "ok" ? CheckCircle2 : AlertTriangle;
  const iconTone = tone === "ok" ? "text-emerald-700" : "text-amber-700";
  return (
    <section className={`rounded-2xl border ${border} p-4`}>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-stone-700">
        <Icon className={`h-3.5 w-3.5 ${iconTone}`} /> {title}
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-stone-200/70 pb-1 last:border-none">
      <dt className="text-[11px] uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-stone-900">{value}</dd>
    </div>
  );
}

function MetaBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        {title}
      </p>
      <dl className="space-y-1">{children}</dl>
    </div>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <dt className="text-stone-500">{k}</dt>
      <dd className="text-right text-stone-900">{v}</dd>
    </div>
  );
}
