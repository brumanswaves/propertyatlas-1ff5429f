import { defineMcp } from "@lovable.dev/mcp-js";
import searchProperties from "./tools/search-properties";
import getProperty from "./tools/get-property";

export default defineMcp({
  name: "erfstoep-mcp",
  title: "ErfStoep MCP",
  version: "0.1.0",
  instructions:
    "ErfStoep property intelligence for South African erven. Use `search_properties` to find parcels by street, suburb, or erf number, then `get_property` for full details (address, zoning, land size, valuation, sale history).",
  tools: [searchProperties, getProperty],
});
