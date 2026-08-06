import type { ErfAsset } from "@/lib/workbench/erfFileVault";
import {
  erfAssetExtractedClaims,
  erfAssetHasSearchableExtraction,
  erfAssetIdentityMatchStatus,
} from "@/lib/evidence/extractionMetadata";
import type { ErfExtractedClaim } from "../../../supabase/functions/_shared/erfExtractionContract";
import type { ZoneDefinition } from "./municipalityPlanningTypes";

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function meaningfulContainedMatch(left: string, right: string) {
  return left.length >= 5 && right.length >= 5 && (left.includes(right) || right.includes(left));
}

export function zoningClaimSupportsZone(claimValue: string, zone: ZoneDefinition): boolean {
  const claim = normalize(claimValue);
  const code = normalize(zone.code);
  const name = normalize(zone.name);
  if (!claim) return false;
  if (code && (claim === code || claim.includes(code))) return true;
  return meaningfulContainedMatch(claim, name);
}

export function findSupportingZoningClaim(
  asset: ErfAsset,
  zone: ZoneDefinition,
): ErfExtractedClaim | null {
  return (
    erfAssetExtractedClaims(asset).find(
      (claim) =>
        claim.scope === "subject" &&
        claim.domain === "planning" &&
        claim.key === "zoning" &&
        zoningClaimSupportsZone(claim.value, zone),
    ) ?? null
  );
}

export function isReadableMatchedZoningDocument(asset: ErfAsset): boolean {
  return (
    asset.asset_category === "zoning_document" &&
    erfAssetHasSearchableExtraction(asset) &&
    erfAssetIdentityMatchStatus(asset) === "matched"
  );
}

export function isUsableSubjectZoningDocument(asset: ErfAsset, zone: ZoneDefinition): boolean {
  return isReadableMatchedZoningDocument(asset) && Boolean(findSupportingZoningClaim(asset, zone));
}
