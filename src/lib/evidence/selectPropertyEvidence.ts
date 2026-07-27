import type {
  EvidenceClaim,
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

  const scoredClaims = pack.claims
    .filter((claim) => claim.parcelId === pack.parcelId)
    .filter((claim) => !requestedDomains.size || requestedDomains.has(claim.domain))
    .map((claim) => ({ claim, score: scoreClaim(claim, tokens, requestedDomains) }))
    .filter((item) => item.score > 0 || requestedDomains.has(item.claim.domain))
    .sort((a, b) => b.score - a.score || a.claim.id.localeCompare(b.claim.id));

  const claims = scoredClaims.slice(0, maxClaims).map((item) => item.claim);
  const relatedSourceIds = new Set(claims.flatMap((claim) => claim.sourceIds));
  const relatedContradictions = pack.contradictions.filter(
    (item) =>
      item.parcelId === pack.parcelId &&
      (!requestedDomains.size ||
        item.claimIds.some((id) => claims.some((claim) => claim.id === id)) ||
        tokensOverlap(tokens, item.title, item.explanation)),
  );
  const relatedGaps = pack.gaps.filter(
    (gap) =>
      gap.parcelId === pack.parcelId &&
      (!requestedDomains.size || requestedDomains.has(gap.domain) || tokensOverlap(tokens, gap.title, gap.explanation)),
  );
  for (const item of relatedContradictions) item.sourceIds.forEach((id) => relatedSourceIds.add(id));

  const sources = pack.sources
    .filter((source) => source.parcelId === pack.parcelId)
    .filter((source) => relatedSourceIds.has(source.id) || tokensOverlap(tokens, source.label, source.fragments.join(" ")))
    .map((source) => ({ source, score: scoreSource(source, tokens, relatedSourceIds) }))
    .sort((a, b) => b.score - a.score || a.source.id.localeCompare(b.source.id))
    .map((item) => limitSourceFragments(item.source, maxFragments));

  const { text, truncated } = renderSelectionText(
    claims,
    sources,
    relatedContradictions,
    relatedGaps,
    maxCharacters,
  );
  return {
    parcelId: pack.parcelId,
    claims,
    sources,
    contradictions: relatedContradictions,
    gaps: relatedGaps,
    text,
    truncated,
  };
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

function limitSourceFragments(
  source: EvidenceSourceReference,
  maxFragments: number,
): EvidenceSourceReference {
  return {
    ...source,
    fragments: source.fragments.slice(0, maxFragments),
  };
}

function renderSelectionText(
  claims: EvidenceClaim[],
  sources: EvidenceSourceReference[],
  contradictions: SelectedPropertyEvidence["contradictions"],
  gaps: SelectedPropertyEvidence["gaps"],
  maxCharacters: number,
) {
  const parts = [
    "Claims",
    ...claims.map(
      (claim) =>
        `- [${claim.domain}/${claim.nature}/${claim.status}] ${claim.label}: ${claim.value ?? "Missing"} (${claim.confidence}; ${claim.confidenceReason})`,
    ),
    "Contradictions",
    ...contradictions.map((item) => `- [${item.severity}] ${item.title}: ${item.explanation}`),
    "Gaps",
    ...gaps.map((gap) => `- [${gap.importance}] ${gap.title}: ${gap.nextAction}`),
    "Source fragments",
    ...sources.flatMap((source) =>
      source.fragments.map((fragment) => `- ${source.label}: ${fragment}`),
    ),
  ];
  const text = parts.join("\n");
  return {
    text: text.length > maxCharacters ? text.slice(0, maxCharacters) : text,
    truncated: text.length > maxCharacters,
  };
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
  return !tokens.size || overlapCount(tokens, ...values) > 0;
}
