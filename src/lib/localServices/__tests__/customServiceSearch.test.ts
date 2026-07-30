import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleLocalServicesSearchRequest } from "@/routes/api/local-services.search";
import {
  buildCustomServiceCategory,
  customServiceGoogleMapsUrl,
  customServiceResultsHeading,
  isCustomServiceCategoryId,
  MAX_CUSTOM_SERVICE_QUERY_LENGTH,
  readRecentCustomServiceSearches,
  recordRecentCustomServiceSearch,
  sanitizeCustomServiceQuery,
} from "@/lib/localServices/customServiceSearch";
import { assignVendorToParcel, upsertVendorInDirectory } from "@/lib/vendors/vendorRecords";
import type { Vendor, VendorAssignment } from "@/lib/vendors/types";

const ADDRESS = "8 Padrone Crescent, St Francis Bay";
const originalKey = process.env.GOOGLE_PLACES_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = originalKey;
});

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/local-services/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockPlaces() {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        places: [
          {
            id: "guard-1",
            displayName: { text: "Bay Guard Security" },
            formattedAddress: "12 Main Road",
            businessStatus: "OPERATIONAL",
            nationalPhoneNumber: "+27 42 000 0001",
            websiteUri: "https://bayguard.example",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

describe("sanitizeCustomServiceQuery", () => {
  it("rejects blank and whitespace-only input", () => {
    expect(sanitizeCustomServiceQuery("")).toBeNull();
    expect(sanitizeCustomServiceQuery("    ")).toBeNull();
    expect(sanitizeCustomServiceQuery("\n\t")).toBeNull();
    expect(sanitizeCustomServiceQuery(undefined)).toBeNull();
    expect(sanitizeCustomServiceQuery(42)).toBeNull();
    expect(sanitizeCustomServiceQuery("!!!")).toBeNull();
  });

  it("trims, collapses whitespace and strips markup characters", () => {
    expect(sanitizeCustomServiceQuery("  security   company  ")).toBe("security company");
    expect(sanitizeCustomServiceQuery("<script>pool</script> maintenance")).toBe(
      "script pool /script maintenance",
    );
  });

  it("length-limits overlong queries", () => {
    const long = "a".repeat(300);
    const sanitized = sanitizeCustomServiceQuery(long);
    expect(sanitized).not.toBeNull();
    expect(sanitized!.length).toBe(MAX_CUSTOM_SERVICE_QUERY_LENGTH);
  });
});

describe("custom service category", () => {
  it("builds a synthetic category preserving the exact query", () => {
    const category = buildCustomServiceCategory("home staging");
    expect(category).not.toBeNull();
    expect(category!.searchQuery).toBe("home staging");
    expect(category!.label).toBe("Home staging");
    expect(isCustomServiceCategoryId(category!.id)).toBe(true);
    expect(isCustomServiceCategoryId("estate-agents")).toBe(false);
  });

  it("returns null for unusable queries", () => {
    expect(buildCustomServiceCategory("   ")).toBeNull();
  });

  it("shows the exact query in the results heading", () => {
    expect(customServiceResultsHeading("security company")).toBe(
      "Security companies near this property",
    );
    expect(customServiceResultsHeading("home staging")).toBe(
      "Home stagings near this property",
    );
  });

  it("builds a Google Maps fallback anchored to the saved address, not the erf", () => {
    const url = customServiceGoogleMapsUrl("security company", ADDRESS);
    expect(url).toContain(encodeURIComponent("security company near " + ADDRESS));
    expect(url).not.toContain("Erf");
    expect(customServiceGoogleMapsUrl("security company", "   ")).toBeNull();
  });
});

describe("recent custom searches", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores per property without duplicates", () => {
    recordRecentCustomServiceSearch("parcel-a", "security company");
    recordRecentCustomServiceSearch("parcel-a", "Security Company");
    recordRecentCustomServiceSearch("parcel-a", "pool maintenance");
    expect(readRecentCustomServiceSearches("parcel-a")).toEqual([
      "pool maintenance",
      "Security Company",
    ]);
    expect(readRecentCustomServiceSearches("parcel-b")).toEqual([]);
  });

  it("ignores blank queries", () => {
    recordRecentCustomServiceSearch("parcel-a", "   ");
    expect(readRecentCustomServiceSearches("parcel-a")).toEqual([]);
  });
});

describe("server custom service search", () => {
  it("searches the saved Market address using the free-text query", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    const fetchMock = mockPlaces();
    const response = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-1",
        customQuery: "security company",
        confirmedAddress: ADDRESS,
      }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.confirmedAddress).toBe(ADDRESS);
    expect(isCustomServiceCategoryId(payload.categoryId)).toBe(true);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent.textQuery).toContain("security company");
    expect(sent.textQuery).toContain("St Francis Bay");
    expect(sent.textQuery).not.toContain("parcel-1");
  });

  it("rejects blank, whitespace-only and unusable custom queries", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    for (const customQuery of ["   ", "!!!", "\n"]) {
      const response = await handleLocalServicesSearchRequest(
        request({ parcelId: "parcel-1", customQuery, confirmedAddress: ADDRESS, serviceCategory: "custom:x" }),
      );
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("invalid_query");
    }
  });

  it("still requires the confirmed address for custom searches", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    const response = await handleLocalServicesSearchRequest(
      request({ parcelId: "parcel-1", customQuery: "locksmith" }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("address_required");
  });

  it("keeps preset category searches working", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-secret";
    mockPlaces();
    const response = await handleLocalServicesSearchRequest(
      request({
        parcelId: "parcel-1",
        serviceCategory: "estate-agents",
        confirmedAddress: ADDRESS,
      }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.categoryId).toBe("estate-agents");
  });
});

describe("vendor workspace integration for custom results", () => {
  const providerVendorInput = {
    name: "Bay Guard Security",
    role: "other" as const,
    phone: "+27 42 000 0001",
    website: "https://bayguard.example",
    serviceArea: "12 Main Road",
    source: "Google search - Security company",
    notes: "Found via custom search: Security company",
    originPlaceId: "guard-1",
  };

  it("saves a custom-search result once and reuses it across properties", () => {
    let directory: Vendor[] = [];
    let result = upsertVendorInDirectory(directory, providerVendorInput);
    directory = result.directory;
    const vendorId = result.vendor.id;
    result = upsertVendorInDirectory(directory, providerVendorInput);
    directory = result.directory;
    expect(directory).toHaveLength(1);
    expect(result.vendor.id).toBe(vendorId);
    expect(directory[0].source).toBe("Google search - Security company");
    expect(directory[0].notes).toContain("Security company");

    let assignments: VendorAssignment[] = [];
    assignments = assignVendorToParcel(assignments, vendorId, "parcel-a", {
      roleOnProperty: "other",
      scopeOfWork: "Security company",
      quoteNotes: "R2 500 per month",
      propertyNotes: "Erf 1570 only",
    }).assignments;
    assignments = assignVendorToParcel(assignments, vendorId, "parcel-b", {
      roleOnProperty: "other",
      scopeOfWork: "Security company",
    }).assignments;

    expect(assignments).toHaveLength(2);
    const a = assignments.find((entry) => entry.parcelId === "parcel-a")!;
    const b = assignments.find((entry) => entry.parcelId === "parcel-b")!;
    expect(a.quoteNotes).toBe("R2 500 per month");
    expect(a.propertyNotes).toBe("Erf 1570 only");
    expect(b.quoteNotes).toBeNull();
    expect(b.propertyNotes).toBeNull();
    expect(b.scopeOfWork).toBe("Security company");
  });

  it("does not duplicate an assignment for the same property", () => {
    const { directory, vendor } = upsertVendorInDirectory([], providerVendorInput);
    expect(directory).toHaveLength(1);
    let assignments: VendorAssignment[] = [];
    assignments = assignVendorToParcel(assignments, vendor.id, "parcel-a", {
      roleOnProperty: "other",
    }).assignments;
    assignments = assignVendorToParcel(assignments, vendor.id, "parcel-a", {
      roleOnProperty: "other",
      status: "contacted",
    }).assignments;
    expect(assignments).toHaveLength(1);
    expect(assignments[0].status).toBe("contacted");
  });
});
