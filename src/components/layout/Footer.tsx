import { Link } from "@tanstack/react-router";
import { MapPinned } from "lucide-react";

const LEGAL_LINKS = [
  { to: "/terms", label: "Terms of Use" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/disclaimer", label: "Disclaimer" },
  { to: "/data-sources", label: "Data Sources" },
  { to: "/subscriptions", label: "Subscriptions" },
  { to: "/contact", label: "Contact" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-brand text-white">
              <MapPinned className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Property<span className="text-primary">Atlas</span>
            </span>
          </div>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Map-based property intelligence for South Africa. A research and information
            platform — not a law firm, valuation company, or investment advisor.
          </p>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Product</div>
          <ul className="mt-3 space-y-2 text-xs">
            <li><Link to="/" className="text-foreground/80 hover:text-foreground">Map</Link></li>
            <li><Link to="/pricing" className="text-foreground/80 hover:text-foreground">Pricing</Link></li>
            <li><Link to="/dashboard" className="text-foreground/80 hover:text-foreground">Dashboard</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Legal</div>
          <ul className="mt-3 space-y-2 text-xs">
            {LEGAL_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-foreground/80 hover:text-foreground">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            © {new Date().getFullYear()} PropertyAtlas. All Rights Reserved.
          </p>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Pilot data shown is mock data for demonstration purposes. Estimates are not certified valuations.
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Compact footer for the full-screen map view. */
export function FooterMini() {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 hidden border-t border-border/60 bg-card/85 px-4 py-1.5 backdrop-blur md:block">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span>© {new Date().getFullYear()} PropertyAtlas · All Rights Reserved</span>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-foreground">{l.label}</Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
