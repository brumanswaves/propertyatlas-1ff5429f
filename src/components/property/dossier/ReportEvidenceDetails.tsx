import type { ReactNode } from "react";
import { ArrowUp } from "lucide-react";

export function ReportEvidenceDetails({ title, children, printOnly = false }: {
  title: string; children: ReactNode; printOnly?: boolean;
}) {
  return <details open={printOnly || undefined} className="report-evidence-details border-b border-border py-4">
    <summary className="cursor-pointer text-base font-semibold text-primary">{title}</summary>
    <div className="mt-4 space-y-5">{children}</div>
    {!printOnly && <a href="#report-next-action" data-report-return className="report-no-print mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline">
      <ArrowUp className="h-4 w-4" /> Back to report summary</a>}
  </details>;
}
