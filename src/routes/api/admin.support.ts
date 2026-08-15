import { createFileRoute } from "@tanstack/react-router";
import {
  readFounderSupportUser,
  searchFounderSupportUsers,
} from "@/lib/admin/founderSupportServer";
import { ApiRequestError } from "@/lib/sitePotential/serverAuth";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

export const Route = createFileRoute("/api/admin/support")({
  server: {
    handlers: {
      GET: async ({ request }) => handleFounderSupportRequest(request),
    },
  },
});

export async function handleFounderSupportRequest(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");

    if (mode === "search") {
      const users = await searchFounderSupportUsers(request, url.searchParams.get("q") ?? "");
      return json({ success: true, users }, 200);
    }

    if (mode === "user") {
      const userId = url.searchParams.get("userId") ?? "";
      const detail = await readFounderSupportUser(request, userId);
      return json({ success: true, detail }, 200);
    }

    return json({ success: false, error: "Unknown Founder Operations support request." }, 400);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return json({ success: false, error: error.message }, error.status);
    }
    console.error("Founder Operations support request failed", error);
    return json({ success: false, error: "Could not load Founder Operations support data." }, 500);
  }
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), { status, headers: HEADERS });
}
