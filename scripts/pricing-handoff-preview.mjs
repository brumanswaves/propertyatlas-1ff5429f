// Synthetic component verification only. No credentials or remote backend.
import "./verify-shared-investigation-network.mjs";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { resolve } from "node:path";
const syntheticProfiles = new Map();
let accountFailure = "none";
const server = await createServer({
  configFile: false, envFile: false, appType: "spa",
  define: { "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("http://127.0.0.1:4190"), "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("synthetic-only") },
  plugins: [{ name: "pricing-fixture-routes", configureServer(server) {
    server.middlewares.use("/__fixture/account/", (req, res) => {
      const mode = req.url?.replace(/^\//, "");
      if (req.method !== "POST" || !["none", "read", "save"].includes(mode)) { res.statusCode = 400; res.end(); return; }
      accountFailure = mode;
      res.end("Synthetic control updated");
    });
    server.middlewares.use("/auth/v1/user", async (req, res) => {
      const owner = /^Bearer synthetic-(owner-[ab])$/.exec(req.headers.authorization ?? "")?.[1];
      res.setHeader("Content-Type", "application/json");
      if (!owner) { res.statusCode = 401; res.end('{}'); return; }
      if ((accountFailure === "read" && req.method === "GET") || (accountFailure === "save" && req.method === "PUT")) { res.statusCode = 503; res.end('{}'); return; }
      if (req.method === "PUT") {
        let body = "";
        for await (const chunk of req) { body += chunk; if (body.length > 8192) { res.statusCode = 413; res.end('{}'); return; } }
        try { syntheticProfiles.set(owner, { ...syntheticProfiles.get(owner), ...JSON.parse(body).data }); }
        catch { res.statusCode = 400; res.end('{}'); return; }
      } else if (req.method !== "GET") { res.statusCode = 405; res.end('{}'); return; }
      res.end(JSON.stringify({ id: owner, email: `${owner}@example.invalid`, user_metadata: syntheticProfiles.get(owner) ?? {} }));
    });
    server.middlewares.use((req, _res, next) => {
      if (/^\/(pricing|auth|orders|dashboard|profile)(\?|$)/.test(req.url)) req.url = "/scripts/fixtures/pricing-handoff.html";
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
