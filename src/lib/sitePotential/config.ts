export const SITE_POTENTIAL_PACK_SIZE = 3;
export const SITE_POTENTIAL_PRICE_CENTS = 9_980;
export const SITE_POTENTIAL_CURRENCY = "ZAR";
export const SITE_POTENTIAL_DISCLAIMER =
  "AI-generated concept visualisation. Not an architectural plan, municipal approval, quotation or representation of what may legally be built.";
export const SITE_POTENTIAL_DEFAULT_IMAGE_MODEL = "gpt-image-2";
export const SITE_POTENTIAL_DEFAULT_IMAGE_SIZE = "1536x1024";
export const SITE_POTENTIAL_DEFAULT_IMAGE_QUALITY = "medium";

export const SITE_POTENTIAL_FREE_LIMITS = {
  rolling24Hours: 1,
  rolling7Days: 3,
  rolling30Days: 6,
  sameParcelRolling30Days: 1,
} as const;

export const SITE_POTENTIAL_CREDIT_PACKS = [
  { credits: 5, priceCents: 49_900, label: "Starter" },
  { credits: 10, priceCents: 89_900, label: "Agent" },
  { credits: 25, priceCents: 199_900, label: "Professional" },
] as const;
