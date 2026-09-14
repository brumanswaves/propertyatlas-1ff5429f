import { createFileRoute } from "@tanstack/react-router";
import { FounderFulfillmentPage } from "./admin_.fulfillment";

export const Route = createFileRoute("/investigator")({
  head: () => ({ meta: [{ title: "Investigator Dashboard | Easy Erf" }, { name: "robots", content: "noindex" }] }),
  component: FounderFulfillmentPage,
});
