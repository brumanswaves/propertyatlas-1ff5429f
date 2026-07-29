/** Shared fixture for exercising the deployed Ask Easy Erf Edge Function handler. */
import { buildAskEasyErfSelectedEvidencePayload } from "../askEasyErf";
import { buildEvidencePackFixture } from "@/lib/evidence/__tests__/propertyEvidenceTestUtils";

export function buildAskEasyErfFixturePayload(question = "What are the biggest risks?") {
  return buildAskEasyErfSelectedEvidencePayload({
    pack: buildEvidencePackFixture({}),
    question,
    now: new Date("2026-07-16T00:00:00Z"),
  });
}

export function buildAskEasyErfFixtureRequest(
  payload = buildAskEasyErfFixturePayload(),
  question = payload.question,
) {
  return new Request("https://proj.supabase.co/functions/v1/ask-easy-erf-openai", {
    method: "POST",
    headers: {
      Authorization: "Bearer internal-secret",
      "Content-Type": "application/json",
      "x-request-id": "fixture-request-id",
    },
    body: JSON.stringify({ parcelId: payload.parcelId, question, evidence: payload }),
  });
}
