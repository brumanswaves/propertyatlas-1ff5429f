import { createHash } from "node:crypto";
import { z } from "zod";
import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";

// This acquisition boundary accepts ONLY the canonical identifier. Neither saved
// fields, user-provided URLs nor a client assertion of independence can enter it.
const ENDPOINTS = [
  "https://csggis.drdlr.gov.za/server/rest/services/CSGSearch/MapServer/2/query",
  "https://dffeportal.environment.gov.za/hosting/rest/services/CSG_Cadaster/CSG_Cadastral_Data/MapServer/2/query",
] as const;
const scalar = z.union([z.string().max(200), z.number().finite()]).nullable().optional();
const fields = z.object({
  ID: scalar, LPI: scalar, PRCL_KEY: scalar, PARCEL_NO: scalar, PORTION: scalar,
  MUNICIPALITY: scalar, PROVINCE: scalar, MAJ_REGION: scalar, MIN_REGION: scalar,
  GEOM_AREA: z.number().finite().positive().optional(),
});
const collection = z.object({
  features: z.array(z.object({ attributes: fields })).max(2),
  exceededTransferLimit: z.boolean().optional(),
});
export interface IndependentEvidenceReceipt {
  kind: "public_csg_query";
  parcelId: string;
  endpoint: string;
  retrievedAt: string;
  responseSha256: string;
  fields: string[];
  documentDependencies: [];
}
interface Acquired { parcel: NormalizedOfficialParcel; receipt: IndependentEvidenceReceipt }
// Not serialized in user_data or accepted from an RPC/client. The WeakMap also
// rejects structurally identical/forged handles and protects against mutation.
export interface IndependentEvidenceHandle { readonly kind: "server-acquired-evidence" }
const acquired = new WeakMap<IndependentEvidenceHandle, Acquired>();

export function readIndependentEvidence(handle: IndependentEvidenceHandle | undefined, parcelId: string) {
  const value = handle && acquired.get(handle);
  return value?.receipt.parcelId === parcelId ? structuredClone(value) : null;
}

async function boundedResponse(response: Response) {
  if (!response.body) throw new Error("No public evidence body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 64_000) throw new Error("Public evidence exceeds the bounded response.");
      result += decoder.decode(chunk.value, { stream: true });
    }
    return result + decoder.decode();
  } finally { await reader.cancel(); }
}

export async function acquireIndependentEvidence(parcelId: string, fetchImpl: typeof fetch = fetch):
Promise<IndependentEvidenceHandle | undefined> {
  const match = /^csg:lpi:([a-z]\d{20})$/.exec(parcelId);
  if (!match) return undefined;
  const lpi = match[1].toUpperCase();
  for (const endpoint of ENDPOINTS) {
    try {
      const query = new URLSearchParams({ f: "json", where: `ID='${lpi}'`,
        // Public replicas expose different optional columns. Parse only the
        // fixed allowlist above; never forward the remaining response attributes.
        outFields: "*", returnGeometry: "false", resultRecordCount: "2" });
      const response = await fetchImpl(`${endpoint}?${query}`, {
        redirect: "error", signal: AbortSignal.timeout(8_000), headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      const raw = await boundedResponse(response);
      const parsed = collection.safeParse(JSON.parse(raw));
      if (!parsed.success || parsed.data.exceededTransferLimit || parsed.data.features.length !== 1) continue;
      const attributes = parsed.data.features[0].attributes;
      if (String(attributes.ID ?? "").trim().toUpperCase() !== lpi
        || (attributes.LPI != null && String(attributes.LPI).trim().toUpperCase() !== lpi)) continue;
      const text = (value: unknown) => value == null ? null : String(value).trim() || null;
      const parcel: NormalizedOfficialParcel = { id: parcelId, source: "csg",
        sourceLabel: "Independently retrieved CSG public parcel record", lpi,
        erfNumber: text(attributes.PARCEL_NO), portion: text(attributes.PORTION),
        parcelKey: text(attributes.PRCL_KEY), municipality: text(attributes.MUNICIPALITY),
        province: text(attributes.PROVINCE), town: text(attributes.MAJ_REGION),
        suburbOrArea: text(attributes.MIN_REGION), knownFields: [], missingFields: [],
        rawProperties: attributes.GEOM_AREA == null ? {} : { GEOM_AREA: attributes.GEOM_AREA },
      };
      const handle: IndependentEvidenceHandle = Object.freeze({ kind: "server-acquired-evidence" });
      acquired.set(handle, { parcel, receipt: { kind: "public_csg_query", parcelId, endpoint,
        retrievedAt: new Date().toISOString(), responseSha256: createHash("sha256").update(raw).digest("hex"),
        fields: Object.keys(attributes), documentDependencies: [] } });
      return handle;
    } catch { /* An unavailable public source is not permission to trust a saved copy. */ }
  }
  return undefined;
}
