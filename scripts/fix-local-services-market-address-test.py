from pathlib import Path

path = Path("src/components/property/__tests__/dossierUx.test.ts")
text = path.read_text()
old = 'expect(localTeam).toContain("marketAddress.formattedAddress");'
new = 'expect(localTeam).toContain("marketAddress?.formattedAddress");'
if old not in text:
    raise SystemExit("Expected Local Property Team address assertion not found")
path.write_text(text.replace(old, new, 1))
