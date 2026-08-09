import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("working-address suggestion path", () => {
  it("uses the server route and exposes failures in the guided address UI", () => {
    const intelligence = read("src/features/marketEvidence/addressIntelligence.ts");
    const autocomplete = read("src/lib/search/addressAutocomplete.ts");
    const step = read("src/components/property/investigation/AddAddressStep.tsx");
    expect(intelligence).toContain('/api/address/suggestions');
    expect(autocomplete).toContain('/api/address/suggestions');
    expect(intelligence).not.toContain("VITE_GOOGLE_MAPS_API_KEY");
    expect(autocomplete).not.toContain("VITE_GOOGLE_MAPS_API_KEY");
    expect(step).toContain("typedSuggestionsError");
    expect(step).toContain('role="status"');
  });
});
