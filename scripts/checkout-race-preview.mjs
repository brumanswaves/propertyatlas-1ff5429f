import "./verify-mobile-network.mjs";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {resolve} from "node:path";
const server = await createServer({
 configFile: false, envFile: false, appType: "spa", plugins: [react(), {name: "synthetic-race", configureServer(server) {
  server.middlewares.use((req, res, next) => {
   if (/^\/(pricing)?(\?|$)/.test(req.url)) req.url = "/scripts/fixtures/checkout-race.html";
   next();
  });
 }}],
 resolve: {alias: [
  {find: "@/integrations/supabase/client", replacement: resolve("scripts/fixtures/checkout-race-auth.ts")},
  {find: "@/components/layout/TopNav", replacement: resolve("scripts/fixtures/checkout-race-shell.tsx")},
  {find: "@/components/layout/Footer", replacement: resolve("scripts/fixtures/checkout-race-shell.tsx")},
  {find: "@", replacement: resolve("src")},
 ], dedupe: ["react", "react-dom"]},
 server: {host: "127.0.0.1", port: 4191, strictPort: true},
});
await server.listen();
console.log("Synthetic checkout races http://127.0.0.1:4191");
