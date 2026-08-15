/**
 * Easy Erf brand and naming system.
 *
 * Single source of truth for product names, taglines, and short approved copy.
 * Import from here rather than hard-coding strings in screens so terminology
 * stays coherent as the product evolves.
 */

export const SITE_NAME = "Easy Erf" as const;
export const AI_NAME = "Easy Erf AI" as const;
export const AI_ACTION = "Ask Easy Erf" as const;
export const WORKFLOW_NAME = "Guided Investigation" as const;
export const REPORTS_NAME = "Easy Erf Report" as const;
export const SAVED_AREA_NAME = "My Investigations" as const;

export const TAGLINE = "Every erf. All the facts." as const;

export const COPY = {
  shortPitch:
    "Investigate South African property with evidence, calculations, and clear next steps.",
  whatItDoes:
    "Find an erf, see what is known and unknown, investigate the evidence, run the numbers, explore Site Potential, and build a living Easy Erf Report.",
  paidReportsNote:
    "Paid reports can strengthen the evidence when needed, but they are optional and Easy Erf remains useful before purchase.",
  pilotNote:
    "Coverage and source availability vary by municipality. Easy Erf labels verified evidence, working conclusions, assumptions, and missing information separately.",
} as const;

export const BRAND = {
  site: SITE_NAME,
  ai: AI_NAME,
  aiAction: AI_ACTION,
  workflow: WORKFLOW_NAME,
  reports: REPORTS_NAME,
  savedArea: SAVED_AREA_NAME,
  tagline: TAGLINE,
  copy: COPY,
} as const;

export type BrandNames = typeof BRAND;
