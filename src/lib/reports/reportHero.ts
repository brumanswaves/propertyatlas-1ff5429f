/**
 * Deterministic hero selection for the Easy Erf Report.
 *
 * The report never invents imagery. It picks the strongest visual it can
 * actually source, in a fixed priority order, and always says what the visual
 * is so a reader cannot mistake an interpretation for a photograph.
 */

export type ReportHeroKind =
  | "site_potential"
  | "parcel_overview"
  | "photograph"
  | "neutral_card";

export interface ReportHeroInput {
  /** A saved AI concept or a deterministic build-envelope visual exists. */
  hasSitePotentialVisual: boolean;
  /** The site potential visual is the deterministic build envelope, not AI. */
  sitePotentialVisualIsDeterministic?: boolean;
  /** Real parcel geometry is available, so a parcel overview can be drawn. */
  hasParcelGeometry: boolean;
  /** A user-supplied property photograph with confirmed usage rights exists. */
  hasPropertyPhotograph: boolean;
}

export interface ReportHeroSelection {
  kind: ReportHeroKind;
  caption: string;
}

export function selectReportHero(input: ReportHeroInput): ReportHeroSelection {
  if (input.hasSitePotentialVisual) {
    return {
      kind: "site_potential",
      caption: input.sitePotentialVisualIsDeterministic
        ? "Build envelope calculated from official parcel geometry and the planning rules recorded for this erf. Theoretical, not an approved plan."
        : "AI-generated concept visualisation saved to this erf. It is an interpretation, not a photograph or approved plan.",
    };
  }
  if (input.hasParcelGeometry) {
    return {
      kind: "parcel_overview",
      caption:
        "Parcel outline drawn from official cadastral geometry. Boundary position is indicative and not a survey.",
    };
  }
  if (input.hasPropertyPhotograph) {
    return {
      kind: "photograph",
      caption: "Photograph supplied for this erf. Easy Erf has not independently verified it.",
    };
  }
  return {
    kind: "neutral_card",
    caption:
      "No verified photograph or parcel image is available for this erf yet. Easy Erf does not display imagery it cannot source.",
  };
}
