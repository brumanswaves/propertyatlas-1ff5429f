import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getActiveProvider } from "@/lib/providers/registry";

export default defineTool({
  name: "get_property",
  title: "Get property details",
  description:
    "Fetch full ErfStoep property details for a given property id: address, land size, zoning, municipal valuation, last sale, ownership status.",
  inputSchema: {
    id: z.string().min(1).describe("Property id returned by search_properties."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }) => {
    const provider = getActiveProvider();
    const p = await provider.getProperty(id);
    if (!p) {
      return {
        content: [{ type: "text", text: `No property found for id ${id}` }],
        isError: true,
      };
    }
    const summary = {
      id: p.id,
      erf: p.erf.value,
      address: p.streetAddress.value,
      suburb: p.suburb.value,
      town: p.town.value,
      municipality: p.municipality.value,
      province: p.province.value,
      coordinates: p.coordinates.value,
      landSizeSqm: p.landSizeSqm.value,
      propertyType: p.propertyType.value,
      zoning: p.zoning.value,
      municipalValuation: p.municipalValuation.value,
      lastSaleDate: p.lastSaleDate.value,
      lastSalePrice: p.lastSalePrice.value,
      ownershipStatus: p.ownershipStatus.value,
      amenities: p.amenities.value,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
