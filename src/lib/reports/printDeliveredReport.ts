const preparations = new WeakMap<HTMLElement, Promise<void>>();
export type PrintReadiness = {
  signal?: AbortSignal;
  settlements?: () => readonly Promise<void>[];
  timeoutMs?: number;
};

/** Coalesce clicks while the same selected report is being prepared. */
export function printDeliveredReport(
  root: HTMLElement,
  readiness: PrintReadiness = {},
): Promise<void> {
  const existing = preparations.get(root);
  if (existing) return existing;
  const preparation = prepare(root, readiness).finally(() => preparations.delete(root));
  preparations.set(root, preparation);
  return preparation;
}

/** Print only the selected, already-authorized report, never the account page. */
async function prepare(root: HTMLElement, readiness: PrintReadiness): Promise<void> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  readiness.signal?.addEventListener("abort", cancel, { once: true });
  if (readiness.signal?.aborted) cancel();
  let frame: HTMLIFrameElement | undefined;
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    cancel();
  }, readiness.timeoutMs ?? 12000);
  const valid = () => {
    if (controller.signal.aborted || !root.isConnected)
      throw new Error(
        timedOut
          ? "Report visuals did not finish loading. Nothing was printed. Please retry when the previews are ready."
          : "Report preparation cancelled. Nothing was printed.",
      );
  };
  const wait = async (promise: Promise<unknown>) => {
    valid();
    let abort: () => void = () => {};
    try {
      await Promise.race([
        promise,
        new Promise((_, reject) => {
          abort = () => reject(new Error("Report preparation interrupted"));
          controller.signal.addEventListener("abort", abort, { once: true });
        }),
      ]);
    } finally {
      controller.signal.removeEventListener("abort", abort);
      valid();
    }
  };
  try {
    // Settlements may register while React commits the selected report's children.
    // Two paint turns let terminal fallback/image state commit before cloning.
    let observed: readonly Promise<void>[] = [];
    do {
      observed = [...(readiness.settlements?.() ?? [])];
      await wait(Promise.all(observed));
      await wait(
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
      );
    } while ((readiness.settlements?.() ?? []).some((p) => !observed.includes(p)));
    valid();
    frame = document.createElement("iframe");
    const printableFrame = frame;
    frame.title = "Printable delivered Easy Erf Report";
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, {
      position: "fixed",
      width: "794px",
      height: "1123px",
      opacity: "0",
      pointerEvents: "none",
      left: "-10000px",
    });
    document.body.appendChild(frame);
    const target = frame.contentDocument;
    if (!target || !frame.contentWindow) {
      frame.remove();
      return;
    }
    target.title = "Easy Erf delivered report";
    const style = target.createElement("style");
    style.textContent =
      "@page{size:A4;margin:14mm}body{margin:0;background:white;color:#0D1B2A}.report-no-print,button,input,textarea{display:none!important}.report-page{width:100%;max-width:none}details{display:block}summary{list-style:none}img{max-width:100%}";
    const styles = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(
      (link) =>
        new Promise<void>((resolve) => {
          const copy = target.createElement("link");
          copy.rel = "stylesheet";
          copy.href = link.href;
          copy.onload = copy.onerror = () => resolve();
          target.head.appendChild(copy);
        }),
    );
    for (const inline of document.querySelectorAll("style"))
      target.head.appendChild(inline.cloneNode(true));
    target.head.appendChild(style);
    const report = root.cloneNode(true) as HTMLElement;
    // Keep local images usable when the prepared document is exported separately.
    for (const image of report.querySelectorAll("img")) {
      image.src = new URL(image.getAttribute("src") ?? "", document.baseURI).href;
    }
    const originalCanvases = root.querySelectorAll("canvas");
    for (const [index, canvas] of [...report.querySelectorAll("canvas")].entries()) {
      const original = originalCanvases[index];
      try {
        const image = target.createElement("img");
        image.src = original.toDataURL();
        image.className = canvas.className;
        image.style.cssText = canvas.style.cssText;
        image.alt = original.getAttribute("aria-label") ?? "Recorded report map";
        canvas.replaceWith(image);
      } catch {
        const unavailable = target.createElement("p");
        unavailable.textContent =
          "Map image unavailable in this export. Refer to the saved report.";
        canvas.replaceWith(unavailable);
      }
    }
    for (const details of report.querySelectorAll("details")) details.open = true;
    for (const control of report.querySelectorAll(
      ".report-no-print, button, input, textarea, iframe, object",
    ))
      control.remove();
    target.body.appendChild(report);
    const imageUnavailable = (img: HTMLImageElement) => {
      const notice = target.createElement("p");
      notice.textContent = (img.alt || "Report image") + ": image unavailable in this export.";
      img.replaceWith(notice);
    };
    const images = [...target.images].map((img) =>
      img.complete
        ? Promise.resolve(img.naturalWidth ? undefined : imageUnavailable(img))
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => {
              imageUnavailable(img);
              resolve();
            };
          }),
    );
    await wait(Promise.all([...styles, ...images, target.fonts.ready]));
    valid();
    if (!frame.isConnected || !root.isConnected) {
      frame.remove();
      return;
    }
    const removeFrame = () => {
      printableFrame.remove();
      readiness.signal?.removeEventListener("abort", removeFrame);
    };
    readiness.signal?.addEventListener("abort", removeFrame, { once: true });
    frame.contentWindow.addEventListener("afterprint", removeFrame, { once: true });
    window.setTimeout(removeFrame, 120000);
    frame.contentWindow.focus();
    frame.contentWindow.print();
  } catch (error) {
    frame?.remove();
    if (readiness.signal?.aborted || !root.isConnected) return;
    throw error;
  } finally {
    clearTimeout(timeout);
    readiness.signal?.removeEventListener("abort", cancel);
  }
}
