import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cleanupMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260829140000_remove_legacy_report_order_policies.sql",
  ),
  "utf8",
);

describe("Easy Erf legacy report-order policy cleanup", () => {
  it("removes the exact lowercase write policy found in the founder backend", () => {
    expect(cleanupMigration).toContain(
      'drop policy if exists "users manage own report orders" on public.report_orders;',
    );
    expect(cleanupMigration).toContain(
      'drop policy if exists "users can manage own report orders" on public.report_orders;',
    );
  });

  it("removes the duplicate historical admin-read policy and reasserts read-only customer access", () => {
    expect(cleanupMigration).toContain(
      'drop policy if exists "admins read all report orders" on public.report_orders;',
    );
    expect(cleanupMigration).toContain(
      "revoke insert, update, delete on table public.report_orders from anon, authenticated;",
    );
  });
});
