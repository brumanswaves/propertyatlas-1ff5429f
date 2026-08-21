from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        return
    p.write_text(text.replace(old, new, 1))


def replace_between(path: str, start: str, end: str, replacement: str) -> None:
    p = Path(path)
    text = p.read_text()
    a = text.find(start)
    if a < 0:
        return
    b = text.find(end, a)
    if b < 0:
        raise SystemExit(f"Missing end marker in {path}: {end}")
    p.write_text(text[:a] + replacement + text[b:])


def replace_test(path: str, title: str, replacement: str) -> None:
    p = Path(path)
    text = p.read_text()
    marker = f'  it("{title}",'
    a = text.find(marker)
    if a < 0:
        return
    b = text.find('\n  it("', a + len(marker))
    if b < 0:
        b = text.find('\n});', a)
    if b < 0:
        raise SystemExit(f"Could not find end of test in {path}: {title}")
    p.write_text(text[:a] + replacement.rstrip() + '\n' + text[b:])


replace_once(
    'src/lib/__tests__/publicSiteTruthGuardrails.test.ts',
    'expect(pricing).toMatch(/without a subscription/i);',
    'expect(pricing).toMatch(/no subscription required/i);',
)
replace_once(
    'src/components/property/__tests__/dossierUx.test.ts',
    'expect(nav).toContain("bg-[#06152A]/85");',
    'expect(nav).toContain("bg-primary/95");\n    expect(nav).toContain("text-white/80");',
)
replace_between(
    'src/components/property/__tests__/dossierUx.test.ts',
    '    expect(sitePotential).toContain("SITE_POTENTIAL_DISCLAIMER");',
    '    expect(dossier).toContain("buildEvidenceAppendixRows");',
    '''    expect(sitePotential).toContain("Guided Investigation / Site Potential");
    expect(sitePotential).toContain("Back to Investigation");
    expect(sitePotential).toContain("Continue to Easy Erf Report");
    expect(sitePotential).toContain("approximate buildable area");
    expect(sitePotential).toContain("Topographical survey");
    expect(sitePotential).toContain("Architectural or existing plans");
    expect(sitePotential).toContain("Other site evidence");
    expect(sitePotential).toContain('uploadFiles(files, "architectural_plan")');
    expect(sitePotential).toContain('uploadFiles(files, "other")');
    expect(sitePotential).not.toContain("Generate three independent Site Potential concepts");
    expect(sitePotential).not.toContain("Generate 3 concepts");
    expect(sitePotentialIntegrityMigration).toContain("erf_site_projects_selected_design_integrity");
    expect(sitePotentialIntegrityMigration).toContain("asset_row.user_id <> NEW.user_id");
    expect(sitePotentialIntegrityMigration).toContain("asset_row.parcel_id <> NEW.parcel_id");

''',
)
replace_between(
    'src/components/property/__tests__/dossierUx.test.ts',
    '    expect(sitePotential).not.toContain(\'id="site-potential-credits"\');',
    '  });\n});\n\ndescribe("Investor Decision Mode guardrails"',
    '''    expect(sitePotential).not.toContain('id="site-potential-credits"');
    expect(sitePotential).not.toContain("Checkout connection pending");
    expect(sitePotential).not.toContain("Site Potential generation progress");
    expect(sitePotential).not.toContain("Retry current pack");
    expect(sitePotential).not.toContain("Generate 3 concepts");
    expect(sitePotential).toContain("Review the approximate buildable area");
    expect(sitePotential).toContain("Supporting evidence");
''',
)
replace_test(
    'src/lib/sitePotential/__tests__/betaEntitlements.test.ts',
    'shows free allowance and inline report-only concept selection while purchase UI is hidden',
    '''  it("keeps concept generation out of the R999 Site Potential UI while backend helpers remain isolated", () => {
    const tab = read("src/components/property/dossier/SitePotentialTab.tsx");
    const apiClient = read("src/lib/sitePotential/sitePotentialApiClient.ts");
    expect(tab).not.toContain("VITE_SITE_POTENTIAL_BETA_UI");
    expect(tab).not.toContain("Generate 3 free concepts");
    expect(tab).not.toContain("Use 1 credit for 3 concepts");
    expect(tab).not.toContain("Site Potential generation progress");
    expect(tab).toContain("approximate buildable area");
    expect(apiClient).toContain('"beta-redeem"');
    expect(apiClient).toContain('"pack-status"');
    expect(apiClient).toContain('"retry-pack"');
  });''',
)
replace_test(
    'src/lib/sitePotential/__tests__/betaEntitlements.test.ts',
    'keeps Site Potential allowance status parcel-safe before showing eligibility',
    '''  it("keeps beta allowance plumbing out of the simplified R999 Site Potential UI", () => {
    const tab = read("src/components/property/dossier/SitePotentialTab.tsx");
    const request = read("src/lib/sitePotential/betaStatusRequest.ts");
    expect(tab).not.toContain("BETA_UI_ENABLED");
    expect(tab).not.toContain("Retry allowance check");
    expect(request).toContain('export type AllowanceStatusLifecycle = "loading" | "ready" | "error"');
    expect(request).toContain("SITE_POTENTIAL_ALLOWANCE_SIGN_IN_MESSAGE");
  });''',
)
replace_test(
    'src/lib/sitePotential/__tests__/betaEntitlements.test.ts',
    'retries the current pack without consuming another entitlement or worker secret',
    '''  it("keeps retry-pack backend behavior isolated from the simplified R999 UI", () => {
    const tab = read("src/components/property/dossier/SitePotentialTab.tsx");
    const apiClient = read("src/lib/sitePotential/sitePotentialApiClient.ts");
    expect(tab).not.toContain("Retry current pack");
    expect(tab).not.toContain("No additional credit was used.");
    expect(apiClient).toContain('"retry-pack"');
  });''',
)
replace_test(
    'src/lib/sitePotential/__tests__/selectionPersistence.test.ts',
    'uses explicit selection to replace or deselect the preferred concept',
    '''  it("removes concept selection controls from the simplified R999 Site Potential UI", () => {
    const sitePotentialTab = read("src/components/property/dossier/SitePotentialTab.tsx");
    expect(sitePotentialTab).not.toContain("selected_design_asset_id: asset?.id ?? null");
    expect(sitePotentialTab).not.toContain("Select for Easy Erf Report");
  });''',
)
replace_test(
    'src/lib/sitePotential/__tests__/selectionPersistence.test.ts',
    'resolves the Site Potential hook against all generated assets, not the active pack filter',
    '''  it("keeps generated-concept hook plumbing out of the simplified R999 Site Potential UI", () => {
    const sitePotentialTab = read("src/components/property/dossier/SitePotentialTab.tsx");
    const service = read("src/lib/sitePotential/sitePotentialService.ts");
    expect(sitePotentialTab).not.toContain("useSitePotentialProject(parcel.id, allGeneratedDesigns)");
    expect(sitePotentialTab).not.toContain("removeGeneratedDesign(asset)");
    expect(service).not.toContain("clearMissingSelectedDesign");
  });''',
)
