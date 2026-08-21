import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FOUNDER_PROJECT_REF = "xiqpfhsdlvwrwhclonsg";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("founder-owned backend cutover config", () => {
  it("points browser runtime configuration at the canonical founder project", () => {
    const envFile = read(".env");

    expect(envFile).toContain(`SUPABASE_PROJECT_ID="${FOUNDER_PROJECT_REF}"`);
    expect(envFile).toContain(`VITE_SUPABASE_PROJECT_ID="${FOUNDER_PROJECT_REF}"`);
    expect(envFile).toContain(`VITE_SUPABASE_URL="https://${FOUNDER_PROJECT_REF}.supabase.co"`);
  });

  it("activates founder auth and Site Potential transport together", () => {
    const envFile = read(".env");

    expect(envFile).toContain("VITE_FOUNDER_SUPABASE_AUTH=true");
    expect(envFile).toContain("VITE_SITE_POTENTIAL_EDGE_API=true");
  });

  it("keeps local Supabase config neutral instead of treating it as remote ownership proof", () => {
    const supabaseConfig = read("supabase/config.toml");
    const ownershipDoc = read("docs/EASY_ERF_BACKEND_OWNERSHIP.md");

    expect(supabaseConfig).toContain('project_id = "easy-erf"');
    expect(supabaseConfig).not.toContain(FOUNDER_PROJECT_REF);
    expect(ownershipDoc).toContain(FOUNDER_PROJECT_REF);
  });
});
