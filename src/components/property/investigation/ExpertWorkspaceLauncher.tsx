import { ArrowUpRight } from "lucide-react";
import type { DossierView } from "@/components/property/dossier/reportViews";

interface ExpertWorkspaceLauncherProps {
  onOpenExpertWorkspace: (view?: DossierView) => void;
  compact?: boolean;
}

export function ExpertWorkspaceLauncher({
  onOpenExpertWorkspace,
  compact = false,
}: ExpertWorkspaceLauncherProps) {
  return (
    <button
      type="button"
      onClick={() => onOpenExpertWorkspace("research")}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#0D1B2A]/12 bg-white px-4 py-2 text-xs font-semibold text-[#0D1B2A] shadow-sm transition hover:border-[#FF6A00]/35 hover:bg-[#fff8ec]"
    >
      Open full research workspace
      {!compact && <ArrowUpRight className="h-3.5 w-3.5" />}
    </button>
  );
}

export default ExpertWorkspaceLauncher;
