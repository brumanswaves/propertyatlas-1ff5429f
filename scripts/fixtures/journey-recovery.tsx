import React from "react";
import { createRoot } from "react-dom/client";
import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { PropertyPanel } from "@/components/property/PropertyPanel";
import { PROPERTIES } from "@/data/properties";
import { Route as PricingRoute } from "@/routes/pricing";
import { HumanReviewTakeoverCard } from "@/components/humanReview/HumanReviewTakeoverCard";
import "@/styles.css";
function HandoffFixture() {
  const [parcel, setParcel] = React.useState("synthetic:erf42");
  const [open, setOpen] = React.useState(true);
  const [calls, setCalls] = React.useState(0);
  const pending = React.useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(
    null,
  );
  return (
    <main style={{ padding: 20 }}>
      <h1>Synthetic handoff recovery</h1>
      <p>
        Current parcel: {parcel}. Save calls: {calls}
      </p>
      <button onClick={() => setParcel("synthetic:erf43")}>Choose erf 43</button>{" "}
      <button onClick={() => pending.current?.resolve()}>Complete synthetic save</button>{" "}
      <button
        onClick={() =>
          pending.current?.reject(new Error("Synthetic save failed. Your draft is retained."))
        }
      >
        Fail synthetic save
      </button>{" "}
      <button onClick={() => setOpen(false)}>Close investigation</button>
      {open && (
        <HumanReviewTakeoverCard
          compact
          parcelId={parcel}
          propertyReference={parcel}
          onPrepare={() => {
            setCalls((count) => count + 1);
            return new Promise<void>((resolve, reject) => {
              pending.current = { resolve, reject };
            });
          }}
        />
      )}
    </main>
  );
}
const root = createRootRoute();
const router = createRouter({
  routeTree: root.addChildren([
    createRoute({
      getParentRoute: () => root,
      path: "/scripts/fixtures/journey-demo.html",
      component: () => <PropertyPanel property={PROPERTIES[0]} onClose={() => {}} />,
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/pricing",
      component: PricingRoute.options.component,
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/scripts/fixtures/handoff-recovery.html",
      component: HandoffFixture,
    }),
  ]),
});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
