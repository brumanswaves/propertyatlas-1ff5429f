import "./verify-shared-investigation-network.mjs";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { resolve } from "node:path";
const root = "scripts/fixtures/dashboard-metadata";
const server = await createServer({
  configFile: false,
  envFile: false,
  plugins: [
    react(),
    tailwind(),
    {
      name: "synthetic-map-entry",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url?.split("?")[0] === "/")
            req.url =
              "/scripts/fixtures/dashboard-metadata/index.html" +
              (req.url.includes("?") ? "?" + req.url.split("?")[1] : "");
          next();
        });
      },
    },
  ],
  optimizeDeps: { entries: [resolve(root, "index.html")] },
  resolve: {
    alias: [
      {
        find: /^@\/lib\/auth\/useAuth$/,
        replacement: resolve(root, "../workspace-scope/auth.jsx"),
      },
      { find: /^@\/integrations\/supabase\/client$/, replacement: resolve(root, "client.mjs") },
      { find: /^@tanstack\/react-router$/, replacement: resolve(root, "router.jsx") },
      {
        find: /^@\/components\/(layout\/(TopNav|Footer)|admin\/StaffDashboardLinks)$/,
        replacement: resolve(root, "ui.jsx"),
      },
      {
        find: /^@\/components\/(map\/(MapCanvas|SearchBar|LayerSwitcher)|property\/(OfficialParcelPanel|PropertyPanel)|ui\/sonner)$/,
        replacement: resolve(root, "../workspace-scope/ui.jsx"),
      },
      { find: "@", replacement: resolve("src") },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: { host: "127.0.0.1", port: 4191, strictPort: true, open: false },
});
await server.listen();
console.log(
  "Synthetic dashboard: http://127.0.0.1:4191/scripts/fixtures/dashboard-metadata/index.html",
);
