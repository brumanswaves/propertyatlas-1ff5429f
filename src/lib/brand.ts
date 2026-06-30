/**
 * ErfStoep brand & naming system.
 *
 * Single source of truth for product names, taglines, and short approved copy.
 * Import from here rather than hard-coding strings in screens so future
 * rebrands or copy tweaks land in one place.
 *
 * NOTE: This module is foundation-only — it does not modify any production
 * screen, route, map, parcel, or dossier behavior.
 */

// ── Official naming system ──────────────────────────────────────────────────
export const SITE_NAME = "ErfStoep" as const;
export const AI_NAME = "Stoep AI" as const;
export const AI_ACTION = "Ask Stoep" as const;
export const WORKFLOW_NAME = "StoepSteps" as const;
export const REPORTS_NAME = "Stoep Reports" as const;
export const SAVED_AREA_NAME = "My Erfs" as const;

// ── Tagline ─────────────────────────────────────────────────────────────────
export const TAGLINE = "Every erf. All the facts." as const;

// ── Approved short product copy ─────────────────────────────────────────────
export const COPY = {
  shortPitch: "Research any South African erf with AI.",
  whatItDoes:
    "Click an erf, understand the risks, run the numbers, and generate investor-ready reports.",
  paidReportsNote:
    "Paid reports improve confidence, but ErfStoep is useful before purchase.",
} as const;

// ── Convenience grouped export ──────────────────────────────────────────────
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
