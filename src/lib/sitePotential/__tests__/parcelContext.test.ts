import { describe, expect, it } from "vitest";
import { sitePotentialParcelContextFromProject } from "../parcelContext";

function projectWithFrontage(frontage: Record<string, unknown> | undefined) {
  return {
    parcel_id: "csg:lpi:test",
    metadata: {
      parcelContext: {
        parcelId: "csg:lpi:test",
        sourceLabel: "Official parcel source",
        frontage: frontage ? { source: "user_confirmed", ...frontage } : { source: "user_confirmed" },
      },
    },
  } as never;
}

describe("sitePotentialParcelContextFromProject frontage parsing", () => {
  it("keeps a null secondary frontage null", () => {
    const context = sitePotentialParcelContextFromProject(
      projectWithFrontage({ primaryEdgeIndex: 2, secondaryEdgeIndex: null }),
    );

    expect(context?.frontage).toMatchObject({ primaryEdgeIndex: 2, secondaryEdgeIndex: null });
  });

  it("keeps edge zero as a valid primary frontage", () => {
    const context = sitePotentialParcelContextFromProject(
      projectWithFrontage({ primaryEdgeIndex: 0, secondaryEdgeIndex: null }),
    );

    expect(context?.frontage).toMatchObject({ primaryEdgeIndex: 0, secondaryEdgeIndex: null });
  });

  it("does not invent primary edge zero when only a secondary edge exists", () => {
    const context = sitePotentialParcelContextFromProject(
      projectWithFrontage({ primaryEdgeIndex: null, secondaryEdgeIndex: 3 }),
    );

    expect(context?.frontage).toMatchObject({ primaryEdgeIndex: null, secondaryEdgeIndex: 3 });
  });

  it("drops a secondary frontage that duplicates the primary edge", () => {
    const context = sitePotentialParcelContextFromProject(
      projectWithFrontage({ primaryEdgeIndex: 2, secondaryEdgeIndex: 2 }),
    );

    expect(context?.frontage).toMatchObject({ primaryEdgeIndex: 2, secondaryEdgeIndex: null });
  });

  it("does not coerce missing, blank, negative, or non-integer indices to edge zero", () => {
    const missing = sitePotentialParcelContextFromProject(projectWithFrontage(undefined));
    const invalid = sitePotentialParcelContextFromProject(
      projectWithFrontage({ primaryEdgeIndex: "", secondaryEdgeIndex: -1.5 }),
    );

    expect(missing?.frontage).toBeNull();
    expect(invalid?.frontage).toBeNull();
  });
});
