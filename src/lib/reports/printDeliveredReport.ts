/** Print only the selected, already-authorized report, never the account page. */
export async function printDeliveredReport(root: HTMLElement): Promise<void> {
  const frame = document.createElement("iframe");
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
      unavailable.textContent = "Map image unavailable in this export. Refer to the saved report.";
      canvas.replaceWith(unavailable);
    }
  }
  for (const details of report.querySelectorAll("details")) details.open = true;
  for (const control of report.querySelectorAll(
    ".report-no-print, button, input, textarea, iframe, object",
  ))
    control.remove();
  target.body.appendChild(report);
  const images = [...target.images].map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.onload = img.onerror = () => resolve();
        }),
  );
  await Promise.race([
    Promise.all([...styles, ...images, target.fonts.ready]),
    new Promise((resolve) => window.setTimeout(resolve, 8000)),
  ]);
  if (!frame.isConnected || !root.isConnected) {
    frame.remove();
    return;
  }
  frame.contentWindow.addEventListener("afterprint", () => frame.remove(), { once: true });
  window.setTimeout(() => frame.remove(), 120000);
  frame.contentWindow.focus();
  frame.contentWindow.print();
}
