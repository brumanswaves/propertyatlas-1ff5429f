// Pure Erf File Vault storage-path helpers.
//
// This module deliberately contains NO Supabase client, no browser globals and
// no framework imports so that trusted service-side code (TanStack server
// routes and Supabase Edge Functions) can reuse the exact same storage path
// shape as the browser vault without pulling in the browser Supabase client.
//
// Storage path shape is a production contract: changing it orphans existing
// stored objects. Keep these helpers byte-for-byte behaviour compatible.

export const ERF_FILE_BUCKET = "erf-files";

export function safeFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/\.+/g, ".")
    .slice(0, 120);
  return cleaned || "easy-erf-file";
}

export function safeErfAssetPathSegment(value: string) {
  const cleaned = value
    .normalize("NFKC")
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .replace(/[\\/]+/g, "-")
    .trim()
    .slice(0, 180);
  return cleaned || "unknown-parcel";
}

export function canonicalErfAssetStoragePath(storagePath: string) {
  const parts = storagePath.split("/");
  if (parts.length < 2) return storagePath;
  const parcelSegment = parts[1].replace(/%3A/gi, ":");
  if (parcelSegment === parts[1]) return storagePath;
  return [parts[0], parcelSegment, ...parts.slice(2)].join("/");
}

export function erfAssetStoragePathCandidates(storagePath: string) {
  const canonical = canonicalErfAssetStoragePath(storagePath);
  return canonical === storagePath ? [storagePath] : [canonical, storagePath];
}

export function buildErfAssetStoragePath(input: {
  userId: string;
  parcelId: string;
  category: string;
  assetId: string;
  fileName: string;
}) {
  return [
    input.userId,
    safeErfAssetPathSegment(input.parcelId),
    input.category,
    input.assetId,
    safeFileName(input.fileName),
  ].join("/");
}
