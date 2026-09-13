import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@/lib/sitePotential/runtimeEnv", () => ({
  readServerEnv: (name: string) => mocks.env[name],
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import {
  authenticateFounderSupportRequest,
  founderSupportBackendConfig,
} from "../founderSupportServer";

const url = "https://xiqpfhsdlvwrwhclonsg.supabase.co";
const request = () =>
  new Request("https://easyerf.co.za/api/admin/support?mode=investigators", {
    headers: { Authorization: "Bearer synthetic-founder-token" },
  });
function configure() {
  Object.assign(mocks.env, {
    EASY_ERF_SUPABASE_URL: url,
    EASY_ERF_SUPABASE_PUBLISHABLE_KEY: "canonical-public-fixture",
    EASY_ERF_SUPABASE_SERVICE_ROLE_KEY: "canonical-service-fixture",
  });
}
beforeEach(() => {
  mocks.env = {
    SUPABASE_URL: "https://retired-project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "retired-public-fixture",
    SUPABASE_SERVICE_ROLE_KEY: "retired-service-fixture",
  };
  mocks.getUser.mockResolvedValue({ data: { user: { id: "founder" } }, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: { role: "admin" }, error: null });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: mocks.maybeSingle,
  };
  mocks.createClient.mockReturnValue({
    auth: { getUser: mocks.getUser },
    from: vi.fn(() => query),
  });
});
afterEach(() => vi.clearAllMocks());

describe("Founder Ops canonical backend boundary", () => {
  it("sends real Auth and role requests only to the selected isolated backend", async () => {
    const actual = await vi.importActual<typeof import("@supabase/supabase-js")>("@supabase/supabase-js");
    mocks.createClient.mockImplementation(actual.createClient);
    const calls: { path: string; authorization?: string; apiKey?: string }[] = [];
    const server = createServer((req, res) => {
      calls.push({ path: req.url!, authorization: req.headers.authorization, apiKey: req.headers.apikey as string });
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/auth/v1/user") {
        res.end(JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", aud: "authenticated" }));
      } else if (req.url?.startsWith("/rest/v1/user_roles?")) {
        res.end(JSON.stringify([{ role: "admin" }]));
      } else {
        res.statusCode = 404;
        res.end("{}");
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      configure();
      mocks.env.EASY_ERF_SUPABASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const result = await authenticateFounderSupportRequest(request());
      expect(result.actor.id).toBe("11111111-1111-4111-8111-111111111111");
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({ path: "/auth/v1/user", authorization: "Bearer synthetic-founder-token", apiKey: "canonical-public-fixture" });
      expect(calls[1].path).toContain("user_id=eq.11111111-1111-4111-8111-111111111111");
      expect(calls[1].path).toContain("role=eq.admin");
      expect(calls[1].apiKey).toBe("canonical-service-fixture");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("uses the same explicit backend for token validation and the privileged admin lookup", async () => {
    configure();
    await authenticateFounderSupportRequest(request());
    expect(mocks.getUser).toHaveBeenCalledWith("synthetic-founder-token");
    expect(mocks.createClient.mock.calls.map(([target, key]) => [target, key])).toEqual([
      [url, "canonical-public-fixture"],
      [url, "canonical-service-fixture"],
    ]);
  });

  it("rejects the retired hosting-injected project before sending the founder token anywhere", async () => {
    await expect(authenticateFounderSupportRequest(request())).rejects.toMatchObject({
      status: 503,
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each([
    "EASY_ERF_SUPABASE_URL",
    "EASY_ERF_SUPABASE_PUBLISHABLE_KEY",
    "EASY_ERF_SUPABASE_SERVICE_ROLE_KEY",
  ])("does not fill missing %s with another project's injected credential", async (name) => {
    configure();
    delete mocks.env[name];
    await expect(authenticateFounderSupportRequest(request())).rejects.toMatchObject({
      status: 503,
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each([
    "https://attacker.invalid",
    url + ".attacker.invalid",
    url + "/other",
    "https://name:password@xiqpfhsdlvwrwhclonsg.supabase.co",
  ])("rejects an unexpected backend %s", (target) => {
    configure();
    mocks.env.EASY_ERF_SUPABASE_URL = target;
    expect(() => founderSupportBackendConfig()).toThrow("backend connection");
  });

  it("retains a correctly configured canonical standard runtime", () => {
    mocks.env.SUPABASE_URL = url;
    expect(founderSupportBackendConfig().url).toBe(url);
  });

  it("retains isolated loopback runtime support without contacting production", () => {
    mocks.env.SUPABASE_URL = "http://127.0.0.1:54321";
    expect(founderSupportBackendConfig().url).toBe("http://127.0.0.1:54321");
  });

  it("rejects a missing bearer token before privileged client creation", async () => {
    configure();
    await expect(
      authenticateFounderSupportRequest(new Request("https://easyerf.co.za/api/admin/support")),
    ).rejects.toMatchObject({ status: 401 });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("keeps expired sessions rejected and does not create a service client", async () => {
    configure();
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    await expect(authenticateFounderSupportRequest(request())).rejects.toMatchObject({
      status: 401,
    });
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
  });

  it("does not promote an authenticated customer or investigator to admin", async () => {
    configure();
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(authenticateFounderSupportRequest(request())).rejects.toMatchObject({
      status: 403,
    });
  });

  it("does not expose credentials or backend errors in configuration failures", async () => {
    configure();
    mocks.env.EASY_ERF_SUPABASE_URL = "https://invalid.invalid";
    try {
      await authenticateFounderSupportRequest(request());
      expect.fail("must reject");
    } catch (error) {
      const visible = String(error);
      expect(visible).not.toContain("fixture");
      expect(visible).not.toContain("invalid.invalid");
      expect(visible).not.toContain("Sign in is required");
    }
  });
});
