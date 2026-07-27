import type { PropertyEvidencePack } from "./propertyEvidenceTypes";

const VOLATILE_KEYS = new Set(["builtAt", "signedUrl", "signed_url", "downloadUrl", "download_url"]);

export function evidenceFingerprint(input: unknown): string {
  const stable = stableStringify(stripVolatile(input));
  let hash = 2166136261;
  for (let index = 0; index < stable.length; index += 1) {
    hash ^= stable.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function fingerprintPropertyEvidencePack(pack: Omit<PropertyEvidencePack, "fingerprint">) {
  return evidenceFingerprint({
    schemaVersion: pack.schemaVersion,
    parcelId: pack.parcelId,
    sourceUpdatedAt: pack.sourceUpdatedAt,
    sources: pack.sources,
    claims: pack.claims,
    domains: pack.domains,
    contradictions: pack.contradictions,
    gaps: pack.gaps,
    timeline: pack.timeline.filter((event) => event.id !== "evidence-pack-built"),
    statistics: pack.statistics,
  });
}

function stripVolatile(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripVolatile);
  }
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (VOLATILE_KEYS.has(key)) continue;
    next[key] = stripVolatile(item);
  }
  return next;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}
