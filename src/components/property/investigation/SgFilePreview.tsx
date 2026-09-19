import { useEffect, useState } from "react";
import { createErfAssetSignedUrl, type ErfAsset } from "@/lib/workbench/erfFileVault";
import { renderLocalSgTiff, SG_PREVIEW_MAX_BYTES } from "@/lib/workbench/sgLocalPreview";

export function SgFilePreview({
  asset,
  file,
  delegated,
}: {
  asset: ErfAsset;
  file?: File;
  delegated: boolean;
}) {
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(1);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tiff = /tiff?/i.test(asset.mime_type) || /\.tiff?$/i.test(asset.original_file_name);
  const pdf = asset.mime_type === "application/pdf";
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    let active = true;
    setUrl(null);
    setError(null);
    // Existing delegated access uses its authorised Open file control. Never
    // substitute the worker's Storage identity for the customer's file.
    if (delegated && !file) {
      setError("Use Open file to review the original in your assigned investigation.");
      return;
    }
    const deadline = setTimeout(() => {
      controller.abort();
      if (active) setError("Preview is taking too long. Open the original for manual review.");
    }, 12_000);
    void (async () => {
      try {
        if (asset.size_bytes > SG_PREVIEW_MAX_BYTES)
          throw new Error("File exceeds the local preview limit.");
        let source: Blob = file!;
        if (!source) {
          const signed = await createErfAssetSignedUrl(asset);
          if (!active || controller.signal.aborted) return;
          const response = await fetch(signed, { signal: controller.signal });
          if (!response.ok) throw new Error("The stored original could not be opened.");
          source = await response.blob();
        }
        if (source.size > SG_PREVIEW_MAX_BYTES)
          throw new Error("File exceeds the local preview limit.");
        if (tiff) {
          const rendered = await renderLocalSgTiff(source, page, controller.signal);
          source = rendered.blob;
          if (active) setCount(rendered.pageCount);
        } else if (!pdf && !["image/png", "image/jpeg", "image/webp"].includes(asset.mime_type)) {
          throw new Error(
            "No inline preview for this format. Open the original for manual review.",
          );
        }
        if (!active || controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(source);
        setUrl(objectUrl);
      } catch (failure) {
        if (active)
          setError(
            controller.signal.aborted
              ? "Preview is taking too long. Open the original for manual review."
              : failure instanceof Error
                ? failure.message
                : "Preview unavailable. Open the original for manual review.",
          );
      } finally {
        clearTimeout(deadline);
      }
    })();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(deadline);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset, delegated, file, page, pdf, tiff]);
  return (
    <section aria-label="Stored SG file preview" className="mt-3 space-y-2">
      <p className="text-xs font-semibold">
        Original file retained. Preview is not identity verification.
      </p>
      {error ? (
        <p role="status" className="text-xs text-amber-900">
          {error}
        </p>
      ) : !url ? (
        <p role="status" className="text-xs">
          Preparing local preview. You can continue.
        </p>
      ) : pdf ? (
        <iframe title="SG original PDF preview" src={url} className="h-80 w-full border" />
      ) : (
        <img
          src={url}
          alt={`SG file preview, page ${page + 1}; identity not verified by preview`}
          className="max-h-96 w-full object-contain"
          onError={() =>
            setError("Preview could not be displayed. Open the original for manual review.")
          }
        />
      )}
      {count > 1 ? (
        <label className="flex items-center gap-2 text-xs">
          Preview page
          <select value={page} onChange={(event) => setPage(Number(event.target.value))}>
            {Array.from({ length: count }, (_, index) => (
              <option key={index} value={index}>
                Page {index + 1}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p className="text-xs text-slate-600">
        A General Plan may contain several erfs. Previewing a sheet does not bind its findings to
        the selected erf.
      </p>
    </section>
  );
}
