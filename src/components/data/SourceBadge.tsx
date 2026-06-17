import { Database } from "lucide-react";
import type { ProviderId } from "@/lib/providers/types";
import { getProvider } from "@/lib/providers/registry";

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
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      <Database className="h-3 w-3" />
      <span>Source: {provider.meta.name}</span>
      <span className="opacity-40">·</span>
      <span>Provider: {provider.meta.id}</span>
      <span className="opacity-40">·</span>
      <span>Last updated: {friendly}</span>
    </div>
  );
}
