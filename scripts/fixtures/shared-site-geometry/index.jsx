import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { OrderInvestigationWorkspace } from "@/components/humanReview/OrderInvestigationWorkspace";
import { records, orders, calls, mutations } from "./client.mjs";
import { setOwner } from "../workspace-scope/auth.jsx";
import "@/styles.css";
function App() {
  const [order, setOrder] = useState(orders[0]);
  const [generation, refresh] = useState(0);
  window.fixture = {
    snapshot: () => structuredClone({ records, calls, mutations }),
    switchTo: (i, actor) => {
      if (actor) setOwner(actor);
      setOrder(orders[i]);
    },
    reload: () => refresh((x) => x + 1),
  };
  return (
    <main className="mx-auto max-w-6xl p-4">
      <p>SYNTHETIC ISOLATED GEOMETRY CHECK</p>
      <OrderInvestigationWorkspace
        key={generation}
        orderId={order}
        onApproved={() => {
          throw new Error("Approval prohibited");
        }}
      />
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
