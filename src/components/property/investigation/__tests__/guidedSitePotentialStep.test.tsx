import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GuidedSitePotentialStep } from "@/components/property/investigation/GuidedSitePotentialStep";
import { createEmptyErfWorkspaceState } from "@/lib/workbench/erfWorkspaceState";

const noop = vi.fn();

describe("GuidedSitePotentialStep", () => {
  it("shows the deterministic envelope action while no accepted envelope is available", () => {
    const workspace = createEmptyErfWorkspaceState();

    const html = renderToStaticMarkup(
      <GuidedSitePotentialStep
        workspaceState={workspace}
        onOpenSitePotential={noop}
        onContinue={noop}
      />,
    );

    expect(html).toContain("Confirm where a building could potentially fit");
    expect(html).toContain("No accepted build envelope yet");
    expect(html).toContain("Open Site Potential");
    expect(html).toContain("does not generate a house or architectural concept");
    expect(html).not.toContain("Concepts ready, choose one");
    expect(html).toContain("disabled");
  });

  it("does not treat legacy generation state as the Guided completion condition", () => {
    const workspace = createEmptyErfWorkspaceState();
    workspace.sitePotential.progressState = "generating";

    const html = renderToStaticMarkup(
      <GuidedSitePotentialStep
        workspaceState={workspace}
        onOpenSitePotential={noop}
        onContinue={noop}
      />,
    );

    expect(html).toContain("Confirm the site inputs");
    expect(html).toContain("No accepted build envelope yet");
    expect(html).not.toContain("Concept generation in progress");
    expect(html).not.toContain("No concepts yet");
  });
});
