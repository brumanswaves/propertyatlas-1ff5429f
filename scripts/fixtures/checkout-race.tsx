import React from "react";
import {createRoot} from "react-dom/client";
import {createRootRoute, createRoute, createRouter, RouterProvider} from "@tanstack/react-router";
import {Route as PricingRoute} from "@/routes/pricing";
import {controls, errorResponse} from "./checkout-race-auth";
const root = createRootRoute();
const router = createRouter({routeTree: root.addChildren([
  createRoute({getParentRoute: () => root, path: "/pricing", component: PricingRoute.options.component}),
  createRoute({getParentRoute: () => root, path: "/", loader: () => controls.navigation(), component: () => <h1>Synthetic destination</h1>}),
])});
Object.assign(window, {checkoutFixture: {...controls, navigate: (to: string) => router.navigate({to}), errorResponse}});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);
