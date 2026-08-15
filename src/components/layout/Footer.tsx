import { Link } from "@tanstack/react-router";
import { AtlasPin } from "@/components/brand/AtlasPin";
import { BRAND } from "@/lib/brand";
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_PRODUCT_LINKS,
  FOOTER_RESOURCE_LINKS,
  MAP_FOOTER_LINKS,
} from "@/lib/navigation";

type FooterLink =
  | (typeof FOOTER_PRODUCT_LINKS)[number]
  | (typeof FOOTER_RESOURCE_LINKS)[number]
  | (typeof FOOTER_LEGAL_LINKS)[number];

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="flex items-center gap-2">
            <AtlasPin variant="horizontal" className="h-8 w-auto" title={BRAND.site} />
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-accent">
            {BRAND.tagline}
          </p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
            A South African property investigation platform that connects parcel identity, evidence,
            planning, market context, Strategy, Site Potential and a living report in one guided
            property file.
          </p>
          <p className="mt-3 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
            {BRAND.copy.pilotNote}
          </p>
        </div>

        <FooterCol title="Product" links={FOOTER_PRODUCT_LINKS} className="md:col-span-3" />
        <FooterCol title="Resources" links={FOOTER_RESOURCE_LINKS} className="md:col-span-3" />
        <FooterCol title="Legal" links={FOOTER_LEGAL_LINKS} className="md:col-span-2" />
      </div>
      <div className="border-t border-border/60 px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            © 2026 Easy Erf. All rights reserved.
          </p>
          <p className="max-w-2xl text-[10px] leading-relaxed text-muted-foreground md:text-right">
            Easy Erf is an information and investigation platform, not municipal approval,
            professional planning advice, a certified valuation, or legal advice.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
  className,
}: {
  title: string;
  links: readonly FooterLink[];
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ul className="mt-3 space-y-2 text-xs">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="text-foreground/80 hover:text-foreground">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compact footer for the full-screen map view. */
export function FooterMini() {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 hidden border-t border-primary-foreground/10 bg-primary/90 px-6 py-2 backdrop-blur-xl md:block">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10.5px] font-medium text-primary-foreground/55">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-success shadow-soft" />
          © 2026 Easy Erf
        </span>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Map footer">
          {MAP_FOOTER_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="hover:text-primary-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
