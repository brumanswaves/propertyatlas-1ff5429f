import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FOUNDER_PROJECT_REF = "xiqpfhsdlvwrwhclonsg";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("canonical Easy Erf backend ownership", () => {
  it("points repository Supabase CLI ownership at the founder project", () => {
    const supabaseConfig = read("supabase/config.toml");

    expect(supabaseConfig).toContain(`project_id = "${FOUNDER_PROJECT_REF}"`);
  });

  it("keeps browser cutover separate while founder Google OAuth is still gated", () => {
    const envFile = read(".env");

    expect(envFile).toContain("VITE_FOUNDER_SUPABASE_AUTH=false");
  });

  it("does not tell engineers to create or connect a Lovable-owned backend", () => {
    const client = read("src/integrations/supabase/client.ts");
    const ownership = read("docs/EASY_ERF_BACKEND_OWNERSHIP.md");

    expect(client).not.toContain("Connect Supabase in Lovable Cloud");
    expect(client).toContain("Configure the canonical Easy Erf Supabase environment.");
    expect(ownership).toContain(`project ref: \`${FOUNDER_PROJECT_REF}\``);
    expect(ownership).toMatch(/Do not create another Easy Erf Supabase project/i);
    expect(ownership).toMatch(/Browser cutover is a separate decision/i);
  });
});
