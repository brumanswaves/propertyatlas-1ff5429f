import { KOUGA_LOCAL_PHRASES, VACANT_LAND_TERMS } from "./constants";
import { isKougaOrStFrancisContext } from "./resolveMarketEvidenceContext";
import type { MarketEvidenceContext, SearchLadderItem } from "./types";

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pushUnique(items: SearchLadderItem[], item: Omit<SearchLadderItem, "id">) {
  if (!item.phrase.trim()) return;
  const id = `${item.level}-${slug(item.label)}-${slug(item.phrase)}`;
  if (items.some((existing) => existing.id === id || existing.phrase === item.phrase)) return;
  items.push({ ...item, id });
}

function area(ctx: MarketEvidenceContext): string {
  return ctx.suburb ?? ctx.town ?? ctx.municipality ?? "";
}

export function buildSearchLadder(ctx: MarketEvidenceContext): SearchLadderItem[] {
  const items: SearchLadderItem[] = [];
  const province = ctx.province ? ` ${ctx.province}` : "";
  const areaName = area(ctx);
  const erf = ctx.erfNumber ? `Erf ${ctx.erfNumber}` : "";

  if (ctx.category === "sectional_title" && (ctx.schemeOrEstate || ctx.address || ctx.streetName)) {
    pushUnique(items, {
      level: 0,
      label: "Scheme or complex",
      phrase: [ctx.schemeOrEstate, ctx.address, ctx.streetName, areaName, ctx.province]
        .filter(Boolean)
        .join(" "),
      helper:
        "Sectional-title schemes can sit on a parent erf; prefer scheme, address and street before parent erf.",
      confidence: "medium",
      relationshipSuggestion: "possible_target_asset",
    });
  }

  if (erf && areaName) {
    pushUnique(items, {
      level: 1,
      label: "Exact property",
      phrase: `${erf} ${areaName}`,
      helper: "Exact erf searches are useful, but often return nothing on public portals.",
      confidence: "high",
      relationshipSuggestion: "possible_target_asset",
    });
  }
  if (erf && ctx.streetName) {
    pushUnique(items, {
      level: 1,
      label: "Exact erf and street",
      phrase: `${erf} ${ctx.streetName}`,
      helper: "Use this when agents mention the erf or road name but hide the street number.",
      confidence: "high",
      relationshipSuggestion: "possible_target_asset",
    });
  }
  if (ctx.address && areaName) {
    pushUnique(items, {
      level: 2,
      label: "Address",
      phrase: `${ctx.address} ${areaName}`,
      helper: "Highest confidence only if the listing visibly matches the address or imagery.",
      confidence: "high",
      relationshipSuggestion: "target_asset",
    });
  }
  if (ctx.streetName && areaName) {
    pushUnique(items, {
      level: 3,
      label: "Street",
      phrase: `${ctx.streetName} ${areaName}`,
      helper: "Street-level searches help when agents hide street numbers.",
      confidence: "medium",
      relationshipSuggestion: "same_street_comp",
    });
  }
  if (areaName) {
    pushUnique(items, {
      level: 4,
      label: "Micro-market",
      phrase: `${areaName} property for sale${province}`,
      helper: "Use suburb or town to find active comparables before narrowing.",
      confidence: "medium",
      relationshipSuggestion: "same_suburb_comp",
    });
  }
  for (const term of VACANT_LAND_TERMS) {
    if (!areaName) continue;
    pushUnique(items, {
      level: 5,
      label: "Vacant land / plot / stand",
      phrase: `${areaName} ${term} for sale${province}`,
      helper: "Use vacant-land terms for plots, stands, undeveloped land and erf comparables.",
      confidence: "medium",
      relationshipSuggestion: "vacant_land_comp",
    });
  }
  if (isKougaOrStFrancisContext(ctx)) {
    KOUGA_LOCAL_PHRASES.forEach((phrase, index) => {
      pushUnique(items, {
        level: index < 4 ? 4 : index < 8 ? 6 : 7,
        label: index < 4 ? "Micro-market" : index < 8 ? "Nearby market" : "Broad comparable",
        phrase,
        helper: "Kouga/St Francis local-market fallback. Verify locality manually.",
        confidence: index < 4 ? "medium" : "low",
        relationshipSuggestion: index < 4 ? "same_node_comp" : "broader_market_comp",
      });
    });
  } else if (ctx.town || ctx.municipality || ctx.province) {
    pushUnique(items, {
      level: 6,
      label: "Nearby market",
      phrase: `${ctx.town ?? ctx.municipality ?? ctx.province} property for sale`,
      helper: "Fallback when suburb-level context is missing.",
      confidence: "low",
      relationshipSuggestion: "broader_market_comp",
    });
    pushUnique(items, {
      level: 7,
      label: "Broad comparable",
      phrase: `${ctx.province ?? "South Africa"} coastal property for sale`,
      helper: "Broad comparable only. Do not treat results as the target asset.",
      confidence: "low",
      relationshipSuggestion: "weak_comp",
    });
  }
  if (ctx.category === "farm_smallholding") {
    pushUnique(items, {
      level: 8,
      label: "Farm / smallholding",
      phrase: [
        ctx.farmNumber,
        ctx.portion && `Portion ${ctx.portion}`,
        ctx.district,
        "smallholding farm agricultural property",
      ]
        .filter(Boolean)
        .join(" "),
      helper:
        "Farm evidence should prioritize farm number, portion, district and agricultural terms.",
      confidence: "medium",
      relationshipSuggestion: "same_node_comp",
    });
  }
  if (ctx.category === "estate_complex" && ctx.schemeOrEstate) {
    pushUnique(items, {
      level: 9,
      label: "Estate / complex",
      phrase: `${ctx.schemeOrEstate} ${areaName}`,
      helper: "Estate or complex searches can outperform official erf searches.",
      confidence: "medium",
      relationshipSuggestion: "same_node_comp",
    });
  }

  return items.sort((a, b) => a.level - b.level || a.label.localeCompare(b.label));
}
