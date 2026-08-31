export const PRIMARY_NAV_LINKS = [
  { to: "/", label: "Find a Property" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/pricing", label: "R999 Review" },
] as const;

export const SIGNED_IN_NAV_LINKS = [
  { to: "/dashboard", label: "My Investigations" },
  { to: "/orders", label: "My Reports" },
  { to: "/profile", label: "Account" },
] as const;

export const FOOTER_PRODUCT_LINKS = [
  { to: "/", label: "Find a Property" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/pricing", label: "Pricing" },
  { to: "/dashboard", label: "My Investigations" },
  { to: "/orders", label: "My Reports" },
] as const;

export const FOOTER_RESOURCE_LINKS = [
  { to: "/faq", label: "FAQ" },
  { to: "/data-sources", label: "Data Sources" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export const FOOTER_LEGAL_LINKS = [
  { to: "/terms", label: "Terms of Use" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/disclaimer", label: "Disclaimer" },
] as const;

export const MAP_FOOTER_LINKS = [
  { to: "/how-it-works", label: "How It Works" },
  { to: "/pricing", label: "Pricing" },
  { to: "/data-sources", label: "Data Sources" },
  { to: "/privacy", label: "Privacy" },
  { to: "/disclaimer", label: "Disclaimer" },
] as const;

/**
 * Routes intentionally excluded from primary navigation.
 * Some remain addressable while content is consolidated or retained for
 * search/deep links, but they must not grow the global navigation again.
 */
export const SECONDARY_OR_LEGACY_PUBLIC_ROUTES = [
  "/features",
  "/for-investors",
  "/for-homeowners",
  "/for-developers",
  "/roadmap",
  "/partnerships",
  "/reports",
  "/subscriptions",
  "/why",
] as const;
