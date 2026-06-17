import { Database, ShieldCheck, ShieldAlert, ShieldQuestion, Landmark } from "lucide-react";
import type { ProviderId } from "@/lib/providers/types";
import { getProvider } from "@/lib/providers/registry";
import { cn } from "@/lib/utils";

/**
 * Source label vocabulary used across the property panel.
 * Mirrors the language required by the data-licensing notice and lets every
 * cadastral field disclose its provenance honestly.
 */
export type CadastralSource =
  | ProviderId          // "demo" | "surveyor-general" | "municipal-gis" | ...
  | "kouga"             // alias for Kouga Local Municipality (subset of municipal-gis)
  | "not_available"     // no public source supplies this field
  | "not_verified";     // user-entered / unconfirmed

interface BadgeMeta {
  label: string;
  short: string;
  tone: string;
  Icon: typeof Database;
}

const PROVIDER_LABEL: Record<ProviderId, string> = {
  demo: "Demo",
  "surveyor-general": "Chief Surveyor-General",
  "municipal-gis": "Municipal GIS",
  windeed: "WinDeed",
  lightstone: "Lightstone",
};

function metaFor(source: CadastralSource): BadgeMeta {
  switch (source) {
    case "demo":
      return { label: "Demo data", short: "Demo", tone: "bg-amber-100 text-amber-800 border-amber-200", Icon: Database };
    case "surveyor-general":
      return { label: "Chief Surveyor-General", short: "CSG", tone: "bg-emerald-100 text-emerald-800 border-emerald-200", Icon: ShieldCheck };
    case "municipal-gis":
      return { label: "Municipal GIS", short: "Municipal", tone: "bg-sky-100 text-sky-800 border-sky-200", Icon: Landmark };
    case "kouga":
      return { label: "Kouga Municipality", short: "Kouga", tone: "bg-sky-100 text-sky-800 border-sky-200", Icon: Landmark };
    case "windeed":
      return { label: "WinDeed", short: "WinDeed", tone: "bg-violet-100 text-violet-800 border-violet-200", Icon: ShieldCheck };
    case "lightstone":
      return { label: "Lightstone", short: "Lightstone", tone: "bg-violet-100 text-violet-800 border-violet-200", Icon: ShieldCheck };
    case "not_available":
      return { label: "Not available from public source", short: "Not available", tone: "bg-muted text-muted-foreground border-border", Icon: ShieldAlert };
    case "not_verified":
      return { label: "Not verified", short: "Not verified", tone: "bg-muted text-muted-foreground border-border", Icon: ShieldQuestion };
  }
}

/**
 * Small inline chip that labels a single field's provenance.
 * Use next to cadastral rows (zoning, valuation, owner, etc.).
 */
export function FieldSourceBadge({
  source,
  className,
  title,
}: {
  source: CadastralSource;
  className?: string;
  title?: string;
}) {
  const m = metaFor(source);
  return (
    <span
      title={title ?? m.label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
        m.tone,
        className,
      )}
    >
      <m.Icon className="h-2.5 w-2.5" />
      {m.short}
    </span>
  );
}

interface Props {
  source: ProviderId;
  lastUpdated?: string;
}

// Source / Provider / Last Updated strip — used at the bottom of each
// PropertyPanel tab and in the report marketplace.
export function SourceBadge({ source, lastUpdated }: Props) {
  const provider = getProvider(source);
  const friendly = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString("en-ZA", { year: "numeric", month: "short" })
    : "—";
  const friendlyName = PROVIDER_LABEL[source] ?? provider.meta.name;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      <Database className="h-3 w-3" />
      <span>Source: {friendlyName}</span>
      <span className="opacity-40">·</span>
      <span>Provider: {provider.meta.id}</span>
      <span className="opacity-40">·</span>
      <span>Last updated: {friendly}</span>
    </div>
  );
}
