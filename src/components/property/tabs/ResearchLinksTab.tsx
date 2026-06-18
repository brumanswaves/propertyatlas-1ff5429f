import { ExternalLink, Map, Building2, FileText, Search, Landmark, Copy } from "lucide-react";
import { SourceBadge } from "@/components/data/SourceBadge";
import { ComplianceNotice } from "@/components/common/ComplianceNotice";
import { buildResearchLinks, type ResearchContext, type ResearchLink } from "@/lib/research/links";
import { SavedLinksManager } from "@/components/property/SavedLinksManager";
import { openExternalUrl, copyToClipboard } from "@/lib/external";
import { toast } from "sonner";

const CATEGORY_META: Record<ResearchLink["category"], { label: string; icon: React.ReactNode }> = {
  maps:      { label: "Map & location", icon: <Map className="h-3.5 w-3.5" /> },
  listings:  { label: "Listings",        icon: <Building2 className="h-3.5 w-3.5" /> },
  official:  { label: "Municipal",       icon: <Landmark className="h-3.5 w-3.5" /> },
  documents: { label: "Documents",       icon: <FileText className="h-3.5 w-3.5" /> },
  general:   { label: "General web",     icon: <Search className="h-3.5 w-3.5" /> },
};

export function ResearchLinksTab({ ctx, parcelId }: { ctx: ResearchContext; parcelId?: string }) {
  const links = buildResearchLinks(ctx);
  const grouped = (["maps", "official", "general"] as const).map((cat) => ({
    cat, items: links.filter((l) => l.category === cat),
  }));


  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Outbound research links</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Quick links to research this property on public sites. Listing-portal searches live in the <span className="font-medium text-foreground">Listings</span> tab. Paid deeds/AVM reports live in the <span className="font-medium text-foreground">Reports</span> tab.
        </p>
      </div>

      {grouped.map(({ cat, items }) => (
        <section key={cat}>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((l) => (
              <li key={l.id}>
                <div className="group flex items-start gap-2 rounded-xl border border-border bg-card p-3 transition hover:border-primary/40 hover:bg-muted/40">
                  <button
                    type="button"
                    onClick={(e) => openExternalUrl(l.href, e)}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                    title={l.href}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-foreground/70 group-hover:bg-primary/10 group-hover:text-primary">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-semibold text-foreground">{l.label}</span>
                      <span className="mt-0.5 block text-[10.5px] text-muted-foreground">{l.description}</span>
                      <span className="mt-1 inline-block rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">External · new tab</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault(); e.stopPropagation();
                      const ok = await copyToClipboard(l.href);
                      if (ok) toast.success("Link copied");
                      else toast.error("Could not copy link");
                    }}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Copy link"
                    aria-label="Copy link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {parcelId && (
        <section>
          <SavedLinksManager parcelId={parcelId} />
        </section>
      )}

      <ComplianceNotice />
      <SourceBadge source="demo" />
    </div>
  );
}
