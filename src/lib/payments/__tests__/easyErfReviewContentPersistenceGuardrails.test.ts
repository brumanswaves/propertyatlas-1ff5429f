import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS,
  DONE_FOR_YOU_STANDARD_INVESTIGATION_ITEMS,
} from "@/lib/humanReview/scope";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const founderContent = source("supabase/functions/easy-erf-founder-review-content/index.ts");

describe("Easy Erf founder review-content persistence", () => {
  it("preserves existing structured fields when saving either report or checklist state", () => {
    expect(founderContent.match(/\.\.\.existingContent/g)).toHaveLength(2);
    expect(founderContent).toContain("investigationChecklist: checklistValidation.checklist");
    expect(founderContent).toContain("...reportValidation.content");
    expect(founderContent).not.toContain("checklistNotes");
  });

  it("allows content edits only while the investigation is actively in progress", () => {
    expect(founderContent).toContain('if (!["fulfilling", "processing"].includes(status))');
    expect(founderContent).toContain(
      "Start or reopen the investigation before editing the report or checklist.",
    );
    expect(founderContent).not.toContain(
      '["paid", "fulfilling", "processing", "complete", "ready"]',
    );
    expect(founderContent.indexOf('["fulfilling", "processing"]')).toBeLessThan(
      founderContent.indexOf('.update({\n      review_content: nextContent'),
    );
  });

  it("distinguishes report preparation from the customer delivery promise", () => {
    const reportChecklistItem = DONE_FOR_YOU_INVESTIGATION_CHECKLIST_ITEMS.find(
      (item) => item.id === "reviewed_report",
    );
    expect(reportChecklistItem?.label).toContain("Prepare the Human-Reviewed Easy Erf Report");
    expect(DONE_FOR_YOU_STANDARD_INVESTIGATION_ITEMS.at(-1)).toContain(
      "Deliver a Human-Reviewed Easy Erf Report",
    );
  });
});
