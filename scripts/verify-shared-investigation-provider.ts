// Only the external model response is a fixture. The production Edge handler,
// its authorization and its structured response validation execute unchanged.
import { ASK_EASY_ERF_OPENAI_URL } from "../supabase/functions/_shared/askEasyErfContract.ts";

const fetchImpl = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url === "https://api.resend.com/emails") {
    const mail = JSON.parse(String(init?.body));
    if (!JSON.stringify(mail.to).includes("@example.invalid")) throw new Error("Only synthetic recipients are permitted");
    return Response.json({ id: "isolated-provider-receipt" });
  }
  if (url === ASK_EASY_ERF_OPENAI_URL) {
    const body = JSON.parse(String(init?.body));
    const content = JSON.parse(body.messages.at(-1).content);
    let answer;
    if (body.response_format.json_schema.name === "investigation_brief") {
      const source = content.evidence.sources.find((s: { id: string }) => s.id === "investigation-work-property_checks") ?? content.evidence.sources[0];
      const statement = { text: "Synthetic provider fixture: recorded evidence requires the stated follow-up checks.", sourceRefs: [source.id] };
      answer = { bottomLine: statement, known: [statement], potential: [statement], risks: [statement], unknowns: [statement], nextSteps: [statement] };
    } else {
      const refs = body.response_format.json_schema.schema.properties.evidenceReferences.items.properties.ref.enum;
      answer = { answer: "Synthetic answer: this saved evidence still has recorded limitations.", confidence: "low",
        evidenceReferences: [{ ref: refs[0], label: "Fixture", sourceType: "document" }], unknowns: [], nextAction: null };
    }
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(answer) } }] });
  }
  if (new URL(url).hostname !== "127.0.0.1") throw new Error("External traffic blocked in provider fixture");
  return fetchImpl(input, init);
};
const serve = Deno.serve;
const handlers = new Map<string, Deno.ServeHandler>();
let registering = "";
Deno.serve = ((handler: Deno.ServeHandler) => { handlers.set(registering, handler); }) as typeof Deno.serve;
registering = "ask-easy-erf-openai";
await import("../supabase/functions/ask-easy-erf-openai/index.ts");
registering = "easy-erf-founder-fulfillment";
await import("../supabase/functions/easy-erf-founder-fulfillment/index.ts");
registering = "easy-erf-founder-customer-notification";
await import("../supabase/functions/easy-erf-founder-customer-notification/index.ts");
serve({ hostname: "127.0.0.1", port: 54326 }, (request, info) => {
  const handler = handlers.get(new URL(request.url).pathname.split("/").at(-1) ?? "");
  return handler ? handler(request, info) : Response.json({ error: "No external provider access" }, { status: 404 });
});
