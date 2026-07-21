export type PrintableImageReadiness =
  | { status: "ready"; url: string }
  | { status: "failed"; url: null };

export interface PrintableImageLoader {
  onload: ((event: Event) => void) | null;
  onerror: ((event: Event | string) => void) | null;
  src: string;
}

export function waitForRenderSettlement(win: Window = window) {
  return new Promise<void>((resolve) => {
    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => resolve());
    });
  });
}

export async function preloadPrintableImageUrl(
  createSignedUrl: () => Promise<string | null>,
  createImage: () => PrintableImageLoader = () => new Image(),
): Promise<PrintableImageReadiness> {
  let signedUrl: string | null = null;
  try {
    signedUrl = await createSignedUrl();
  } catch {
    return { status: "failed", url: null };
  }

  if (!signedUrl) return { status: "failed", url: null };

  return new Promise<PrintableImageReadiness>((resolve) => {
    const image = createImage();
    let settled = false;
    const finish = (result: PrintableImageReadiness) => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      resolve(result);
    };
    image.onload = () => finish({ status: "ready", url: signedUrl });
    image.onerror = () => finish({ status: "failed", url: null });
    image.src = signedUrl;
  });
}
