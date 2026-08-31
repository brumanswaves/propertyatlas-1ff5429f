import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migration = source(
  "supabase/migrations/20260831090000_easy_erf_founder_fulfillment_controls.sql",
);
const founderFunction = source("supabase/functions/easy-erf-founder-fulfillment/index.ts");
const config = source("supabase/config.toml");

describe("Easy Erf founder fulfillment database authority", () => {
  it("keeps customer roles unable to write fulfillment state", () => {
    expect(migration).toContain(
      "revoke all on function public.transition_easy_erf_report_order(uuid, text, uuid, text, text)\nfrom public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.transition_easy_erf_report_order(uuid, text, uuid, text, text)\nto service_role",
    );
    expect(migration).toContain(
      "revoke all on table public.report_order_events from public, anon, authenticated",
    );
  });

  it("enforces a narrow paid-processing-ready-or-failed state machine", () => {
    expect(migration).toContain("when 'start_review' then");
    expect(migration).toContain("Only paid orders can start review");
    expect(migration).toContain("when 'mark_ready' then");
    expect(migration).toContain("Only processing orders can be marked ready");
    expect(migration).toContain("when 'mark_failed' then");
    expect(migration).toContain("Only paid or processing orders can be marked failed");
    expect(migration).not.toContain("when 'mark_paid'");
  });

  it("requires a report artifact before ready and records immutable transition events", () => {
    expect(migration).toContain("A report PDF storage path is required before marking ready");
    expect(migration).toContain("insert into public.report_order_events");
    expect(migration).toContain("actor_user_id");
    expect(migration).toContain("from_status");
    expect(migration).toContain("to_status");
  });
});

describe("Easy Erf founder fulfillment Edge Function", () => {
  it("requires JWT and an explicit admin-role check before service-role use", () => {
    expect(config).toMatch(
      /\[functions\.easy-erf-founder-fulfillment\][\s\S]*verify_jwt = true/,
    );
    expect(founderFunction).toContain('request.headers.get("authorization")');
    expect(founderFunction).toContain('userClient.auth.getUser()');
    expect(founderFunction).toContain('userClient.rpc("has_role"');
    expect(founderFunction).toContain('_role: "admin"');
    expect(founderFunction.indexOf('userClient.rpc("has_role"')).toBeLessThan(
      founderFunction.indexOf('createClient(supabaseUrl, serviceRoleKey'),
    );
  });

  it("accepts only the three explicit fulfillment actions", () => {
    expect(founderFunction).toContain(
      'new Set(["start_review", "mark_ready", "mark_failed"])',
    );
    expect(founderFunction).toContain("Unsupported fulfillment action.");
  });

  it("does not accept actor identity from the request body", () => {
    expect(founderFunction).toContain("p_actor_user_id: user.id");
    expect(founderFunction).not.toMatch(/body\.(actor|userId|actorUserId)/);
  });
});
