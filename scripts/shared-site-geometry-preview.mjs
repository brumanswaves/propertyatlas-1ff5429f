import "./verify-shared-investigation-network.mjs";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { resolve } from "node:path";
const root = "scripts/fixtures/shared-site-geometry";
const source = resolve(process.env.GEOMETRY_SOURCE_ROOT || ".", "src");
const server = await createServer({
  configFile: false,
  envFile: false,
  plugins: [react(), tailwind()],
  resolve: {
    alias: [
      {
        find: /^@\/lib\/auth\/useAuth$/,
        replacement: resolve(root, "../workspace-scope/auth.jsx"),
      },
      { find: /^@\/integrations\/supabase\/client$/, replacement: resolve(root, "client.mjs") },
      {
        find: /^@\/components\/(admin\/AdminGuard|property\/investigation\/(ConfirmPropertyStep|AddAddressStep|GuidedSgDiagramStep|GuidedTitleStep|GuidedPropertyChecksStep|GuidedZoningStep)|property\/strategy\/StrategyLab)$/,
        replacement: resolve(root, "ui.jsx"),
      },
      {
        find: /^@\/features\/marketEvidence\/components\/MarketEvidenceTab$/,
        replacement: resolve(root, "ui.jsx"),
      },
      {
        find: /^\.\/(SharedInvestigationReport|HumanOnlyReviewEditor)$/,
        replacement: resolve(root, "ui.jsx"),
      },
      { find: "@", replacement: source },
    ],
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: { entries: [resolve(root, "index.html")] },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.GEOMETRY_PORT || 4193),
    strictPort: true,
    open: false,
    fs: { allow: [resolve("."), source, resolve("../easy-erf-handoff-continuity/node_modules")] },
  },
});
await server.listen();
console.log(
  "Isolated Site Potential fixture: http://127.0.0.1:4193/scripts/fixtures/shared-site-geometry/index.html",
);
