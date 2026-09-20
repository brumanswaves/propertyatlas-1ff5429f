// Synthetic component verification only. No credentials or remote backend.
import "./verify-shared-investigation-network.mjs";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { resolve } from "node:path";
const server = await createServer({
  configFile: false, envFile: false, appType: "spa",
  plugins: [{ name: "pricing-fixture-routes", configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (/^\/(pricing|auth)(\?|$)/.test(req.url)) req.url = "/scripts/fixtures/pricing-handoff.html";
      next();
    });
  } }, react(), tailwind()],
  resolve: { alias: [
    { find: "@/integrations/supabase/client", replacement: resolve("scripts/fixtures/pricing-handoff-auth.ts") },
    { find: "@/components/layout/Footer", replacement: resolve("scripts/fixtures/pricing-handoff-shell.tsx") },
    { find: "@", replacement: resolve("src") },
  ], dedupe: ["react", "react-dom"] },
  server: { host: "127.0.0.1", port: 4190, strictPort: true, headers: {
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:4190; form-action 'none'; frame-src 'none'",
  } },
});
await server.listen();
console.log("Synthetic pricing preview: http://127.0.0.1:4190/pricing?parcelId=synthetic:erf42&propertyReference=Erf%2042&source=report");
