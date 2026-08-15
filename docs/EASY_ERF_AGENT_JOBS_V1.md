# Easy Erf Agent Jobs V1

Status: implementation architecture for the first autonomous Easy Erf investigation job.

## Product direction

Easy Erf remains a South Africa-specific property intelligence and due-diligence platform. The product is evolving from a set of property tools toward an autonomous property-investigation workforce.

Users should assign understandable property jobs. They should not need to understand internal agent architecture.

The target feeling is simple:

> Easy Erf investigated this for me.

This document does not create agent personalities. A worker is a real, auditable job that performs useful property-investigation work.

## Easy Erf Agent Job Contract V1

Every real job uses the same conceptual contract:

1. **Goal**: the exact property question the job is answering.
2. **Inputs**: canonical parcel identifiers and explicit user inputs needed for the job.
3. **Context / Memory**: relevant canonical Easy Erf state and the current property evidence graph.
4. **Tools**: only tools actually available to the job, such as canonical state, reviewed municipal registries, official sources, uploaded documents, deterministic engines and approved AI models.
5. **Process**: machine-readable steps showing what the job actually did, skipped or could not do.
6. **Evidence**: source-linked material supporting the important findings.
7. **Confidence**: high, medium, low or unverified.
8. **Actions**: state changes or outputs that were applied, proposed or withheld.
9. **Approval Rules**: explicit boundaries where Easy Erf must not promote a conclusion without user confirmation.
10. **Output**: a structured result, not only prose.
11. **Next Job**: the highest-value unresolved investigation, when one exists.

The TypeScript contract is defined in `src/lib/investigation/agentJobContract.ts`.

## Planning Investigation Job V1

### Goal

**Investigate this property's planning position.**

### Inputs

- canonical Easy Erf parcel id
- erf number and portion when known
- LPI and parcel key when known
- municipality, province and location context
- canonical `ParcelPlanningAssessment`
- current property evidence pack when available

### Existing systems reused

Planning Investigation V1 intentionally reuses rather than replaces:

- `NormalizedOfficialParcel`
- `ParcelPlanningAssessment`
- Kouga planning registry and municipality planning registry model
- planning evidence signals
- uploaded zoning-document extraction and property-identity gates
- `PropertyEvidencePack`
- evidence claims, source references, contradictions and gaps
- existing user confirmation for a working zone
- the existing Guided Investigation, Dossier and Report planning surfaces

### Process

The V1 job performs these steps deterministically from the available Easy Erf state:

1. uses the canonical property identity
2. inspects the current planning assessment
3. inspects the property evidence graph when present
4. classifies configured planning sources by jurisdiction and publication status
5. retains published scheme rules as general rules, never parcel-specific rights
6. correlates the current zoning evidence or working conclusion to the parcel
7. detects recorded planning contradictions
8. preserves missing evidence
9. assigns planning confidence
10. produces a structured output and one next investigation
11. propagates through shared canonical state rather than creating a duplicate agent store

### Structured output

The job returns:

- zoning code and name when available
- zoning detection method
- source-linked findings
- published planning rules
- verified property-specific rights when evidence supports them
- contradictions
- unresolved evidence
- source counts and source quality
- confidence
- headline warning
- next investigation

### Approval boundary

A manually selected working zone remains unconfirmed until the user explicitly confirms it through the existing zoning workflow.

The autonomous job may investigate, compare, classify and recommend. It must not silently convert a working assumption into municipal proof or a user-confirmed conclusion.

A readable, property-matched zoning document may strengthen the evidence without requiring the system to pretend Easy Erf is a certifying authority.

## Canonical state and schema decision

### V1 decision: no new database table

Planning Investigation V1 does not require a new `agent_runs`, `agent_memory` or planning-results table.

The result is derived from the same canonical planning assessment and evidence pack already used by the product. This gives the first autonomous job a real end-to-end path without creating another source of truth.

This is intentional validation discipline. Persisted job-run history should be introduced only when repeated use proves that audit history, asynchronous continuation or cross-session run comparison materially improves the investigation.

### Future persistence trigger

A generic investigation-run store becomes justified when at least one of these is true:

- a job needs to continue asynchronously across sessions
- users need a run-by-run audit trail
- a job executes external retrieval that must be replayed or inspected later
- professional review needs immutable submitted results
- machine-to-machine API consumers need stable historical job artifacts

Until then, canonical property state plus the evidence graph remain the truth.

## Guided Investigation integration

The first user-facing placement is the existing zoning step.

The user sees a compact result headed:

> Easy Erf investigated the planning position

It shows:

- sources checked
- number of findings
- confidence
- key findings
- contradictions
- unresolved evidence
- the next investigation

The existing zoning-selection and evidence-upload controls remain directly below it. This preserves the Easy Erf principle:

**One screen. One clear job.**

The user sees completed work, not an agent control panel.

## Dossier and Report propagation

V1 does not copy the job output into separate Dossier or Report state.

All three surfaces consume the same canonical inputs:

- Guided Investigation uses the shared planning assessment and evidence pack to render the job result.
- Zoning & Build in the Dossier already consumes the canonical planning assessment.
- The Easy Erf Report already builds its planning claims from the same planning assessment inside the property evidence pack.

Therefore a confirmed zoning or newly extracted planning document improves the shared property record and propagates naturally.

## Evidence graph alignment

Planning Investigation V1 follows the existing evidence graph direction:

Property
→ identifier
→ source
→ evidence or document
→ extracted fact or rule
→ confidence
→ confirmation
→ derived planning conclusion

Important planning findings preserve source ids. Contradictions and missing evidence remain first-class outputs rather than being hidden in narrative prose.

This is the machine-readable foundation for future Easy Erf workers, professional review and APIs.

## Canonical validation property

Erf 1570, Sea Vista, Kouga is the first planning-job regression property because the project already has established canonical identity and planning fixtures for it.

Canonical identity used by tests:

- Erf: 1570
- Portion: 0
- LPI: `C03400140000157000000`
- Parcel key: `E108C034001400001570000000`
- Municipality: Kouga Local Municipality
- Province: Eastern Cape
- Area: 618.7 m²

The V1 regression test intentionally keeps a manually selected planning zone distinct from property-specific municipal proof. It confirms that published rules are surfaced as general scheme rules, unresolved evidence remains visible and explicit approval is required before a manual working zoning is treated as user-confirmed.

## Known V1 limitations

The first version does not claim to autonomously retrieve every municipal record on the web.

It can only use the public, municipal and property sources already configured or available to Easy Erf. When a property-specific zoning certificate, official zoning polygon service, title condition, servitude, approved plan or overlay is unavailable, the job must say so.

For Kouga, the planning registry is useful, but the absence of a verified official zoning-polygon adapter means V1 must not imply automatic parcel zoning detection.

This limitation is valuable product information. The next automation work should target the evidence gaps that users repeatedly encounter, rather than building generic browser automation for its own sake.

## Future machine-readable boundary

The job contract is intentionally structured so a future Easy Erf API or another approved system can request a property investigation and receive structured identity, planning, evidence, confidence and unknowns.

Easy Erf remains the South African property-intelligence specialist. Deal Skeptic is not merged into this product. A future deal-analysis flow may consume Easy Erf property intelligence through a clear boundary, but financial skepticism remains Deal Skeptic's job.

## V1 success criteria

Planning Investigation V1 is successful when:

- a user enters the existing Guided zoning step and sees that Easy Erf already performed a planning investigation
- the result is grounded in actual Easy Erf state and evidence
- published rules are not misrepresented as parcel rights
- contradictions and missing evidence remain explicit
- a manual working zoning still requires approval
- the same canonical planning state continues to drive Dossier and Report
- Erf 1570 regression tests pass
- no duplicate planning or agent state store is introduced
