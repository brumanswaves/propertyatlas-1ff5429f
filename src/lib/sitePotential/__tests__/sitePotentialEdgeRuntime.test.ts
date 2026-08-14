import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

const workerGraph = [
  "src/lib/sitePotential/processWorkerRequest.ts",
  "src/lib/sitePotential/generationSupabaseWorker.ts",
  "src/lib/sitePotential/generationWorker.ts",
  "src/lib/sitePotential/generationJobs.ts",
  "src/lib/sitePotential/generation.ts",
  "src/lib/sitePotential/parcelContext.ts",
  "src/lib/sitePotential/parcelRuntimeContext.ts",
  "src/lib/sitePotential/siteContextReference.ts",
  "src/lib/sitePotential/serverAuth.ts",
  "src/lib/sitePotential/runtimeEnv.ts",
  "src/lib/sitePotential/runtimeTypes.ts",
  "src/lib/workbench/erfAssetStoragePaths.ts",
];

describe("founder-owned Site Potential Edge runtime", () => {
  it("keeps the worker import graph free of browser-only aliases and Node Buffer", () => {
    for (const path of workerGraph) {
      const source = read(path);
      expect(source, path).not.toContain('from "@/');
      expect(source, path).not.toContain("Buffer.from");
      expect(source, path).not.toContain("erfFileVault");
    }
    expect(read("src/lib/sitePotential/siteContextReference.ts")).not.toContain(
      'from "geojson"',
    );
  });

  it("ships a Supabase Edge worker backed by encrypted Vault runtime values", () => {
    const edge = read("supabase/functions/site-potential-worker/index.ts");
    const deno = read("supabase/functions/site-potential-worker/deno.json");

    expect(edge).toContain("vault.decrypted_secrets");
    expect(edge).toContain("easy_erf_site_potential_worker_secret");
    expect(edge).toContain("easy_erf_openai_api_key");
    expect(edge).toContain("__EASY_ERF_RUNTIME_ENV__");
    expect(edge).toContain(
      'import("../../../src/lib/sitePotential/processWorkerRequest.ts")',
    );
    expect(edge).not.toContain("erfstoep.lovable.app");
    expect(edge).not.toContain("SITE_POTENTIAL_WORKER_SECRET=");
    expect(deno).toContain('"@supabase/supabase-js"');
    expect(deno).toContain('"npm:@supabase/supabase-js@2.108.1"');
  });

  it("keeps worker authentication and public errors secret-safe", () => {
    const handler = read("src/lib/sitePotential/processWorkerRequest.ts");
    const edge = read("supabase/functions/site-potential-worker/index.ts");

    expect(handler).toContain("X-Site-Potential-Worker-Secret");
    expect(handler).toContain('authorization === `Bearer ${expected}`');
    expect(handler).toContain("Worker authorization failed.");
    expect(handler).toContain("Check private worker logs for details.");
    expect(edge).toContain("Check private worker logs for details.");
  });
});
