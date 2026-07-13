import { SAFE_PORTALS } from "./constants";
import type {
  MarketEvidenceContext,
  MarketEvidencePortalAction,
  PortalActionGroup,
  SearchLadderItem,
} from "./types";

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function preferredPhrase(ladder: SearchLadderItem[]): string {
  return (
    ladder.find((item) => item.relationshipSuggestion === "same_suburb_comp")?.phrase ??
    ladder.find((item) => item.level >= 4)?.phrase ??
    ladder[0]?.phrase ??
    ""
  );
}

function portalTitle(portal: string, group: PortalActionGroup) {
  if (group === "vacant_land_portals") return `${portal} vacant land search`;
  if (group === "local_agencies") return `${portal} local agency check`;
  if (group === "farm_smallholding") return `${portal} farm/smallholding check`;
  return `${portal} market evidence search`;
}

export function buildPortalActions(
  ctx: MarketEvidenceContext,
  ladder: SearchLadderItem[],
): MarketEvidencePortalAction[] {
  const basePhrase = preferredPhrase(ladder);
  const vacantPhrase =
    ladder.find((item) => item.relationshipSuggestion === "vacant_land_comp")?.phrase ?? basePhrase;
  const farmPhrase =
    ladder.find((item) => item.relationshipSuggestion === "same_node_comp")?.phrase ?? basePhrase;
  const actions: MarketEvidencePortalAction[] = SAFE_PORTALS.map((portal, index) => {
    let group = portal.group;
    let searchPhrase = basePhrase;
    if (ctx.category === "vacant_land" && index < 2) {
      group = "vacant_land_portals";
      searchPhrase = vacantPhrase;
    }
    if (ctx.category === "farm_smallholding") {
      group = index < 2 ? "farm_smallholding" : portal.group;
      searchPhrase = index < 2 ? farmPhrase : basePhrase;
    }

    return {
      id: `${portal.id}-${slug(searchPhrase || "manual")}`,
      portal: portal.portal,
      title: portalTitle(portal.portal, group),
      description:
        "Open the portal, paste the phrase, then save only evidence you manually verify.",
      url: portal.url,
      searchPhrase,
      confidence: index < 2 ? "medium" : "low",
      actionType: "open_portal",
      group,
      opensReliableAreaPage: false,
      requiresManualPaste: true,
      helperText:
        "Easy Erf is not reading this portal. You choose and save only useful evidence.",
    };
  });

  if (ctx.suburb || ctx.town || ctx.municipality) {
    actions.push({
      id: `local-agency-${slug(basePhrase || "manual")}`,
      portal: "Local agency search",
      title: "Local agency searches",
      description: "Use the local area phrase to check smaller St Francis/Kouga agencies.",
      url: "https://www.google.com/search",
      searchPhrase: `${basePhrase} local estate agency`,
      confidence: "low",
      actionType: "manual_search",
      group: "local_agencies",
      opensReliableAreaPage: false,
      requiresManualPaste: true,
      helperText: "Deep fallback only. Verify source, date, address and relationship manually.",
    });
  }

  actions.push({
    id: `deep-web-${slug(basePhrase || "manual")}`,
    portal: "Google deep web fallback",
    title: "Manual deep web fallback",
    description: "Use only after portal and agency checks. Results can be unrelated.",
    url: `https://www.google.com/search?q=${encodeURIComponent(basePhrase)}`,
    searchPhrase: basePhrase,
    confidence: "low",
    actionType: "manual_search",
    group: "manual_fallback",
    opensReliableAreaPage: false,
    requiresManualPaste: false,
    helperText: "Google is a fallback, not the primary market-evidence workflow.",
  });

  return actions;
}
