// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const reportDossierWrapper = fileURLToPath(
  new URL("./src/components/property/ErfResearchDossierWithLocalTeam.tsx", import.meta.url),
);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "easy-erf-local-property-team-report-wrapper",
        enforce: "pre",
        resolveId(source, importer) {
          const normalizedImporter = importer?.replaceAll("\\", "/");
          if (
            source === "./ErfResearchDossier" &&
            normalizedImporter?.endsWith("/src/components/property/OfficialParcelPanel.tsx")
          ) {
            return reportDossierWrapper;
          }
          return null;
        },
      },
    ],
  },
});
