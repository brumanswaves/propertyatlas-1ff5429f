from pathlib import Path

ux = Path("src/components/property/__tests__/dossierUx.test.ts")
text = ux.read_text()
text = text.replace(
    '    const localTeam = read("src/components/property/dossier/LocalPropertyTeam.tsx");\n',
    '    const localTeam = read("src/components/property/dossier/LocalPropertyTeam.tsx");\n'
    '    const localCatalog = read("src/lib/localServices/catalog.ts");\n',
    1,
)
for label in ["Plan and Build", "Protect and Maintain", "Connect the Property", "Buy, Sell or Manage"]:
    text = text.replace(
        f'    expect(localTeam).toContain("{label}");',
        f'    expect(localCatalog).toContain("{label}");',
        1,
    )
ux.write_text(text)

beta = Path("src/lib/sitePotential/__tests__/betaEntitlements.test.ts")
text = beta.read_text()
text = text.replace(
    '  it("shows free allowance, purchased credits and inline report-only concept selection", () => {',
    '  it("shows free allowance and inline report-only concept selection while purchase UI is hidden", () => {',
    1,
)
text = text.replace(
    '    expect(tab).toContain("Buy more Site Potential credits");',
    '    expect(tab).not.toContain("Buy more Site Potential credits");',
    1,
)
text = text.replace(
    '    expect(tab).toContain("Checkout connection pending");',
    '    expect(tab).not.toContain("Checkout connection pending");',
    1,
)
beta.write_text(text)
