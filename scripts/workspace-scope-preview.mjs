import "./verify-shared-investigation-network.mjs";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
const root = "scripts/fixtures/workspace-scope";
const server = await createServer({
  configFile: false,
  envFile: false,
  plugins: [react()],
  optimizeDeps: { entries: [resolve(root, "index.html")] },
  resolve: {
    alias: [
      { find: /^@\/lib\/auth\/useAuth$/, replacement: resolve(root, "auth.jsx") },
      { find: /^@\/integrations\/supabase\/client$/, replacement: resolve(root, "client.mjs") },
      { find: /^@tanstack\/react-router$/, replacement: resolve(root, "router.jsx") },
      { find: /^@\/lib\/auth\/StaffAccess$/, replacement: resolve(root, "ui.jsx") },
      {
        find: /^@\/components\/(map\/(MapCanvas|SearchBar|LayerSwitcher)|property\/(OfficialParcelPanel|PropertyPanel)|layout\/TopNav|ui\/sonner)$/,
        replacement: resolve(root, "ui.jsx"),
      },
      { find: "@", replacement: resolve("src") },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: { host: "127.0.0.1", port: 4190, strictPort: true, open: false },
});
await server.listen();
console.log(
  "Synthetic workspace fixture: http://127.0.0.1:4190/scripts/fixtures/workspace-scope/index.html",
);
