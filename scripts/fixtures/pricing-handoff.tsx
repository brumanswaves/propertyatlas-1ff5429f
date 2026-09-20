import React from "react";
import { createRoot } from "react-dom/client";
import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { Route as PricingRoute } from "@/routes/pricing";
import { Route as OrdersRoute } from "@/routes/orders";
import { safeReturnPath } from "@/lib/navigation";
import { fixtureSignIn } from "./pricing-handoff-auth";
import { FixtureControls } from "./pricing-handoff-shell";
import "@/styles.css";
function SyntheticAuth() {
  const redirect = safeReturnPath(new URLSearchParams(location.search).get("redirect")) ?? "/pricing";
  return <main><h1>Synthetic sign-in only</h1><p>No real account is accessed.</p>
    <button onClick={() => { fixtureSignIn("owner-a"); location.assign(redirect); }}>Return as synthetic owner A</button></main>;
}
const rootRoute = createRootRoute();
const router = createRouter({ routeTree: rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: "/pricing", component: PricingRoute.options.component }),
  createRoute({ getParentRoute: () => rootRoute, path: "/orders", component: OrdersRoute.options.component }),
  createRoute({ getParentRoute: () => rootRoute, path: "/auth", component: SyntheticAuth }),
]) });
createRoot(document.getElementById("root")!).render(<><RouterProvider router={router} /><FixtureControls /></>);
