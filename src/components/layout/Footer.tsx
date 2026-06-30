import { Link } from "@tanstack/react-router";
import { AtlasPin } from "@/components/brand/AtlasPin";
import { BRAND } from "@/lib/brand";

const COMPANY_LINKS = [
  { to: "/about", label: "About" },
  { to: "/why", label: `Why ${BRAND.site}` },
  { to: "/how-it-works", label: "How it works" },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/partnerships", label: "Partnerships" },
  { to: "/contact", label: "Contact" },
] as const;

const PRODUCT_LINKS = [
  { to: "/", label: "Map" },
  { to: "/features", label: "Features" },
  { to: "/reports", label: "Reports" },
  { to: "/pricing", label: "Pricing" },
  { to: "/for-investors", label: "For Investors" },
  { to: "/for-homeowners", label: "For Homeowners" },
  { to: "/for-developers", label: "For Developers" },
  { to: "/faq", label: "FAQ" },
  { to: "/dashboard", label: "Dashboard" },
] as const;

const LEGAL_LINKS = [
  { to: "/terms", label: "Terms of Use" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/disclaimer", label: "Disclaimer" },
  { to: "/data-sources", label: "Data Sources" },
  { to: "/subscriptions", label: "Subscriptions" },
] as const;

const FOOTER_MINI_LINKS = [
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/disclaimer", label: "Disclaimer" },
  { to: "/data-sources", label: "Data Sources" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="flex items-center gap-2">
            <AtlasPin variant="horizontal" className="h-8 w-auto" title={BRAND.site} />
          </div>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-accent">
            {BRAND.tagline}
          </p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
            South Africa's property intelligence community. A research and information platform —
            not a brokerage, valuer, advisor, or law firm.
          </p>
        </div>

        <FooterCol title="Product" links={PRODUCT_LINKS} className="md:col-span-3" />
        <FooterCol title="Company" links={COMPANY_LINKS} className="md:col-span-3" />
        <FooterCol title="Legal" links={LEGAL_LINKS} className="md:col-span-2" />
      </div>
      <div className="border-t border-border/60 px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            © {new Date().getFullYear()} ErfStoep. All Rights Reserved.
          </p>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Pilot data shown is mock data for demonstration purposes. Estimates are not certified valuations.
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
  links: ReadonlyArray<{ to: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <ul className="mt-3 space-y-2 text-xs">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-foreground/80 hover:text-foreground">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compact footer for the full-screen map view. */
export function FooterMini() {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 hidden border-t border-border/60 bg-card/85 px-4 py-1.5 backdrop-blur md:block">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span>© {new Date().getFullYear()} ErfStoep · All Rights Reserved</span>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {FOOTER_MINI_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-foreground">{l.label}</Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
