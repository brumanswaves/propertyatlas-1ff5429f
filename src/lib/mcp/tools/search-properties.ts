import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getActiveProvider } from "@/lib/providers/registry";

export default defineTool({
  name: "search_properties",
  title: "Search properties",
  description:
    "Search ErfStoep properties by street, suburb, or erf number. Returns matching parcels with erf, address, town, coordinates, and land size.",
  inputSchema: {
    query: z.string().min(1).describe("Free-text query: street, suburb, or erf number."),
    limit: z.number().int().min(1).max(20).optional().describe("Max results (default 8)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    const provider = getActiveProvider();
    const results = await provider.searchProperties({ query, limit });
    const rows = results.map((p) => ({
      id: p.id,
      erf: p.erf.value,
      address: p.streetAddress.value,
      suburb: p.suburb.value,
      town: p.town.value,
      coordinates: p.coordinates.value,
      landSizeSqm: p.landSizeSqm.value,
      propertyType: p.propertyType.value,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { results: rows, provider: provider.meta.id },
    };
  },
});
