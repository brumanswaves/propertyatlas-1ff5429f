import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, AlertCircle, Landmark, ShieldCheck } from "lucide-react";
import { loadOfficialPublicLayer, type PublicDataResult } from "@/lib/providers/publicDataClient";
import { openExternalUrl } from "@/lib/external";
import { CSG_VIEWER_URL, KOUGA_MAPPING_URL } from "@/lib/external-urls";


interface Props {
  /** Property centroid [lng, lat] — used to build a tight bbox for the probe. */
  centroid: [number, number];
}

const PROBE_HALF_DEG = 0.0035; // ~~ 380m east-west buffer, plenty for a single parcel

interface ProbeState {
  loading: boolean;
  csg?: PublicDataResult;
  kouga?: PublicDataResult;
}

/**
 * Probes the official public ArcGIS layers (CSG + Kouga) for results
 * intersecting the parcel, and renders a "Last fetched" timestamp plus a
 * direct link to the official viewer when results are available.
 *
 * No data is stored; the panel just acknowledges whether the upstream source
 * was reachable and when.
 */
export function OfficialSourceCard({ centroid }: Props) {
  const [state, setState] = useState<ProbeState>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    const [lng, lat] = centroid;
    const bbox: [number, number, number, number] = [
      lng - PROBE_HALF_DEG, lat - PROBE_HALF_DEG,
      lng + PROBE_HALF_DEG, lat + PROBE_HALF_DEG,
    ];

    (async () => {
      const [csg, kouga] = await Promise.all([
        loadOfficialPublicLayer("csg-parcels", bbox, 5).catch(() => undefined),
        loadOfficialPublicLayer("kouga-zoning", bbox, 5).catch(() => undefined),
      ]);
      if (cancelled) return;
      setState({ loading: false, csg, kouga });
    })();
    return () => { cancelled = true; };
  }, [centroid[0], centroid[1]]);

  if (state.loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking official public sources…
      </div>
    );
  }

  const csgOk = (state.csg?.features.length ?? 0) > 0;
  const kougaOk = (state.kouga?.features.length ?? 0) > 0;

  if (!csgOk && !kougaOk) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 text-[11px] text-muted-foreground">
        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
        <div>
          No official public source returned results for this area. You can still open the public viewers below.
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <SourceLink href={CSG_VIEWER_URL} label="CSG viewer" />
            <SourceLink href={KOUGA_MAPPING_URL} label="Kouga portal" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {csgOk && state.csg && (
        <SourceRow
          Icon={ShieldCheck}
          tone="emerald"
          label="Chief Surveyor-General"
          count={state.csg.features.length}
          fetchedAt={state.csg.fetchedAt}
          href={CSG_VIEWER_URL}
        />
      )}
      {kougaOk && state.kouga && (
        <SourceRow
          Icon={Landmark}
          tone="sky"
          label="Kouga Municipality"
          count={state.kouga.features.length}
          fetchedAt={state.kouga.fetchedAt}
          href={KOUGA_MAPPING_URL}
        />
      )}
    </div>
  );
}

function SourceRow({
  Icon, tone, label, count, fetchedAt, href,
}: {
  Icon: typeof CheckCircle2;
  tone: "emerald" | "sky";
  label: string;
  count: number;
  fetchedAt: string;
  href: string;
}) {
  const friendly = new Date(fetchedAt).toLocaleString("en-ZA", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const ring = tone === "emerald" ? "border-emerald-200 bg-emerald-50/60" : "border-sky-200 bg-sky-50/60";
  const ic = tone === "emerald" ? "text-emerald-700" : "text-sky-700";
  return (
    <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${ring}`}>
      <div className="flex min-w-0 items-center gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${ic}`} />
        <div className="min-w-0">
          <div className="truncate text-[11.5px] font-semibold text-foreground">
            Official source: {label}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">
            {count} feature{count === 1 ? "" : "s"} · Last fetched {friendly}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => openExternalUrl(href, e)}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background px-2 py-1 text-[10px] font-semibold hover:bg-muted"
      >
        Open <ExternalLink className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <button type="button" onClick={(e) => openExternalUrl(href, e)} className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted">
      {label} <ExternalLink className="h-2.5 w-2.5" />
    </button>
  );
}

