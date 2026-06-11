import { Link } from "@tanstack/react-router";
import { MapPinned } from "lucide-react";

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
            Map-based property intelligence for South Africa. Built for buyers, investors,
            developers, and property professionals.
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
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pilot</div>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            <li>St Francis Bay · Eastern Cape</li>
            <li>Coverage expanding nationally</li>
            <li>info@propertyatlas.co.za</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 px-6 py-4">
        <p className="mx-auto max-w-6xl text-[10px] leading-relaxed text-muted-foreground">
          © {new Date().getFullYear()} PropertyAtlas. Pilot data shown is mock data for demonstration purposes.
          PropertyAtlas does not yet provide official deeds, valuation, or ownership records.
        </p>
      </div>
    </footer>
  );
}
