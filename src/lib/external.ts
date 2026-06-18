// Safely open an external URL in a single new browser tab.
// Single window.open call with a short debounce to prevent double-opens
// from rapid clicks or duplicate handlers. Falls back to clipboard if blocked.
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

let lastOpenedUrl = "";
let lastOpenedAt = 0;
const DEBOUNCE_MS = 750;

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
  const now = Date.now();
  if (lastOpenedUrl === url && now - lastOpenedAt < DEBOUNCE_MS) {
    return false;
  }
  lastOpenedUrl = url;
  lastOpenedAt = now;

  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (win) return true;
  // Popup blocked — fallback: copy link
  copyToClipboard(url).then((ok) => {
    if (ok) toast.message("Popup blocked. Link copied to clipboard.");
    else toast.error("Popup blocked. Copy link manually.");
  });
  return false;
}
