import React from "react";
import { fixtureSignIn } from "./pricing-handoff-auth";
export function FixtureControls() {
  return <aside style={{ position: "fixed", bottom: 0, right: 0, zIndex: 9999, background: "white", border: "1px solid black" }}>Synthetic test only. No real authentication or payments.
    <button onClick={() => fixtureSignIn("owner-b")}>Switch fixture account</button>
    <button onClick={() => fixtureSignIn(null)}>Sign out fixture</button>
  </aside>;
}
export function Footer() { return null; }
