// Local-only component preview: no application route, credentials or backend.
import "./verify-shared-investigation-network.mjs";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { resolve } from "node:path";

const server = await createServer({
  configFile: false, envFile: false, plugins: [react(), tailwind()],
  resolve: { alias: { "@": resolve(process.env.REPORT_SOURCE_ROOT || ".", "src") }, dedupe: ["react", "react-dom"] },
  define: { "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("http://127.0.0.1:1"),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("synthetic-no-access"),
    "import.meta.env.VITE_MAPBOX_ACCESS_TOKEN": "undefined" },
  server: { host: "127.0.0.1", port: Number(process.env.REPORT_PORT || 4188), strictPort: true, open: false,
    fs: { allow: [resolve(".."), resolve("node_modules")] } },
});
await server.listen();
console.log(`Synthetic report preview: http://127.0.0.1:${process.env.REPORT_PORT || 4188}/scripts/fixtures/report-preview.html`);
