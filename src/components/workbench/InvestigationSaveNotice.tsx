import { useSyncExternalStore } from "react";
import { browserScopedParcelKey } from "@/lib/workbench/erfWorkspaceState";

interface SaveNotice { message: string; loadSaved?: () => Promise<void> }
const notices = new Map<string, SaveNotice>();
const listeners = new Set<() => void>();
const keyFor = (parcelId: string, userId: string) => JSON.stringify([userId, parcelId]);
export function setInvestigationSaveNotice(parcelId: string, userId: string, notice: SaveNotice | null) {
  const key = keyFor(parcelId, userId);
  if (notice) notices.set(key, notice); else notices.delete(key);
  listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function InvestigationSaveNotice({ parcelId, userId }: { parcelId: string; userId: string | null }) {
  const notice = useSyncExternalStore(subscribe,
    () => userId ? notices.get(keyFor(parcelId, userId)) ?? null : null, () => null);
  let backup: string | null = null;
  try {
    if (userId && typeof window !== "undefined") backup = window.localStorage.getItem(browserScopedParcelKey("investigation-conflict-backups", parcelId, userId));
  } catch { /* Storage can be unavailable without hiding the save warning. */ }
  if (!notice && !backup) return null;
  function downloadBackup() {
    if (!backup) return;
    const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "easy-erf-preserved-drafts.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="mx-4 mt-4 border border-amber-300 bg-amber-50 p-3 md:mx-7" aria-label="This property's save status">
    {notice ? <p role="alert" className="text-sm text-amber-950">{notice.message}</p> : null}
    <div className="mt-2 flex flex-wrap gap-3">
      {notice?.loadSaved ? <button type="button" className="text-sm font-semibold underline" onClick={() => void notice.loadSaved?.()}>Keep a draft backup and load saved version</button> : null}
      {backup ? <button type="button" className="text-sm font-semibold underline" onClick={downloadBackup}>Download preserved drafts</button> : null}
    </div>
  </section>;
}
