import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GuidedSitePotentialStep } from "@/components/property/investigation/GuidedSitePotentialStep";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";

const noop = vi.fn();

describe("GuidedSitePotentialStep", () => {
  it("shows canonical concepts-ready state even when generated asset count is not yet available", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.sitePotential.progressState = "concepts_ready";
    workspace.sitePotential.conceptCount = 0;

    const html = renderToStaticMarkup(
      <GuidedSitePotentialStep
        workspaceState={workspace}
        onOpenSitePotential={noop}
        onContinue={noop}
      />,
    );

    expect(html).toContain("Concepts ready, choose one");
    expect(html).toContain("Concepts have been generated, but none is selected yet.");
    expect(html).not.toContain("No concepts yet");
    expect(html).toContain("disabled");
  });

  it("does not call an active generation state no concepts", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.sitePotential.progressState = "generating";

    const html = renderToStaticMarkup(
      <GuidedSitePotentialStep
        workspaceState={workspace}
        onOpenSitePotential={noop}
        onContinue={noop}
      />,
    );

    expect(html).toContain("Concept generation in progress");
    expect(html).not.toContain("No concepts yet");
  });
});
