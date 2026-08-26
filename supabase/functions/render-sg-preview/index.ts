// Deterministic SG TIFF preview repair. This function never calls an AI provider.
// It only creates a bounded PNG preview for already-readable, identity-eligible SG evidence.
// @ts-expect-error npm: specifiers are resolved by Deno at deploy time.
import UTIF from "npm:utif2@4.1.0";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response> | Response): unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 160_000_000;
const MAX_PREVIEW_EDGE = 1_200;
const PREVIEW_MIME = "image/png";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function log(stage: string, requestId: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: "render-sg-preview", stage, requestId, ...extra }));
}

const supabaseUrl = () => (Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/+$/, "");
const serviceKey = () => (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

async function verifyUserToken(token: string): Promise<string | null> {
  const url = supabaseUrl();
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY")?.trim() ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    "";
  if (!url || !anonKey) return null;
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
    return body && typeof body.id === "string" && body.id ? body.id : null;
  } catch {
    return null;
  }
}

interface AssetRow {
  id: string;
  user_id: string;
  parcel_id: string;
  asset_category: string;
  storage_bucket: string;
  storage_path: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  metadata: Record<string, unknown> | null;
}

async function loadAsset(assetId: string): Promise<AssetRow | null> {
  const key = serviceKey();
  if (!key) return null;
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/erf_assets?id=eq.${encodeURIComponent(assetId)}&select=*&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!response.ok) return null;
  const rows = (await response.json().catch(() => null)) as AssetRow[] | null;
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function eligibleForPreview(asset: AssetRow) {
  const metadata = asset.metadata ?? {};
  const claims = Array.isArray(metadata.extractedClaims) ? metadata.extractedClaims : [];
  if (claims.length === 0) return false;
  const identity = typeof metadata.identityMatchStatus === "string" ? metadata.identityMatchStatus : "";
  if (identity === "mismatch") return false;
  const userBound =
    metadata.identityBinding === "user_confirmed" &&
    metadata.identityUserConfirmedParcelId === asset.parcel_id;
  return identity === "matched" || identity === "parent_lineage_match" || userBound;
}

async function downloadAsset(asset: AssetRow) {
  const key = serviceKey();
  if (!key) return null;
  const path = asset.storage_path.replace(/^\/+/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${supabaseUrl()}/storage/v1/object/${encodeURIComponent(asset.storage_bucket || "erf-files")}/${encoded}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!response.ok) return null;
  return new Uint8Array(await response.arrayBuffer());
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function deflate(bytes: Uint8Array) {
  const stream = new Blob([bytes as unknown as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function encodeInkPng(
  ink: Float32Array,
  width: number,
  height: number,
  cellArea: number,
  whiteIsZero: boolean,
) {
  const raw = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0;
    const rowStart = y * width;
    const rawStart = y * (width + 1) + 1;
    for (let x = 0; x < width; x += 1) {
      const coverage = Math.min(1, (ink[rowStart + x] / cellArea) * 1.6);
      const value = Math.round(255 * (1 - coverage));
      raw[rawStart + x] = whiteIsZero ? value : 255 - value;
    }
  }
  const idat = await deflate(raw);
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 0;
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks = [signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", new Uint8Array())];
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    png.set(chunk, offset);
    offset += chunk.length;
  }
  return png;
}

type G4Ifd = {
  t256?: number[];
  t257?: number[];
  t258?: number[];
  t259?: number[];
  t262?: number[];
  t266?: number[];
  t273?: number[];
  t278?: number[];
  t279?: number[];
};

function tag(ifd: G4Ifd, key: keyof G4Ifd) {
  const value = ifd[key];
  return Array.isArray(value) && value.length ? Number(value[0]) : null;
}

function previewDimensions(width: number, height: number) {
  const scale = Math.min(1, MAX_PREVIEW_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function decodeG4Strip(input: {
  data: Uint8Array;
  byteOffset: number;
  byteLength: number;
  width: number;
  stripRows: number;
  yBase: number;
  lsbFirst: boolean;
  dstWidth: number;
  dstHeight: number;
  sourceHeight: number;
  ink: Float32Array;
}) {
  const dmap = UTIF.decode._dmap as Record<string, number>;
  const lens = UTIF.decode._lens as Record<number, Record<string, number>>;
  let ref: number[] = [input.width, input.width];
  let cur: number[] = [];
  let bitOffset = input.byteOffset << 3;
  const endBit = (input.byteOffset + input.byteLength) << 3;
  let a0 = -1;
  let color = 0;
  let word = "";
  let mode = "";
  let toRead = 0;
  let runLength = 0;
  let y = 0;

  const addRun = (from: number, to: number, clr: number) => {
    if (clr !== 1 || to <= from) return;
    const absY = y + input.yBase;
    if (absY < 0 || absY >= input.sourceHeight) return;
    const dstY = Math.min(
      input.dstHeight - 1,
      Math.floor((absY * input.dstHeight) / input.sourceHeight),
    );
    const rowBase = dstY * input.dstWidth;
    const start = Math.max(0, from);
    const stop = Math.min(input.width, to);
    if (stop <= start) return;
    const firstBin = Math.max(0, Math.floor((start * input.dstWidth) / input.width));
    const lastBin = Math.min(
      input.dstWidth - 1,
      Math.floor(((stop - 1) * input.dstWidth) / input.width),
    );
    for (let bin = firstBin; bin <= lastBin; bin += 1) {
      const binStart = Math.floor((bin * input.width) / input.dstWidth);
      const binEnd = Math.ceil(((bin + 1) * input.width) / input.dstWidth);
      const overlap = Math.max(0, Math.min(stop, binEnd) - Math.max(start, binStart));
      if (overlap) input.ink[rowBase + bin] += overlap;
    }
  };

  while (bitOffset < endBit && y < input.stripRows) {
    let b1 = input.width;
    let b2 = input.width;
    for (let i = 0; i < ref.length; i += 1) {
      if (ref[i] > a0 && (i & 1) === color) {
        b1 = ref[i];
        b2 = i + 1 < ref.length ? ref[i + 1] : input.width;
        break;
      }
    }
    const byte = input.data[bitOffset >>> 3] ?? 0;
    const bit = input.lsbFirst
      ? (byte >>> (bitOffset & 7)) & 1
      : (byte >>> (7 - (bitOffset & 7))) & 1;
    bitOffset += 1;
    word += bit;

    if (mode === "H") {
      const clr = toRead === 2 ? color : 1 - color;
      const value = lens[clr][word];
      if (value != null) {
        word = "";
        runLength += value;
        if (value < 64) {
          const start = a0 < 0 ? 0 : a0;
          addRun(start, start + runLength, clr);
          cur.push(start + runLength);
          a0 = start + runLength;
          runLength = 0;
          toRead -= 1;
          if (toRead === 0) mode = "";
        }
      }
    } else if (word === "0001") {
      word = "";
      addRun(a0 < 0 ? 0 : a0, b2, color);
      a0 = b2;
    } else if (word === "001") {
      word = "";
      mode = "H";
      toRead = 2;
      runLength = 0;
    } else if (dmap[word] != null) {
      const a1 = b1 + dmap[word];
      word = "";
      addRun(a0 < 0 ? 0 : a0, a1, color);
      cur.push(a1);
      a0 = a1;
      color = 1 - color;
    }

    if (a0 >= input.width && mode === "") {
      cur.push(input.width, input.width);
      ref = cur;
      cur = [];
      y += 1;
      a0 = -1;
      color = 0;
      word = "";
    }
    if (word.length > 24) throw new Error("Unsupported Group 4 stream.");
  }
}

async function renderBilevelG4Preview(bytes: Uint8Array) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const ifds = UTIF.decode(buffer) as G4Ifd[];
  const ifd = Array.isArray(ifds) ? ifds[0] : null;
  if (!ifd) throw new Error("TIFF has no readable page.");
  const width = tag(ifd, "t256") ?? 0;
  const height = tag(ifd, "t257") ?? 0;
  const bits = tag(ifd, "t258") ?? 0;
  const compression = tag(ifd, "t259") ?? 0;
  if (!width || !height || width * height > MAX_SOURCE_PIXELS) {
    throw new Error("TIFF dimensions are outside the preview budget.");
  }
  if (bits !== 1 || compression !== 4) {
    throw new Error("Only CCITT Group 4 bilevel SG TIFFs use the deterministic preview path.");
  }
  const offsets = ifd.t273 ?? [];
  const counts = ifd.t279 ?? [];
  if (!offsets.length || counts.length !== offsets.length) throw new Error("TIFF strip data is incomplete.");
  const rowsPerStrip = tag(ifd, "t278") ?? height;
  const lsbFirst = (tag(ifd, "t266") ?? 1) === 2;
  const whiteIsZero = (tag(ifd, "t262") ?? 0) === 0;
  const plan = previewDimensions(width, height);
  const ink = new Float32Array(plan.width * plan.height);
  const stripCount = Math.min(offsets.length, Math.ceil(height / rowsPerStrip));
  for (let index = 0; index < stripCount; index += 1) {
    const yBase = index * rowsPerStrip;
    decodeG4Strip({
      data: bytes,
      byteOffset: Number(offsets[index]),
      byteLength: Number(counts[index]),
      width,
      stripRows: Math.min(rowsPerStrip, height - yBase),
      yBase,
      lsbFirst,
      dstWidth: plan.width,
      dstHeight: plan.height,
      sourceHeight: height,
      ink,
    });
  }
  const cellArea = (width / plan.width) * (height / plan.height);
  const png = await encodeInkPng(ink, plan.width, plan.height, cellArea, whiteIsZero);
  return { png, sourceWidth: width, sourceHeight: height, previewWidth: plan.width, previewHeight: plan.height };
}

function previewPath(asset: AssetRow) {
  const parent = asset.storage_path.includes("/")
    ? asset.storage_path.slice(0, asset.storage_path.lastIndexOf("/"))
    : asset.storage_path;
  return `${parent}/derived/sg-overview.png`;
}

async function uploadPreview(asset: AssetRow, png: Uint8Array) {
  const key = serviceKey();
  if (!key) return null;
  const path = previewPath(asset);
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${supabaseUrl()}/storage/v1/object/${encodeURIComponent(asset.storage_bucket || "erf-files")}/${encoded}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": PREVIEW_MIME,
        "x-upsert": "true",
      },
      body: png as unknown as BodyInit,
    },
  );
  return response.ok ? path : null;
}

async function savePreviewMetadata(asset: AssetRow, path: string) {
  const key = serviceKey();
  if (!key) return false;
  const metadata = {
    ...(asset.metadata ?? {}),
    sgPreviewStoragePath: path,
    sgPreviewMimeType: PREVIEW_MIME,
    sgPreviewGeneratedAt: new Date().toISOString(),
    sgPreviewProvider: "easy_erf_deterministic_tiff",
  };
  const response = await fetch(`${supabaseUrl()}/rest/v1/erf_assets?id=eq.${encodeURIComponent(asset.id)}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ metadata, updated_at: new Date().toISOString() }),
  });
  return response.ok;
}

Deno.serve(async (request: Request) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, code: "INVALID_REQUEST" }, 405);

  const presented = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!presented) return json({ success: false, code: "AUTH_REQUIRED" }, 401);
  const userId = await verifyUserToken(presented);
  if (!userId) return json({ success: false, code: "AUTH_REQUIRED" }, 401);

  const body = (await request.json().catch(() => null)) as { assetId?: unknown; expectedParcelId?: unknown } | null;
  const assetId = typeof body?.assetId === "string" ? body.assetId.trim() : "";
  const expectedParcelId = typeof body?.expectedParcelId === "string" ? body.expectedParcelId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(assetId) || !expectedParcelId) {
    return json({ success: false, code: "INVALID_REQUEST" }, 400);
  }

  const asset = await loadAsset(assetId);
  if (!asset) return json({ success: false, code: "ASSET_NOT_FOUND" }, 404);
  if (asset.user_id !== userId) return json({ success: false, code: "FORBIDDEN" }, 403);
  if (asset.parcel_id !== expectedParcelId) return json({ success: false, code: "PARCEL_MISMATCH" }, 409);
  if (asset.asset_category !== "sg_diagram") return json({ success: false, code: "NOT_SG_DIAGRAM" }, 400);
  const mime = (asset.mime_type || "").split(";", 1)[0].trim().toLowerCase();
  if (mime !== "image/tiff" && mime !== "image/tif") {
    return json({ success: false, code: "PREVIEW_UNSUPPORTED" }, 200);
  }
  if (!eligibleForPreview(asset)) return json({ success: false, code: "EVIDENCE_NOT_ELIGIBLE" }, 409);

  const existingPath = asset.metadata?.sgPreviewStoragePath;
  if (typeof existingPath === "string" && existingPath.trim()) {
    return json({ success: true, previewAvailable: true, reused: true });
  }
  if (asset.size_bytes <= 0 || asset.size_bytes > MAX_SOURCE_BYTES) {
    return json({ success: false, code: "PREVIEW_SOURCE_TOO_LARGE" }, 200);
  }

  log("preview_start", requestId, { assetId: asset.id, bytes: asset.size_bytes });
  const bytes = await downloadAsset(asset);
  if (!bytes?.byteLength) return json({ success: false, code: "DOWNLOAD_FAILED" }, 200);

  try {
    const rendered = await renderBilevelG4Preview(bytes);
    const path = await uploadPreview(asset, rendered.png);
    if (!path) return json({ success: false, code: "PREVIEW_UPLOAD_FAILED" }, 200);
    const saved = await savePreviewMetadata(asset, path);
    if (!saved) return json({ success: false, code: "PREVIEW_METADATA_FAILED" }, 200);
    log("preview_stored", requestId, {
      assetId: asset.id,
      sourceWidth: rendered.sourceWidth,
      sourceHeight: rendered.sourceHeight,
      previewWidth: rendered.previewWidth,
      previewHeight: rendered.previewHeight,
      bytes: rendered.png.byteLength,
    });
    return json({
      success: true,
      previewAvailable: true,
      reused: false,
      previewWidth: rendered.previewWidth,
      previewHeight: rendered.previewHeight,
    });
  } catch (error) {
    log("preview_unavailable", requestId, {
      assetId: asset.id,
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
    return json({ success: false, code: "PREVIEW_UNSUPPORTED" }, 200);
  }
});
