import { fetchListingPage } from "../fetchPage";
import {
  areaFromText,
  decodeHtml,
  extractTextAfterLabel,
  moneyFromText,
  numberFromText,
  stripTags,
  unique,
} from "../extractors/html";
import { extractMetadata } from "../extractors/metadata";
import { canonicaliseListingUrl } from "../url";
import type {
  FetchedListingPage,
  ListingImportDependencies,
  ListingProvider,
  RawListingExtraction,
} from "../types";

function hostCanHandle(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return host === "property24.com" || host === "www.property24.com";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractProperty24ListingId(url: URL, html?: string): string | null {
  const params = ["ListingNumber", "listingNumber", "listingId", "id"];
  for (const key of params) {
    const value = url.searchParams.get(key);
    if (value && /^\d{5,}$/.test(value)) return value;
  }
  const pathMatch = url.pathname.match(/(?:\/|[-_])(\d{5,})(?:\/)?$/);
  if (pathMatch?.[1]) return pathMatch[1];
  const anyPathNumber = [...url.pathname.matchAll(/(\d{5,})/g)].at(-1)?.[1];
  if (anyPathNumber) return anyPathNumber;
  const htmlMatch = html?.match(/(?:listing(?:\s|&nbsp;)*number|property24\s*id)\s*:?\s*(\d{5,})/i);
  return htmlMatch?.[1] ?? null;
}

const PROPERTY_OVERVIEW_STOP_LABELS = [
  "Listing Number",
  "Type of Property",
  "Description",
  "Lifestyle",
  "Listing Date",
  "Erf Size",
  "Floor Size",
  "Rates and Taxes",
  "Rates & Taxes",
  "Levies",
  "Pets Allowed",
  "Occupation",
  "Rooms",
  "Bedrooms",
  "Bathrooms",
  "Kitchens",
  "Lounge",
  "Dining Rooms",
  "External Features",
  "Parking",
  "Garages",
  "Garden",
  "Pool",
  "Building",
  "Other Features",
  "Points of Interest",
  "Bond Calculator",
  "Contact Agent",
  "Share",
  "Print Report",
];

function propertyOverviewText(text: string): string {
  const match = text.match(
    /Property Overview\s+([\s\S]*?)(?=\s+(?:Rooms|External Features|Building|Other Features|Points of Interest|Bond Calculator|Contact Agent|Share|Print Report)\b|$)/i,
  );
  return match?.[1] ?? text;
}

function boundedLabelValue(
  text: string,
  labels: string[],
  stopLabels = PROPERTY_OVERVIEW_STOP_LABELS,
): string | null {
  const stops = stopLabels.map(escapeRegExp).join("|");
  for (const label of labels) {
    const escaped = escapeRegExp(label);
    const match = text.match(
      new RegExp(`(?:^|\\s)${escaped}\\s*:?\\s*(.+?)(?=\\s+(?:${stops})\\b|$)`, "i"),
    );
    const value = decodeHtml(match?.[1] ?? "").replace(/\s+/g, " ").trim();
    if (value && value.length <= 160) return value;
  }
  return null;
}

function extractBreadcrumbLocation(text: string): {
  suburb: string | null;
  town: string | null;
  province: string | null;
} {
  const match = text.match(
    /Property for Sale\s*>\s*([^>]+?)\s*>\s*([^>]+?)\s*>\s*([^>]+?)\s*>\s*\d{5,}/i,
  );
  return {
    province: match?.[1]?.trim() ?? null,
    town: match?.[2]?.trim() ?? null,
    suburb: match?.[3]?.trim() ?? null,
  };
}

function extractContactAgentName(text: string): string | null {
  const match = text.match(
    /Privacy Policy\s*\.\s*([A-Z][A-Za-z.' -]{2,80})\s+Show Contact Number/i,
  );
  return match?.[1]?.trim() ?? null;
}

function extractAgencyName(text: string, agentName: string | null): string | null {
  if (agentName) {
    const escapedName = escapeRegExp(agentName);
    const exactMatch = text.match(
      new RegExp(`\\b((?:RE\\/MAX|Pam Golding|Seeff|Rawson|Chas Everitt)[A-Za-z0-9&/' .-]{0,90})\\s+${escapedName}\\s+Show Contact Number`, "i"),
    );
    if (exactMatch?.[1]) return exactMatch[1].trim();
  }
  const knownAgency = text.match(
    /\b((?:RE\/MAX|Pam Golding|Seeff|Rawson|Chas Everitt)[A-Za-z0-9&/' .-]{0,90})\s+[A-Z][A-Za-z.' -]{2,80}\s+Show Contact Number/i,
  )?.[1];
  if (knownAgency) return knownAgency.trim();
  if (!agentName) return null;
  const escapedName = escapeRegExp(agentName);
  const match = text.match(
    new RegExp(`\\b([A-Z][A-Za-z0-9&/' .-]{2,90})\\s+${escapedName}\\s+Show Contact Number`),
  );
  return match?.[1]?.trim() ?? null;
}

function labelledNumber(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const direct = text.match(new RegExp(`${label}\\s*:?\\s*(\\d+(?:[.,]\\d+)?)`, "i"));
    const directParsed = numberFromText(direct?.[1]);
    if (directParsed != null) return directParsed;
    const value = extractTextAfterLabel(text, label);
    const parsed = numberFromText(value);
    if (parsed != null) return parsed;
  }
  return null;
}

function labelledMoney(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const direct = text.match(new RegExp(`${label}\\s*:?\\s*(R\\s?[\\d\\s,.]+)`, "i"));
    const directParsed = moneyFromText(direct?.[1]);
    if (directParsed != null) return directParsed;
    const value = extractTextAfterLabel(text, label);
    const parsed = moneyFromText(value);
    if (parsed != null) return parsed;
  }
  return null;
}

function labelledArea(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const direct = text.match(
      new RegExp(`${label}\\s*:?\\s*([\\d\\s]+(?:[.,]\\d+)?)\\s*(?:m2|m²|sqm|sq\\s*m)`, "i"),
    );
    const directParsed = numberFromText(direct?.[1]);
    if (directParsed != null) return directParsed;
    const value = extractTextAfterLabel(text, label);
    const parsed = areaFromText(value);
    if (parsed != null) return parsed;
  }
  return null;
}

function matchNumber(text: string, re: RegExp): number | null {
  const match = text.match(re);
  return numberFromText(match?.[1]);
}

function matchMoney(text: string, re: RegExp): number | null {
  const match = text.match(re);
  return moneyFromText(match?.[1]);
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

function extractFeatures(html: string): string[] {
  const featureMatches = [...html.matchAll(/<(?:li|span|div)[^>]*(?:class=["'][^"']*(?:feature|amenity)[^"']*["'])?[^>]*>([^<]{2,120})<\/(?:li|span|div)>/gi)]
    .map((match) => decodeHtml(match[1] ?? ""))
    .filter((value) => value.length > 1 && !/property24|javascript|cookie/i.test(value))
    .filter(
      (value) =>
        !/^(buy|rent|sell|commercial|calculators|advice|sign in)$/i.test(value) &&
        !/house for sale|^R\s?\d|^Property for Sale|^\d{5,}$|^See all \d+ images$|^Photos \(\d+\)$/i.test(value),
    );
  const text = stripTags(html);
  const knownFeatureLabels = [
    "Pet Friendly",
    "Pool",
    "Garden",
    "Water Tank",
    "Gas Geyser",
    "Backup Battery / Inverter",
    "Sea views",
    "Wheelchair Accessible",
  ].filter((label) => new RegExp(`\\b${escapeRegExp(label)}\\b`, "i").test(text));
  return unique([...knownFeatureLabels, ...featureMatches]).slice(0, 30);
}

function extractImages(html: string, baseUrl: string): string[] {
  const imageMatches = [...html.matchAll(/<(?:img|meta)[^>]+(?:src|data-src|content)=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => {
      try {
        return new URL(match[1] ?? "", baseUrl).toString();
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value))
    .filter((value) => /\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(value));
  const embeddedMatches = [...html.matchAll(/https?:\\?\/\\?\/[^"'<>\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'<>\s]*)?/gi)]
    .map((match) => match[0]?.replace(/\\\//g, "/"))
    .filter((value): value is string => Boolean(value));
  return unique([...imageMatches, ...embeddedMatches]).slice(0, 20);
}

function cleanPropertyType(value: string | null): string | null {
  if (!value) return null;
  if (/house/i.test(value)) return "House";
  if (/apartment|flat/i.test(value)) return "Apartment";
  if (/vacant|land|plot|stand/i.test(value)) return "Vacant land";
  if (/farm|smallholding/i.test(value)) return "Farm / smallholding";
  return value;
}

function evidence(
  field: string,
  value: unknown,
  sourceText: string | null,
  confidence = 0.86,
): RawListingExtraction["evidence"][number] | null {
  if (value == null || value === "") return null;
  return {
    field,
    value,
    extractionMethod: "portal-parser",
    sourceText,
    confidence,
  };
}

export class Property24Provider implements ListingProvider {
  canHandle(url: URL): boolean {
    return hostCanHandle(url);
  }

  fetch(url: URL, deps?: ListingImportDependencies): Promise<FetchedListingPage> {
    return fetchListingPage(url, deps);
  }

  async extract(page: FetchedListingPage): Promise<RawListingExtraction> {
    const canonicalUrl = canonicaliseListingUrl(new URL(page.finalUrl));
    const metadata = extractMetadata(page.html, canonicalUrl);
    const text = stripTags(page.html);
    const overviewText = propertyOverviewText(text);
    const breadcrumbLocation = extractBreadcrumbLocation(text);
    const listingId = extractProperty24ListingId(new URL(page.finalUrl), page.html);
    const title = metadata.title;
    const firstPriceText = firstListingPriceText(text);
    const askingPrice =
      metadata.askingPrice ??
      matchMoney(text, /(?:price|asking price)\s*:?\s*(R\s?[\d\s,.]+)/i) ??
      moneyFromText(firstPriceText);
    const bedrooms =
      labelledNumber(text, ["Bedrooms", "Beds"]) ??
      metadata.bedrooms ??
      matchNumber(text, /(\d+(?:[.,]\d+)?)\s*bed(?:room)?s?/i);
    const bathrooms =
      labelledNumber(text, ["Bathrooms", "Baths"]) ??
      metadata.bathrooms ??
      matchNumber(text, /(\d+(?:[.,]\d+)?)\s*bath(?:room)?s?/i);
    const garages =
      labelledNumber(text, ["Garages", "Garage"]) ??
      matchNumber(text, /(\d+(?:[.,]\d+)?)\s*garage/i);
    const parkingSpaces =
      labelledNumber(text, ["Parking", "Parking spaces"]) ??
      matchNumber(text, /(\d+(?:[.,]\d+)?)\s*parking/i);
    const erfSizeM2 =
      labelledArea(text, ["Erf size", "Land size", "Plot size", "Stand size"]) ??
      areaFromText(text.match(/(?:erf|land|plot|stand)\s*size\s*:?\s*\d+(?:[.,]\d+)?\s*(?:m2|m²|sqm)/i)?.[0]);
    const floorSizeM2 =
      labelledArea(text, ["Floor size", "Building size"]) ??
      metadata.floorSizeM2 ??
      areaFromText(text.match(/(?:floor|building)\s*size\s*:?\s*\d+(?:[.,]\d+)?\s*(?:m2|m²|sqm)/i)?.[0]);
    const ratesMonthly =
      labelledMoney(text, ["Rates and Taxes", "Rates & Taxes", "Rates"]) ??
      matchMoney(text, /rates(?:\s*(?:and|&)\s*taxes)?\s*:?\s*(R\s?[\d\s,.]+)/i);
    const leviesMonthly =
      labelledMoney(text, ["Levies", "Levy"]) ??
      matchMoney(text, /lev(?:y|ies)\s*:?\s*(R\s?[\d\s,.]+)/i);
    const occupationDate = boundedLabelValue(overviewText, ["Occupation"]);
    const erfNumberMatch = text.match(/\berf\s*(?:number|no\.?)?\s*:?\s*(\d{1,8})\b/i);
    const listingDate = metadata.listingDate ?? boundedLabelValue(overviewText, ["Listing Date"]);
    const description = metadata.description;
    const features = extractFeatures(page.html);
    const images = unique([...metadata.imageUrls, ...extractImages(page.html, canonicalUrl)]);
    const agentName =
      metadata.agentName ??
      extractContactAgentName(text) ??
      boundedLabelValue(text, ["Agent"], ["Show Contact Number", "WhatsApp Agent", "Contact Agent"]);
    const agencyName = metadata.agencyName ?? extractAgencyName(text, agentName);
    const suburb = metadata.suburb ?? breadcrumbLocation.suburb;
    const town = metadata.town ?? breadcrumbLocation.town;
    const province = metadata.province ?? breadcrumbLocation.province;
    const phone = text.match(/(?:\+27|0)\s?\d{2}\s?\d{3}\s?\d{4}/)?.[0] ?? null;
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;

    const evidenceRows = [
      ...metadata.evidence.map((item) => ({
        field: item.field,
        value: item.value,
        extractionMethod: item.method,
        sourceText: item.sourceText,
        confidence: item.method === "json-ld" ? 0.9 : 0.74,
      })),
      evidence("source.listingId", listingId, listingId),
      evidence("property.askingPrice", askingPrice, firstPriceText),
      evidence("property.bedrooms", bedrooms, "bedrooms"),
      evidence("property.bathrooms", bathrooms, "bathrooms"),
      evidence("property.garages", garages, "garages"),
      evidence("property.parkingSpaces", parkingSpaces, "parking"),
      evidence("property.erfSizeM2", erfSizeM2, "erf size"),
      evidence("property.floorSizeM2", floorSizeM2, "floor size"),
      evidence("property.ratesMonthly", ratesMonthly, "rates"),
      evidence("property.leviesMonthly", leviesMonthly, "levies"),
      evidence("property.occupationDate", occupationDate, occupationDate),
      evidence("property.suburb", suburb, breadcrumbLocation.suburb ? "Property for Sale breadcrumb" : suburb),
      evidence("property.town", town, breadcrumbLocation.town ? "Property for Sale breadcrumb" : town),
      evidence("property.province", province, breadcrumbLocation.province ? "Property for Sale breadcrumb" : province),
      evidence("listing.listingDate", listingDate, listingDate),
      evidence("agent.name", agentName, agentName, 0.74),
      evidence("agent.agency", agencyName, agencyName, 0.74),
      evidence("property.erfNumber", erfNumberMatch?.[1] ?? null, erfNumberMatch?.[0] ?? null, 0.7),
    ].filter((item): item is RawListingExtraction["evidence"][number] => Boolean(item));

    return {
      source: {
        portal: "Property24",
        url: page.requestedUrl,
        canonicalUrl,
        listingId,
        fetchedAt: page.fetchedAt,
        contentHash: page.contentHash,
      },
      property: {
        title,
        propertyType: cleanPropertyType(metadata.propertyType ?? title),
        askingPrice,
        currency: "ZAR",
        saleOrRental: /rent|rental|to let/i.test(text) ? "rental" : "sale",
        bedrooms,
        bathrooms,
        garages,
        parkingSpaces,
        erfSizeM2,
        floorSizeM2,
        streetAddress: metadata.streetAddress,
        suburb,
        town,
        province,
        postalCode: metadata.postalCode,
        ratesMonthly,
        leviesMonthly,
        occupationDate,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        erfNumber: erfNumberMatch?.[1] ?? null,
      },
      listing: {
        listingDate,
        description,
        features,
        imageUrls: images,
      },
      agent: {
        name: agentName,
        agency: agencyName,
        phone,
        email,
      },
      evidence: evidenceRows,
      warnings: [],
    };
  }
}

export const property24Provider = new Property24Provider();
