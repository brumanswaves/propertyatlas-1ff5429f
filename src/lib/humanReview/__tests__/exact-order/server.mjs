import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export async function start() {
  const root = "src/lib/humanReview/__tests__/exact-order";
  const server = await createServer({
    configFile: false,
    envFile: false,
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: /^(@\/lib\/auth\/useAuth|@\/components\/admin\/AdminGuard|@\/integrations\/supabase\/client|@\/components\/layout\/(TopNav|Footer)|@\/components\/humanReview\/OrderInvestigationWorkspace|@\/components\/admin\/FounderHumanReviewEditor|@tanstack\/react-router|sonner)$/,
          replacement: resolve(root, "mocks.jsx"),
        },
        { find: "@", replacement: resolve("src") },
      ],
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: { entries: [resolve(root, "index.html")] },
    server: { host: "127.0.0.1", port: 4195, strictPort: true, open: false },
  });
  await server.listen();
  return server;
}
