// Safely open an external URL in a real new browser tab.
// Avoids being captured by an embed/iframe (e.g. Lovable preview) which causes
// some destinations (Google search) to render a "blocked" page.
import { toast } from "sonner";

export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

export function openExternalUrl(
  url: string,
  e?: { preventDefault?: () => void; stopPropagation?: () => void } | null,
): boolean {
  if (e?.preventDefault) e.preventDefault();
  if (e?.stopPropagation) e.stopPropagation();
  if (!isExternalUrl(url)) {
    toast.error("Invalid external link");
    return false;
  }
  // Try to break out of any embed/iframe by targeting the top window first.
  try {
    const top = typeof window !== "undefined" ? window.top ?? window : null;
    const w = top?.open(url, "_blank", "noopener,noreferrer");
    if (w) return true;
  } catch {
    /* cross-origin top — fall through */
  }
  const w2 = window.open(url, "_blank", "noopener,noreferrer");
  if (w2) return true;
  // Popup blocked — fallback: copy link
  copyToClipboard(url).then((ok) => {
    if (ok) toast.message("Popup blocked. Link copied to clipboard.");
    else toast.error("Popup blocked. Copy link manually.");
  });
  return false;
}
