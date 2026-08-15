import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FOUNDER_PROJECT_REF = "xiqpfhsdlvwrwhclonsg";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("founder-owned frontend cutover config", () => {
  it("points the browser and CLI config at the founder Supabase project", () => {
    const envFile = read(".env");
    const supabaseConfig = read("supabase/config.toml");

    expect(envFile).toContain(`SUPABASE_PROJECT_ID="${FOUNDER_PROJECT_REF}"`);
    expect(envFile).toContain(`VITE_SUPABASE_PROJECT_ID="${FOUNDER_PROJECT_REF}"`);
    expect(envFile).toContain(`VITE_SUPABASE_URL="https://${FOUNDER_PROJECT_REF}.supabase.co"`);
    expect(supabaseConfig).toContain(`project_id = "${FOUNDER_PROJECT_REF}"`);
  });

  it("activates founder auth and Site Potential transport together", () => {
    const envFile = read(".env");

    expect(envFile).toContain("VITE_FOUNDER_SUPABASE_AUTH=true");
    expect(envFile).toContain("VITE_SITE_POTENTIAL_EDGE_API=true");
  });

  it("does not keep a Lovable-specific setup instruction in the Supabase client", () => {
    const client = read("src/integrations/supabase/client.ts");

    expect(client).not.toContain("Connect Supabase in Lovable Cloud");
    expect(client).toContain("Configure the Easy Erf Supabase environment.");
  });
});
