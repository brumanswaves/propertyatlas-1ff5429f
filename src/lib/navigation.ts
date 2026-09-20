export const PRIMARY_NAV_LINKS = [
  { to: "/", label: "Find a Property" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/pricing", label: "Done for You" },
] as const;

export const SIGNED_IN_NAV_LINKS = [
  { to: "/dashboard", label: "My Properties" },
  { to: "/profile", label: "Account" },
] as const;

export function staffNavigation(role: "founder" | "investigator" | "customer" | null) {
  if (role === "founder") return [
    { to: "/admin", label: "Founder Dashboard" },
    { to: "/investigator", label: "Investigator Dashboard" },
  ] as const;
  return role === "investigator" ? [{ to: "/investigator", label: "Investigator Dashboard" }] as const : [];
}

export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") ||
      [...value].some(char => char === "\\" || char.charCodeAt(0) <= 32)) return null;
  const url = new URL(value, "https://easyerf.invalid");
  if (url.origin !== "https://easyerf.invalid" || url.pathname === "/auth") return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Confirmation and OAuth must return through auth before the selected journey. */
export function authCallbackUrl(origin: string, destination: unknown): string {
  const redirect = safeReturnPath(destination);
  return `${origin}/auth${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`;
}

export const FOOTER_PRODUCT_LINKS = [
  { to: "/", label: "Find a Property" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/pricing", label: "Done-for-You Investigation" },
  { to: "/dashboard", label: "My Properties" },
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
  { to: "/pricing", label: "Done for You" },
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
