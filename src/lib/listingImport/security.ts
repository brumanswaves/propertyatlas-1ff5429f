import { ListingImportError } from "./types";

const PROPERTY24_HOSTS = new Set(["property24.com", "www.property24.com"]);
const INTERNAL_HOSTS = new Set(["localhost", "localhost.localdomain", "0.0.0.0"]);

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "");
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isBlockedIpv6(host: string): boolean {
  const value = normalizeHost(host);
  return (
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe80:") ||
    value === "::" ||
    value.startsWith("::ffff:127.") ||
    value.startsWith("::ffff:10.") ||
    value.startsWith("::ffff:192.168.")
  );
}

export function isBlockedHost(host: string): boolean {
  const value = normalizeHost(host);
  if (!value) return true;
  if (INTERNAL_HOSTS.has(value)) return true;
  if (value.endsWith(".localhost") || value.endsWith(".local") || value.endsWith(".internal")) {
    return true;
  }
  if (isPrivateIpv4(value)) return true;
  if (value.includes(":") && isBlockedIpv6(value)) return true;
  return false;
}

export function assertSafeHttpUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ListingImportError(
      "INVALID_URL",
      "Please paste a public property listing URL that starts with http:// or https://.",
    );
  }
  if (isBlockedHost(url.hostname)) {
    throw new ListingImportError(
      "BLOCKED",
      "This URL is not allowed for listing import.",
      { details: "Internal, localhost, and private-network hosts are blocked." },
    );
  }
}

export function assertSupportedListingHost(url: URL) {
  assertSafeHttpUrl(url);
  const host = normalizeHost(url.hostname);
  if (!PROPERTY24_HOSTS.has(host)) {
    throw new ListingImportError(
      "UNSUPPORTED_URL",
      "This listing source is not supported yet. Property24 URLs are supported first.",
    );
  }
}

export function assertSafeRedirectTarget(url: URL) {
  assertSafeHttpUrl(url);
  const host = normalizeHost(url.hostname);
  if (!PROPERTY24_HOSTS.has(host)) {
    throw new ListingImportError(
      "BLOCKED",
      "The listing redirected to an unsupported or unsafe host.",
    );
  }
}
