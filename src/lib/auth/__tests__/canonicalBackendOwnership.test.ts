import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FOUNDER_PROJECT_REF = "xiqpfhsdlvwrwhclonsg";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("canonical Easy Erf backend ownership", () => {
  it("keeps local Supabase config neutral instead of pretending it selects a remote", () => {
    const supabaseConfig = read("supabase/config.toml");

    expect(supabaseConfig).toContain('project_id = "easy-erf"');
    expect(supabaseConfig).toMatch(/Local Supabase stack identifier only/i);
    expect(supabaseConfig).not.toContain(FOUNDER_PROJECT_REF);
  });

  it("documents the founder project as the explicit remote target", () => {
    const ownership = read("docs/EASY_ERF_BACKEND_OWNERSHIP.md");

    expect(ownership).toContain(`project ref: \`${FOUNDER_PROJECT_REF}\``);
    expect(ownership).toContain(`supabase link --project-ref ${FOUNDER_PROJECT_REF}`);
    expect(ownership).toMatch(/config\.toml.*local-stack configuration/is);
    expect(ownership).toMatch(/verify the linked project using `supabase projects list`/i);
    expect(ownership).toMatch(/Do not create another Easy Erf Supabase project/i);
  });

  it("allows the verified OAuth cutover config while keeping publication gated on real acceptance", () => {
    const envFile = read(".env");
    const cutoverEvidence = read("docs/CUTOVER_EVIDENCE_2026_08_21.md");

    expect(envFile).toContain(`VITE_SUPABASE_PROJECT_ID="${FOUNDER_PROJECT_REF}"`);
    expect(envFile).toContain("VITE_FOUNDER_SUPABASE_AUTH=true");
    expect(cutoverEvidence).toMatch(/reached the Google OAuth flow/i);
    expect(cutoverEvidence).toMatch(/Browser callback completion/i);
    expect(cutoverEvidence).toMatch(/production publication remains gated on the signed-in Erf 1570 acceptance run/i);
  });

  it("does not tell engineers to create or connect a Lovable-owned backend", () => {
    const client = read("src/integrations/supabase/client.ts");
    const ownership = read("docs/EASY_ERF_BACKEND_OWNERSHIP.md");

    expect(client).not.toContain("Connect Supabase in Lovable Cloud");
    expect(client).toContain("Configure the canonical Easy Erf Supabase environment.");
    expect(ownership).toMatch(/Browser cutover is a separate decision/i);
  });
});
