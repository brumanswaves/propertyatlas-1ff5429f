import {
  absoluteUrl,
  areaFromText,
  decodeHtml,
  moneyFromText,
  numberFromText,
  readJsonLd,
  readMeta,
  readTitle,
  stripTags,
  unique,
} from "./html";

export interface MetadataExtraction {
  title: string | null;
  description: string | null;
  imageUrls: string[];
  askingPrice: number | null;
  streetAddress: string | null;
  suburb: string | null;
  town: string | null;
  province: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floorSizeM2: number | null;
  listingDate: string | null;
  agentName: string | null;
  agencyName: string | null;
  evidence: Array<{ field: string; value: unknown; method: "json-ld" | "open-graph"; sourceText: string }>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? decodeHtml(value) : null;
}

function firstString(value: unknown): string | null {
  if (Array.isArray(value)) return asString(value[0]);
  return asString(value);
}

function findJsonLdListing(values: unknown[]): Record<string, unknown> | null {
  const queue = [...values];
  while (queue.length) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    const record = asRecord(current);
    if (!record) continue;
    const type = Array.isArray(record["@type"]) ? record["@type"].join(" ") : String(record["@type"] ?? "");
    if (/product|offer|residence|house|apartment|realestate|place/i.test(type)) return record;
    for (const value of Object.values(record)) {
      if (Array.isArray(value) || asRecord(value)) queue.push(value);
    }
  }
  return null;
}

function firstListingPriceText(text: string): string | null {
  const matches = [...text.matchAll(/(?:^|\s)R\s?[\d\s,.]{4,}/gi)];
  for (const match of matches) {
    const index = match.index ?? 0;
    const before = text.slice(Math.max(0, index - 60), index).toLowerCase();
    if (/rates|taxes|lev(?:y|ies)|deposit|repayment|costs|income|purchase price/.test(before)) {
      continue;
    }
    return match[0]?.trim() ?? null;
  }
  return null;
}

export function extractMetadata(html: string, baseUrl: string): MetadataExtraction {
  const jsonLd = findJsonLdListing(readJsonLd(html));
  const jsonAddress = asRecord(jsonLd?.address);
  const jsonOffers = asRecord(jsonLd?.offers) ?? asRecord(jsonLd?.Offer);
  const jsonGeo = asRecord(jsonLd?.geo);
  const text = stripTags(html);

  const ogTitle = readMeta(html, "og:title");
  const ogDescription = readMeta(html, "og:description") ?? readMeta(html, "description");
  const ogImage = absoluteUrl(readMeta(html, "og:image"), baseUrl);
  const title = asString(jsonLd?.name) ?? ogTitle ?? readTitle(html);
  const description = asString(jsonLd?.description) ?? ogDescription;
  const priceText =
    asString(jsonOffers?.price) ??
    asString(jsonOffers?.lowPrice) ??
    readMeta(html, "product:price:amount") ??
    firstListingPriceText(text) ??
    null;

  const images = unique([
    ogImage,
    firstString(jsonLd?.image) ? absoluteUrl(firstString(jsonLd?.image), baseUrl) : null,
  ]);

  const bedroomsText = text.match(/(\d+(?:[.,]\d+)?)\s*bed(?:room)?s?/i)?.[1] ?? null;
  const bathroomsText = text.match(/(\d+(?:[.,]\d+)?)\s*bath(?:room)?s?/i)?.[1] ?? null;
  const floorText = text.match(/(?:floor|building)\s*size\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m²|sqm)/i)?.[0] ?? null;

  const evidence: MetadataExtraction["evidence"] = [];
  const addEvidence = (field: string, value: unknown, method: "json-ld" | "open-graph", sourceText: string | null) => {
    if (value == null || value === "") return;
    evidence.push({ field, value, method, sourceText: sourceText ?? String(value) });
  };

  addEvidence("property.title", title, jsonLd?.name ? "json-ld" : "open-graph", title);
  addEvidence("listing.description", description, jsonLd?.description ? "json-ld" : "open-graph", description);
  addEvidence("property.askingPrice", moneyFromText(priceText), jsonOffers?.price ? "json-ld" : "open-graph", priceText);
  addEvidence("property.streetAddress", asString(jsonAddress?.streetAddress), "json-ld", asString(jsonAddress?.streetAddress));

  return {
    title,
    description,
    imageUrls: images,
    askingPrice: moneyFromText(priceText),
    streetAddress: asString(jsonAddress?.streetAddress),
    suburb: asString(jsonAddress?.addressLocality),
    town: asString(jsonAddress?.addressRegion) ?? null,
    province: asString(jsonAddress?.addressRegion),
    postalCode: asString(jsonAddress?.postalCode),
    latitude: numberFromText(asString(jsonGeo?.latitude)),
    longitude: numberFromText(asString(jsonGeo?.longitude)),
    propertyType: asString(jsonLd?.additionalType) ?? asString(jsonLd?.["@type"]) ?? null,
    bedrooms: numberFromText(bedroomsText),
    bathrooms: numberFromText(bathroomsText),
    floorSizeM2: areaFromText(floorText),
    listingDate: asString(jsonLd?.datePosted) ?? null,
    agentName: asString(asRecord(jsonLd?.seller)?.name),
    agencyName: asString(asRecord(jsonLd?.brand)?.name),
    evidence,
  };
}
