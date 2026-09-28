import React, { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { FounderFulfillmentPage } from "@/routes/admin_.fulfillment";
import { useFounderOrderData } from "../../useFounderOrderData";
window.fixture ??= {
  user: "actor-a",
  loading: false,
  admin: true,
  requests: [],
  pending: [],
  errors: [],
};
function Probe() {
  const data = useFounderOrderData(window.fixture.selection, !window.fixture.admin);
  window.fixture.data = data;
  return <button onClick={() => data.refresh()}>Probe refresh</button>;
}
function App() {
  const [epoch, setEpoch] = useState(0);
  window.fixture.render = () => setEpoch((x) => x + 1);
  return (
    <React.Fragment key={window.fixture.mount ?? 0}>
      {window.fixture.probe ? <Probe /> : <FounderFulfillmentPage />}
      <span data-epoch={epoch} />
    </React.Fragment>
  );
}
// Real server render followed by hydration: route intent is unresolved on SSR.
const root = document.getElementById("root");
root.innerHTML = renderToString(<App />);
window.fixture.ssrRequests = window.fixture.requests.length;
hydrateRoot(
  root,
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
