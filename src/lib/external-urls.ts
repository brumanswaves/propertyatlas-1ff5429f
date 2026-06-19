// Single source of truth for external URLs we link to.
// Important: csggis.drdlr.gov.za/psv/ does not resolve reliably for users.
// Always use the Experience Builder viewer URL below for CSG.

export const CSG_VIEWER_URL =
  "https://csggis.drdlr.gov.za/portal/apps/experiencebuilder/experience/?id=a9a8f908e82c443b9cb7bede69f5985e";

/** Official CSG home — always-available fallback when a per-erf URL is not buildable. */
export const CSG_OFFICIAL_URL = "https://csg.dlrrd.gov.za/";

/** Base for SG document-list lookups (esio). */
export const SG_DOCUMENT_BASE = "https://csg.dlrrd.gov.za/esio/listdocument.jsp";

export const KOUGA_MAPPING_URL = "https://mapping-kouga.hub.arcgis.com/";
export const KOUGA_PUBLIC_MAP_URL =
  "https://experience.arcgis.com/experience/e498b2a5005a4d278eb7f32984676140/page/Main-Map";

export const LISTING_PORTALS: { id: string; label: string; url: string }[] = [
  { id: "property24",      label: "Property24",       url: "https://www.property24.com/" },
  { id: "privateproperty", label: "Private Property", url: "https://www.privateproperty.co.za/" },
  { id: "pamgolding",      label: "Pam Golding",      url: "https://www.pamgolding.co.za/" },
  { id: "seeff",           label: "Seeff",            url: "https://www.seeff.com/" },
  { id: "remax",           label: "RE/MAX",           url: "https://www.remax.co.za/" },
  { id: "rawson",          label: "Rawson",           url: "https://www.rawson.co.za/" },
];
