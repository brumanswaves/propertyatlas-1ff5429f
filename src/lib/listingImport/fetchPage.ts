import { createHash } from "node:crypto";
import { assertSafeRedirectTarget } from "./security";
import { ListingImportError, type FetchedListingPage, type ListingImportDependencies } from "./types";

const MAX_REDIRECTS = 4;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 9000;
const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];
const USER_AGENT =
  "EasyErfListingImporter/1.0 (+https://easyerf.example; public listing evidence review)";

function contentTypeAllowed(value: string | null): boolean {
  if (!value) return true;
  const lower = value.toLowerCase().split(";")[0]?.trim() ?? "";
  return ALLOWED_CONTENT_TYPES.includes(lower);
}

function hashContent(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MAX_BYTES) {
    throw new ListingImportError(
      "BLOCKED",
      "The listing page is too large to import safely.",
      { details: "Response exceeded the listing import size limit." },
    );
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    throw new ListingImportError(
      "BLOCKED",
      "The listing page is too large to import safely.",
      { details: "Response exceeded the listing import size limit." },
    );
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

export async function fetchListingPage(
  url: URL,
  deps: ListingImportDependencies = {},
): Promise<FetchedListingPage> {
  let current = new URL(url.toString());
  const fetcher = deps.fetcher ?? fetch;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    assertSafeRedirectTarget(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetcher(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": USER_AGENT,
        },
      });
    } catch (err) {
      const aborted = (err as Error)?.name === "AbortError";
      throw new ListingImportError(
        "FETCH_FAILED",
        aborted ? "The listing page took too long to respond." : "Could not fetch the listing page.",
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      throw new ListingImportError(
        "RATE_LIMITED",
        "The listing source rate-limited the import request. Try again later.",
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new ListingImportError("FETCH_FAILED", "The listing source redirected without a target.");
      }
      current = new URL(location, current);
      assertSafeRedirectTarget(current);
      continue;
    }

    if (!response.ok) {
      throw new ListingImportError(
        "FETCH_FAILED",
        "Could not fetch the public listing page.",
        { details: `Listing source responded with HTTP ${response.status}.` },
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentTypeAllowed(contentType)) {
      throw new ListingImportError(
        "BLOCKED",
        "The listing response was not an HTML page.",
        { details: "Only public HTML listing pages can be imported." },
      );
    }

    const html = await readLimitedText(response);
    return {
      requestedUrl: url.toString(),
      finalUrl: current.toString(),
      html,
      contentType,
      fetchedAt: (deps.now?.() ?? new Date()).toISOString(),
      contentHash: hashContent(html),
    };
  }

  throw new ListingImportError("BLOCKED", "The listing redirected too many times.");
}
