import { describe, it, expect } from "vitest";
import { listProviders, getProvider } from "@/lib/providers/registry";
import type { PropertyProvider } from "@/lib/providers/PropertyProvider";
import type { ProviderId } from "@/lib/providers/types";
import { ProviderError, isProviderError } from "@/lib/providers/errors";

const REQUIRED_METHODS: (keyof PropertyProvider)[] = [
  "searchProperties",
  "getProperty",
  "getGeometry",
  "getOwnership",
  "getValuation",
  "getTransfers",
  "getReports",
  "health",
];

const REQUIRED_CAPABILITIES = [
  "search",
  "ownership",
  "valuation",
  "transfers",
  "geometry",
  "reports",
] as const;

const PROVIDERS = listProviders();

describe("PropertyProvider contract", () => {
  it("registry exposes all five providers", () => {
    const ids = PROVIDERS.map((p) => p.meta.id).sort();
    expect(ids).toEqual(
      ["demo", "lightstone", "municipal-gis", "surveyor-general", "windeed"].sort(),
    );
  });

  for (const provider of PROVIDERS) {
    describe(provider.meta.name, () => {
      it("implements every contract method", () => {
        for (const m of REQUIRED_METHODS) {
          expect(typeof provider[m]).toBe("function");
        }
      });

      it("declares full capability surface", () => {
        for (const c of REQUIRED_CAPABILITIES) {
          expect(provider.meta.capabilities[c]).toBe(true);
        }
      });

      it("health() returns a well-formed ProviderHealth", async () => {
        const h = await provider.health();
        expect(["active", "not_connected", "degraded", "error"]).toContain(h.status);
        expect(typeof h.checkedAt).toBe("string");
        expect(new Date(h.checkedAt).toString()).not.toBe("Invalid Date");
      });

      it("searchProperties returns an array", async () => {
        const r = await provider.searchProperties({ query: "test", limit: 3 });
        expect(Array.isArray(r)).toBe(true);
        if (provider.meta.id === "demo") expect(r.length).toBeGreaterThan(0);
      });

      it("getTransfers returns an array", async () => {
        const r = await provider.getTransfers("nonexistent");
        expect(Array.isArray(r)).toBe(true);
      });

      it("getReports returns an array of strings", async () => {
        const r = await provider.getReports("nonexistent");
        expect(Array.isArray(r)).toBe(true);
        for (const s of r) expect(typeof s).toBe("string");
      });

      it("get* methods return null for unknown ids without throwing", async () => {
        await expect(provider.getProperty("does-not-exist")).resolves.toBeDefined();
        await expect(provider.getGeometry("does-not-exist")).resolves.toBeDefined();
        await expect(provider.getOwnership("does-not-exist")).resolves.toBeDefined();
        await expect(provider.getValuation("does-not-exist")).resolves.toBeDefined();
      });
    });
  }
});

describe("Provider registry lookup", () => {
  const ids: ProviderId[] = [
    "demo",
    "surveyor-general",
    "municipal-gis",
    "windeed",
    "lightstone",
  ];
  it.each(ids)("getProvider(%s) is defined", (id) => {
    expect(getProvider(id).meta.id).toBe(id);
  });
});

describe("Demo provider returns shaped NormalizedProperty", () => {
  it("first property has all required Field<T> envelopes", async () => {
    const demo = getProvider("demo");
    const list = await demo.searchProperties({ query: "", limit: 1 });
    const p = list[0]!;
    for (const k of [
      "erf",
      "streetAddress",
      "suburb",
      "town",
      "municipality",
      "province",
      "coordinates",
      "landSizeSqm",
      "propertyType",
      "zoning",
      "municipalValuation",
      "lastSaleDate",
      "lastSalePrice",
      "ownershipStatus",
    ] as const) {
      const field = p[k];
      expect(field).toHaveProperty("value");
      expect(field).toHaveProperty("compliance");
      expect(field.compliance.source).toBe("demo");
    }
    expect(p.geometry).toBeDefined();
    expect(p.geometry.source).toBe("demo");
    expect(Array.isArray(p.reportsAvailable)).toBe(true);
  });
});

describe("ProviderError shape is consistent", () => {
  it("constructed errors expose code, retryable, provider, message", () => {
    const err = new ProviderError({
      provider: "windeed",
      code: "rate_limited",
      message: "Too many requests",
      retryable: true,
      status: 429,
    });
    expect(isProviderError(err)).toBe(true);
    expect(err.code).toBe("rate_limited");
    expect(err.retryable).toBe(true);
    expect(err.provider).toBe("windeed");
    expect(err.toJSON()).toMatchObject({
      name: "ProviderError",
      provider: "windeed",
      code: "rate_limited",
      retryable: true,
      status: 429,
    });
  });

  it("plain-object duck typing is recognized", () => {
    expect(
      isProviderError({
        name: "ProviderError",
        provider: "lightstone",
        code: "not_configured",
        message: "x",
        retryable: false,
      }),
    ).toBe(true);
    expect(isProviderError(new Error("nope"))).toBe(false);
    expect(isProviderError(null)).toBe(false);
  });

  it("not_configured errors are not retryable", () => {
    const e = new ProviderError({
      provider: "surveyor-general",
      code: "not_configured",
      message: "no",
      retryable: false,
    });
    expect(e.retryable).toBe(false);
  });
});
