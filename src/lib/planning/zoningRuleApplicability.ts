import type { ZoningRule } from "./municipalityPlanningTypes";

export interface ZoningRuleErfAreaApplicability {
  minExclusiveM2?: number;
  maxExclusiveM2?: number;
}

export type ZoningRuleWithApplicability = ZoningRule & {
  applicability?: {
    erfAreaM2?: ZoningRuleErfAreaApplicability;
  };
};

function appliesToErfArea(rule: ZoningRuleWithApplicability, erfAreaM2: number | null): boolean {
  const areaRule = rule.applicability?.erfAreaM2;
  if (!areaRule) return true;
  if (erfAreaM2 == null) return false;
  if (areaRule.minExclusiveM2 != null && erfAreaM2 <= areaRule.minExclusiveM2) return false;
  if (areaRule.maxExclusiveM2 != null && erfAreaM2 >= areaRule.maxExclusiveM2) return false;
  return true;
}

/**
 * Returns only the published controls whose explicit parcel-area condition is
 * satisfied. Area-conditioned controls are withheld when parcel area is unknown
 * or falls exactly on an unresolved open boundary such as the scheme's <400 / >400 split.
 */
export function zoningRulesForErfArea(rules: ZoningRule[], erfAreaM2: number | null): ZoningRule[] {
  return rules.filter((rule) => appliesToErfArea(rule as ZoningRuleWithApplicability, erfAreaM2));
}
