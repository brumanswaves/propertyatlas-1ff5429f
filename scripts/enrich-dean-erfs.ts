import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { PUBLIC_LAYER_CONFIG, convertEsriFeatureSetToGeoJSON } from "../src/lib/providers/publicDataClient.ts";
import { centroidForGeometry, indexOfficialFeature } from "../src/lib/search/officialParcelIndex.ts";

type Row = Record<string, string>;
type ParsedErf = { erf: string; portion?: string; sourceText: string };
type MatchStatus = "Matched" | "Ambiguous" | "Not Found";

interface EnrichedRow extends Row {
  "CSG / GIS Match": MatchStatus;
  Erf: string;
  Portion: string;
  Latitude: string;
  Longitude: string;
  "Exact Google Maps Pin": string;
  "Parcel Source": string;
  LPI: string;
  "Parcel Key": string;
  "Match Notes": string;
}

const ST_FRANCIS_BBOX = [24.72, -34.24, 24.94, -34.1] as const;
const CSG_LAYER = "csg-parcels" as const;
const OUTPUT_COLUMNS = [
  "CSG / GIS Match",
  "Erf",
  "Portion",
  "Latitude",
  "Longitude",
  "Exact Google Maps Pin",
  "Parcel Source",
  "LPI",
  "Parcel Key",
  "Match Notes",
] as const;

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/enrich-dean-erfs.ts --input dean.xlsx --output dean-enriched.xlsx
  node --experimental-strip-types scripts/enrich-dean-erfs.ts --input dean.csv --output dean-enriched.csv

Options:
  --input, -i   Input .csv or .xlsx
  --output, -o  Output .csv or .xlsx
`);
}

function arg(name: string, short: string): string | undefined {
  const longIndex = process.argv.indexOf(name);
  if (longIndex >= 0) return process.argv[longIndex + 1];
  const shortIndex = process.argv.indexOf(short);
  if (shortIndex >= 0) return process.argv[shortIndex + 1];
  return undefined;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let current = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted && char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      record.push(current);
      current = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      record.push(current);
      if (record.some((cell) => cell.trim())) rows.push(record);
      current = "";
      record = [];
    } else {
      current += char;
    }
  }
  record.push(current);
  if (record.some((cell) => cell.trim())) rows.push(record);
  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function toCsv(rows: Row[]) {
  const headers = collectHeaders(rows);
  const escape = (value: string) => {
    if (!/[",\r\n]/.test(value)) return value;
    return `"${value.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? "")).join(",")),
  ].join("\n");
}

function collectHeaders(rows: Row[]) {
  const seen = new Set<string>();
  const headers: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  return headers;
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findZipEntries(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Invalid XLSX: missing ZIP directory");
  const count = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  let offset = centralOffset;
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, method === 8 ? inflateRawSync(compressed) : compressed);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function xmlDecode(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function readXlsx(path: string): Row[] {
  const entries = findZipEntries(readFileSync(path));
  const sharedXml = entries.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => {
    return [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => xmlDecode(part[1])).join("");
  });
  const sheetPath = [...entries.keys()].find((key) => /^xl\/worksheets\/sheet\d+\.xml$/.test(key));
  if (!sheetPath) throw new Error("Invalid XLSX: no worksheet found");
  const sheet = entries.get(sheetPath)?.toString("utf8") ?? "";
  const records = [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    return [...rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)].map((cellMatch) => {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
      return attrs.includes('t="s"') ? (shared[Number(value)] ?? "") : xmlDecode(value);
    });
  });
  const headers = records.shift()?.map((header) => header.trim()) ?? [];
  return records.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function zipEntry(name: string, data: Buffer, offset: number) {
  const nameBuffer = Buffer.from(name);
  const compressed = deflateRawSync(data);
  const crc = crc32(data);
  const local = Buffer.alloc(30 + nameBuffer.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuffer.length, 26);
  nameBuffer.copy(local, 30);
  const central = Buffer.alloc(46 + nameBuffer.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuffer.length, 28);
  central.writeUInt32LE(offset, 42);
  nameBuffer.copy(central, 46);
  return { local: Buffer.concat([local, compressed]), central };
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index: number) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function writeXlsx(path: string, rows: Row[]) {
  const headers = collectHeaders(rows);
  const rowXml = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))]
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, cellIndex) => {
          const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const files: Record<string, string> = {
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels":
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Enriched Dean Erfs" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`,
  };
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const entry = zipEntry(name, Buffer.from(content), offset);
    locals.push(entry.local);
    centrals.push(entry.central);
    offset += entry.local.length;
  }
  const centralOffset = offset;
  const central = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(centrals.length, 8);
  eocd.writeUInt16LE(centrals.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  writeFileSync(path, Buffer.concat([...locals, central, eocd]));
}

function readRows(path: string) {
  const ext = extname(path).toLowerCase();
  if (ext === ".csv") return parseCsv(readFileSync(path, "utf8"));
  if (ext === ".xlsx") return readXlsx(path);
  throw new Error("Input must be .csv or .xlsx");
}

function writeRows(path: string, rows: Row[]) {
  const ext = extname(path).toLowerCase();
  if (ext === ".csv") writeFileSync(path, toCsv(rows), "utf8");
  else if (ext === ".xlsx") writeXlsx(path, rows);
  else throw new Error("Output must be .csv or .xlsx");
}

function erfTextFromRow(row: Row) {
  const preferred = Object.entries(row).find(([key]) => {
    const normalized = normalizeHeader(key);
    return normalized === "erf" || normalized === "erf group" || normalized === "group";
  });
  return preferred?.[1] ?? Object.values(row).find((value) => /\d/.test(value)) ?? "";
}

function parseErfs(value: string): ParsedErf[] {
  const text = value.replace(/[–—]/g, "-");
  const explicitPortion = text.match(/\bportion\s+(\d+)\s+erf\s+(\d+)\b/i);
  if (explicitPortion) {
    return [{ erf: explicitPortion[2], portion: explicitPortion[1], sourceText: value }];
  }
  const ranges = [...text.matchAll(/\b(\d{1,5})\s*-\s*(\d{1,5})\b/g)];
  const found = new Map<string, ParsedErf>();
  for (const range of ranges) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    const step = start <= end ? 1 : -1;
    for (let current = start; current !== end + step; current += step) {
      found.set(String(current), { erf: String(current), sourceText: value });
    }
  }
  for (const match of text.matchAll(/\b\d{1,5}\b/g)) {
    found.set(match[0], { erf: match[0], sourceText: value });
  }
  return [...found.values()];
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function fetchArcGis(url: string) {
  const res = await fetch(url, { headers: { Accept: "application/geo+json,application/json" } });
  if (!res.ok) throw new Error(`ArcGIS HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
}

async function queryCsgFeatures(erfs: string[]): Promise<Feature[]> {
  const endpoint = PUBLIC_LAYER_CONFIG[CSG_LAYER].endpoints[0];
  const features: Feature[] = [];
  for (const erfChunk of chunk([...new Set(erfs)], 75)) {
    const where = `PARCEL_NO IN (${erfChunk.map((erf) => `'${erf.replace(/'/g, "''")}'`).join(",")})`;
    const params = new URLSearchParams({
      where,
      geometry: ST_FRANCIS_BBOX.join(","),
      geometryType: "esriGeometryEnvelope",
      spatialRel: "esriSpatialRelIntersects",
      inSR: "4326",
      outSR: "4326",
      returnGeometry: "true",
      outFields: "*",
      f: "geojson",
      resultRecordCount: "2000",
    });
    const url = `${endpoint}?${params.toString()}`;
    const json = await fetchArcGis(url);
    const fc =
      (json as FeatureCollection)?.type === "FeatureCollection"
        ? (json as FeatureCollection)
        : convertEsriFeatureSetToGeoJSON(json);
    features.push(...fc.features);
  }
  return features;
}

function value(properties: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const direct = properties[key];
    if (direct !== null && direct !== undefined && String(direct).trim()) return String(direct).trim();
  }
  const lowerKeys = new Set(keys.map((key) => key.toLowerCase()));
  for (const [key, direct] of Object.entries(properties)) {
    if (lowerKeys.has(key.toLowerCase()) && direct !== null && direct !== undefined && String(direct).trim()) {
      return String(direct).trim();
    }
  }
  return "";
}

function coordinatesFor(feature: Feature) {
  const properties = (feature.properties ?? {}) as Record<string, unknown>;
  const tagLng = Number(value(properties, ["TAG_X", "LONGITUDE", "lng"]));
  const tagLat = Number(value(properties, ["TAG_Y", "LATITUDE", "lat"]));
  if (Number.isFinite(tagLng) && Number.isFinite(tagLat)) return { lng: tagLng, lat: tagLat, source: "TAG_X/TAG_Y" };
  const centroid = centroidForGeometry(feature.geometry as Geometry | null);
  return centroid ? { ...centroid, source: "geometry centroid" } : null;
}

function enrich(parsed: ParsedErf, original: Row, features: Feature[]): EnrichedRow {
  const candidates = features.filter((feature) => value((feature.properties ?? {}) as Record<string, unknown>, ["PARCEL_NO", "ERF", "ERF_NO"]) === parsed.erf);
  const narrowed = parsed.portion
    ? candidates.filter((feature) => value((feature.properties ?? {}) as Record<string, unknown>, ["PORTION", "PORTION_NO", "PTN"]) === parsed.portion)
    : candidates;
  const portionZero = candidates.filter((feature) => value((feature.properties ?? {}) as Record<string, unknown>, ["PORTION", "PORTION_NO", "PTN"]) === "0");
  const usable = narrowed.length ? narrowed : !parsed.portion && portionZero.length === 1 ? portionZero : [];
  const status: MatchStatus = usable.length === 1 ? "Matched" : candidates.length > 0 ? "Ambiguous" : "Not Found";
  const match = usable.length === 1 ? usable[0] : undefined;
  const properties = (match?.properties ?? {}) as Record<string, unknown>;
  const coords = match ? coordinatesFor(match) : null;
  const indexed = match ? indexOfficialFeature(CSG_LAYER, match) : null;
  const note =
    status === "Matched"
      ? `Matched by PARCEL_NO${parsed.portion ? " and portion" : portionZero.length === 1 ? "; input had no portion, unique portion 0 used" : ""}; coordinate source: ${coords?.source ?? "none"}`
      : status === "Ambiguous"
        ? `${candidates.length} parcels matched erf ${parsed.erf}; ask Dean to confirm portion.`
        : `No official SG parcel found in St Francis/Cape St Francis bbox for erf ${parsed.erf}.`;
  return {
    ...original,
    "CSG / GIS Match": status,
    Erf: parsed.erf,
    Portion: value(properties, ["PORTION", "PORTION_NO", "PTN"]) || parsed.portion || "",
    Latitude: coords ? String(coords.lat) : "",
    Longitude: coords ? String(coords.lng) : "",
    "Exact Google Maps Pin": coords ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}` : "",
    "Parcel Source": PUBLIC_LAYER_CONFIG[CSG_LAYER].sourceLabel,
    LPI: indexed?.lpi ?? value(properties, ["ID", "LPI"]) ?? "",
    "Parcel Key": indexed?.parcelKey ?? value(properties, ["PRCL_KEY", "PARCEL_KEY"]) ?? "",
    "Match Notes": note,
  };
}

async function main() {
  const input = arg("--input", "-i");
  const output = arg("--output", "-o");
  if (!input || !output) {
    usage();
    process.exitCode = 1;
    return;
  }
  const inputPath = resolve(input);
  const outputPath = resolve(output);
  if (!existsSync(inputPath)) throw new Error(`Input file not found: ${inputPath}`);
  const rows = readRows(inputPath);
  const parsed = rows.flatMap((row) => parseErfs(erfTextFromRow(row)).map((erf) => ({ row, erf })));
  const features = await queryCsgFeatures(parsed.map((item) => item.erf.erf));
  const enriched = parsed.map(({ row, erf }) => enrich(erf, row, features));
  const ordered = enriched.map((row) => {
    const baseHeaders = Object.keys(row).filter((key) => !(OUTPUT_COLUMNS as readonly string[]).includes(key));
    return Object.fromEntries([...baseHeaders, ...OUTPUT_COLUMNS].map((key) => [key, row[key] ?? ""])) as Row;
  });
  writeRows(outputPath, ordered);
  const counts = enriched.reduce<Record<MatchStatus, number>>(
    (acc, row) => {
      acc[row["CSG / GIS Match"]] += 1;
      return acc;
    },
    { Matched: 0, Ambiguous: 0, "Not Found": 0 },
  );
  console.log(`Rows read: ${rows.length}`);
  console.log(`Individual erfs parsed: ${parsed.length}`);
  console.log(`Matched: ${counts.Matched}`);
  console.log(`Ambiguous: ${counts.Ambiguous}`);
  console.log(`Not Found: ${counts["Not Found"]}`);
  console.log(`Output written: ${outputPath}`);
  console.log("Sample output rows:");
  for (const row of enriched.slice(0, 5)) {
    console.log(JSON.stringify({
      "CSG / GIS Match": row["CSG / GIS Match"],
      Erf: row.Erf,
      Portion: row.Portion,
      Latitude: row.Latitude,
      Longitude: row.Longitude,
      "Exact Google Maps Pin": row["Exact Google Maps Pin"],
      "Match Notes": row["Match Notes"],
    }));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
