import { ExternalLink, Map, Building2, FileText, Search, Landmark } from "lucide-react";
import { SourceBadge } from "@/components/data/SourceBadge";
import { ComplianceNotice } from "@/components/common/ComplianceNotice";
import { buildResearchLinks, type ResearchContext, type ResearchLink } from "@/lib/research/links";

const CATEGORY_META: Record<ResearchLink["category"], { label: string; icon: React.ReactNode }> = {
  maps:     { label: "Maps & street view",            icon: <Map className="h-3.5 w-3.5" /> },
  listings: { label: "Search listing portals",        icon: <Building2 className="h-3.5 w-3.5" /> },
  official: { label: "Municipal & official sources",  icon: <Landmark className="h-3.5 w-3.5" /> },
  deeds:    { label: "Deeds office & Surveyor General", icon: <FileText className="h-3.5 w-3.5" /> },
  general:  { label: "General web",                   icon: <Search className="h-3.5 w-3.5" /> },
};

export function ResearchLinksTab({ ctx }: { ctx: ResearchContext }) {
  const links = buildResearchLinks(ctx);
  const grouped = (["maps", "listings", "official", "deeds", "general"] as const).map((cat) => ({
    cat, items: links.filter((l) => l.category === cat),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Outbound research links</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Quick links to search this property on public sites (maps, listing portals, municipal & deeds). PropertyAtlas does not scrape or store data from these sites. To save listings you find, use the <span className="font-medium text-foreground">Listings</span> tab. To order paid reports, use the <span className="font-medium text-foreground">Reports</span> tab.
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
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 rounded-xl border border-border bg-card p-3 transition hover:border-primary/40 hover:bg-muted/40"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-foreground/70 group-hover:bg-primary/10 group-hover:text-primary">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-foreground">{l.label}</span>
                    <span className="mt-0.5 block text-[10.5px] text-muted-foreground">{l.description}</span>
                    <span className="mt-1 inline-block rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">External source</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <ComplianceNotice />
      <SourceBadge source="demo" />
    </div>
  );
}
