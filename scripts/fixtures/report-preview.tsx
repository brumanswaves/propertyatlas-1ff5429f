import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { SharedInvestigationReport } from "@/components/humanReview/SharedInvestigationReport";
import { reportPreviewAssembly } from "./report-preview-data";
import "@/styles.css";

const supported = new URLSearchParams(location.search).get("evidence") === "supported";
const assembly = reportPreviewAssembly(supported);
export function Preview() {
  const [task, setTask] = useState<string | null>(null);
  const editable = new URLSearchParams(location.search).has("editable");
  return <main style={{ maxWidth: 1160, margin: "auto", padding: "20px 20px 80px" }}>
  <aside style={{ padding: "12px 0", marginBottom: 20, borderBottom: "1px solid #d8dfe5", fontSize: 13 }}>
    <strong>Synthetic preview only.</strong> No customer data or live services. {" "}
    <a href="?evidence=sparse" style={{ textDecoration: "underline", marginRight: 16 }}>Sparse evidence</a>
    <a href="?evidence=supported" style={{ textDecoration: "underline" }}>Supported evidence</a>
  </aside>
  {task && <aside role="status" style={{ padding: 16 }}>Synthetic caller received task for Erf 42: {task}. No task is executed in this component preview.
    <button type="button" onClick={() => setTask(null)}>Return to report</button></aside>}
  <SharedInvestigationReport assembly={assembly} openingControls={editable ? { onOpenTab: (tab, options) => setTask(`${tab} / ${options?.anchorId ?? ""}`) } : undefined} />
</main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
