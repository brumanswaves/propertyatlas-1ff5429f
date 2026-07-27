import type {
  EvidenceClaim,
  EvidenceContradiction,
  EvidenceGap,
  EvidenceSelectionRequest,
  EvidenceSourceReference,
  PropertyEvidencePack,
  SelectedPropertyEvidence,
} from "./propertyEvidenceTypes";

const DEFAULT_MAX_CLAIMS = 12;
const DEFAULT_MAX_FRAGMENTS = 8;
const DEFAULT_MAX_CHARS = 4_000;

export function selectPropertyEvidence(
  pack: PropertyEvidencePack,
  request: EvidenceSelectionRequest = {},
): SelectedPropertyEvidence {
  const tokens = tokenize(request.question ?? "");
  const requestedDomains = new Set(request.domains ?? []);
  const maxClaims = request.maxClaims ?? DEFAULT_MAX_CLAIMS;
  const maxFragments = request.maxSourceFragments ?? DEFAULT_MAX_FRAGMENTS;
  const maxCharacters = request.maxTotalCharacters ?? DEFAULT_MAX_CHARS;

  const selectedClaims: EvidenceClaim[] = [];
  const selectedClaimIds = new Set<string>();
  const selectedSourceIds = new Set<string>();
  const selectedContradictions: EvidenceContradiction[] = [];
  const selectedGaps: EvidenceGap[] = [];
  const selectedSources = new Map<string, EvidenceSourceReference>();
  const lines: string[] = [];
  let usedCharacters = 0;
  let usedFragments = 0;
  let truncated = false;

  const appendLine = (line: string) => {
    const nextLength = usedCharacters + (lines.length ? 1 : 0) + line.length;
    if (nextLength > maxCharacters) {
      truncated = true;
      return false;
    }
    lines.push(line);
    usedCharacters = nextLength;
    return true;
  };

  appendLine("Claims");
  for (const { claim } of scoreClaims(pack, tokens, requestedDomains)) {
    if (selectedClaims.length >= maxClaims) break;
    const line = renderClaim(claim);
    if (!appendLine(line)) break;
    selectedClaims.push(claim);
    selectedClaimIds.add(claim.id);
    claim.sourceIds.forEach((id) => selectedSourceIds.add(id));
  }

  const contradictionPool = scoreContradictions(pack, tokens, requestedDomains, selectedClaimIds);
  appendLine("Contradictions");
  for (const contradiction of contradictionPool) {
    const line = renderContradiction(contradiction);
    if (!appendLine(line)) break;
    selectedContradictions.push(contradiction);
    contradiction.sourceIds.forEach((id) => selectedSourceIds.add(id));
  }

  const gapPool = scoreGaps(pack, tokens, requestedDomains, selectedClaimIds);
  appendLine("Gaps");
  for (const gap of gapPool) {
    const line = renderGap(gap);
    if (!appendLine(line)) break;
    selectedGaps.push(gap);
  }

  const sourcePool = scoreSources(pack, tokens, selectedSourceIds);
  appendLine("Source references");
  for (const source of sourcePool) {
    const sourceWasReferenced = selectedSourceIds.has(source.id);
    if (sourceWasReferenced && !source.fragments.length) {
      const line = `- ${source.label} (${source.authorityType}; ${source.status})`;
      if (appendLine(line)) selectedSources.set(source.id, { ...source, fragments: [] });
      continue;
    }
    if (usedFragments >= maxFragments) break;
    const fragments: string[] = [];
    for (const fragment of source.fragments) {
      if (usedFragments >= maxFragments) break;
      const line = renderFragment(source, fragment);
      if (!appendLine(line)) {
        usedFragments = maxFragments;
        break;
      }
      fragments.push(fragment);
      usedFragments += 1;
    }
    if (fragments.length) {
      selectedSources.set(source.id, { ...source, fragments });
    }
  }

  return {
    parcelId: pack.parcelId,
    claims: selectedClaims,
    sources: Array.from(selectedSources.values()).sort((a, b) => a.id.localeCompare(b.id)),
    contradictions: selectedContradictions,
    gaps: selectedGaps,
    text: lines.join("\n"),
    truncated,
  };
}

function scoreClaims(
  pack: PropertyEvidencePack,
  tokens: Set<string>,
  requestedDomains: Set<string>,
) {
  return pack.claims
    .filter((claim) => claim.parcelId === pack.parcelId)
    .filter((claim) => !requestedDomains.size || requestedDomains.has(claim.domain))
    .map((claim) => ({ claim, score: scoreClaim(claim, tokens, requestedDomains) }))
    .filter((item) => item.score > 0 || requestedDomains.has(item.claim.domain) || !tokens.size)
    .sort((a, b) => b.score - a.score || a.claim.id.localeCompare(b.claim.id));
}

function scoreContradictions(
  pack: PropertyEvidencePack,
  tokens: Set<string>,
  requestedDomains: Set<string>,
  selectedClaimIds: Set<string>,
) {
  return pack.contradictions
    .filter((item) => item.parcelId === pack.parcelId)
    .map((item) => ({
      item,
      score: scoreContradiction(item, tokens, requestedDomains, selectedClaimIds, pack.claims),
    }))
    .filter(({ score }) => score > 0 || !tokens.size)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .map(({ item }) => item);
}

function scoreGaps(
  pack: PropertyEvidencePack,
  tokens: Set<string>,
  requestedDomains: Set<string>,
  selectedClaimIds: Set<string>,
) {
  return pack.gaps
    .filter((gap) => gap.parcelId === pack.parcelId)
    .map((gap) => ({
      gap,
      score: scoreGap(gap, tokens, requestedDomains, selectedClaimIds),
    }))
    .filter(({ score }) => score > 0 || !tokens.size)
    .sort((a, b) => b.score - a.score || a.gap.id.localeCompare(b.gap.id))
    .map(({ gap }) => gap);
}

function scoreSources(
  pack: PropertyEvidencePack,
  tokens: Set<string>,
  selectedSourceIds: Set<string>,
) {
  return pack.sources
    .filter((source) => source.parcelId === pack.parcelId)
    .filter((source) => selectedSourceIds.has(source.id) || tokensOverlap(tokens, source.label, source.fragments.join(" ")))
    .map((source) => ({ source, score: scoreSource(source, tokens, selectedSourceIds) }))
    .sort((a, b) => b.score - a.score || a.source.id.localeCompare(b.source.id))
    .map(({ source }) => source);
}

function scoreClaim(
  claim: EvidenceClaim,
  tokens: Set<string>,
  requestedDomains: Set<string>,
) {
  let score = requestedDomains.has(claim.domain) ? 20 : 0;
  score += claim.status === "supported" ? 8 : claim.status === "conflicting" ? 7 : claim.status === "missing" ? 6 : 3;
  score += claim.confidence === "high" ? 5 : claim.confidence === "medium" ? 3 : 1;
  score += claim.nature === "fact" ? 4 : claim.nature === "calculation" ? 3 : claim.nature === "assumption" ? 2 : 1;
  if (claim.sourceIds.some((id) => /official|parcel/i.test(id))) score += 5;
  score += overlapCount(tokens, claim.domain, claim.key, claim.label, String(claim.value ?? ""), claim.notes ?? "", claim.warning ?? "") * 6;
  return score;
}

function scoreContradiction(
  contradiction: EvidenceContradiction,
  tokens: Set<string>,
  requestedDomains: Set<string>,
  selectedClaimIds: Set<string>,
  claims: EvidenceClaim[],
) {
  let score = 0;
  if (contradiction.claimIds.some((id) => selectedClaimIds.has(id))) score += 30;
  if (tokensOverlap(tokens, contradiction.title, contradiction.explanation, ...contradiction.displayedValues)) score += 20;
  if (requestedDomains.size) {
    const domains = new Set(
      claims.filter((claim) => contradiction.claimIds.includes(claim.id)).map((claim) => claim.domain),
    );
    if ([...domains].some((domain) => requestedDomains.has(domain))) score += 16;
  }
  if (score > 0 || !tokens.size) {
    score += contradiction.severity === "high" ? 8 : contradiction.severity === "medium" ? 5 : 2;
  }
  return score;
}

function scoreGap(
  gap: EvidenceGap,
  tokens: Set<string>,
  requestedDomains: Set<string>,
  selectedClaimIds: Set<string>,
) {
  let score = requestedDomains.has(gap.domain) ? 20 : 0;
  if (tokensOverlap(tokens, gap.domain, gap.title, gap.explanation, gap.basis, gap.nextAction)) score += 18;
  if (!tokens.size && selectedClaimIds.size === 0) score += 6;
  if (score > 0 || !tokens.size) {
    score += gap.importance === "high" ? 8 : gap.importance === "medium" ? 5 : 2;
    if (gap.blocking) score += 4;
  }
  return score;
}

function scoreSource(
  source: EvidenceSourceReference,
  tokens: Set<string>,
  relatedSourceIds: Set<string>,
) {
  let score = relatedSourceIds.has(source.id) ? 20 : 0;
  score += source.authorityType === "official" ? 8 : source.authorityType === "municipal" ? 6 : source.authorityType === "calculation" ? 5 : 1;
  score += source.sourceQuality === "direct" ? 5 : source.sourceQuality === "strong" ? 4 : 1;
  score += overlapCount(tokens, source.label, source.sourcePortal ?? "", source.fragments.join(" ")) * 4;
  return score;
}

function renderClaim(claim: EvidenceClaim) {
  return `- [${claim.domain}/${claim.nature}/${claim.status}/${claim.confidence}] ${claim.label}: ${claim.value ?? "Missing"}`;
}

function renderContradiction(item: EvidenceContradiction) {
  return `- [${item.severity}] ${item.title}: ${item.explanation}`;
}

function renderGap(gap: EvidenceGap) {
  return `- [${gap.importance}] ${gap.title}: ${gap.nextAction}`;
}

function renderFragment(source: EvidenceSourceReference, fragment: string) {
  return `- ${source.label}: ${fragment}`;
}

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2),
  );
}

function overlapCount(tokens: Set<string>, ...values: string[]) {
  if (!tokens.size) return 0;
  const haystack = tokenize(values.join(" "));
  let count = 0;
  for (const token of tokens) if (haystack.has(token)) count += 1;
  return count;
}

function tokensOverlap(tokens: Set<string>, ...values: string[]) {
  return tokens.size > 0 && overlapCount(tokens, ...values) > 0;
}
