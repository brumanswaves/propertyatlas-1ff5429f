import React from "react";
import { fixtureSignIn, holdDashboardRead, completeDashboardRead } from "./pricing-handoff-auth";
export function FixtureControls() {
  return <aside style={{ position: "fixed", bottom: 0, right: 0, zIndex: 9999, background: "white", border: "1px solid black" }}>Synthetic test only. No real authentication or payments.
    <button onClick={() => fixtureSignIn("owner-b")}>Switch fixture account</button>
    <button onClick={() => fixtureSignIn(null)}>Sign out fixture</button>
    <button onClick={() => sessionStorage.setItem("fixture-report-read", "allow")}>Allow synthetic report read</button>
    <button onClick={() => sessionStorage.removeItem("fixture-report-read")}>Fail synthetic report read</button>
    <button onClick={() => fixtureSignIn("owner-a")}>Use synthetic owner A</button>
    <button onClick={holdDashboardRead}>Hold dashboard reads</button>
    <button onClick={completeDashboardRead}>Complete dashboard reads</button>
    <button onClick={() => sessionStorage.setItem("fixture-dashboard-fail", "yes")}>Fail dashboard reads</button>
    <button onClick={() => sessionStorage.removeItem("fixture-dashboard-fail")}>Allow dashboard reads</button>
  </aside>;
}
export function Footer() { return null; }
