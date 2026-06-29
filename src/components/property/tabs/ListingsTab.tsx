import { MarketEvidenceTab } from "@/features/marketEvidence/components/MarketEvidenceTab";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import type { ResearchContext } from "@/lib/research/links";

export function ListingsTab({
  parcel,
  parcelId,
  ctx,
}: {
  parcel?: NormalizedOfficialParcel;
  parcelId?: string;
  ctx?: ResearchContext;
  showSourceBadge?: boolean;
}) {
  if (parcel) return <MarketEvidenceTab parcel={parcel} />;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold tracking-tight">Listings & Comps</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Listings & Comps is available for official parcel dossiers. Open an official public parcel
        to confirm the address, search portals, and save useful comps.
      </p>
      {parcelId && (
        <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{parcelId}</p>
      )}
      {ctx && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Context loaded:{" "}
          {[ctx.erf && `Erf ${ctx.erf}`, ctx.area, ctx.town].filter(Boolean).join(" / ") ||
            "manual context only"}
        </p>
      )}
    </div>
  );
}

export { MarketEvidenceTab };
