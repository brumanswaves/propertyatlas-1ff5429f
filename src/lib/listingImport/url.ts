import { assertSafeHttpUrl, assertSupportedListingHost } from "./security";
import { ListingImportError, type ListingPortal } from "./types";

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "msclkid",
];

export function validateImportUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ListingImportError(
      "INVALID_URL",
      "Please paste a full public listing URL.",
    );
  }
  assertSafeHttpUrl(url);
  return url;
}

export function canonicaliseListingUrl(url: URL): string {
  const next = new URL(url.toString());
  next.hash = "";
  next.hostname = next.hostname.toLowerCase();
  for (const param of TRACKING_PARAMS) next.searchParams.delete(param);
  if (next.pathname.length > 1) next.pathname = next.pathname.replace(/\/+$/, "");
  return next.toString();
}

export function detectListingPortal(url: URL): ListingPortal {
  assertSupportedListingHost(url);
  const host = url.hostname.toLowerCase();
  if (host === "property24.com" || host === "www.property24.com") return "property24";
  return "generic";
}
