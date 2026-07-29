import type { InvestigationMessageKind } from "@/lib/investigation/types";

/** Dot colour per deterministic message kind. Presentation only. */
export const MESSAGE_TONE: Record<InvestigationMessageKind, string> = {
  identified: "bg-[#FF8A33]",
  supported: "bg-emerald-400",
  estimated: "bg-amber-300",
  missing: "bg-white/40",
  conflict: "bg-rose-400",
  reward: "bg-emerald-300",
  next_action: "bg-[#FF6A00]",
};
