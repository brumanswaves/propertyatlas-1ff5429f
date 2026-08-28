# Easy Erf Master Plan

## 1. Purpose

This document is the canonical product and delivery plan for Easy Erf. It exists to keep product direction, UX, architecture, evidence standards, strategy tools, engineering work, approved external-tool work, and QA on one controlled path.

When a future idea, branch, PR, external-builder prompt, or design decision conflicts with this document, the conflict must be resolved here first.

GitHub `main` is the code source of truth. This document is the product source of truth.

---

## 2. North Star

**Click any erf. Easy Erf investigates it, shows what is known and unknown, explains what matters, calculates the deal, explores what the property could become, and guides the user to the next best action.**

Easy Erf should feel simple enough for a normal home buyer to use without training, while exposing serious investor and developer-grade intelligence underneath.

The product should not feel like a collection of GIS tools, forms, reports, calculators, or tabs. Those are capabilities under one guided property-investigation experience.

---

## 3. Primary User

### MVP primary user

**Serious property buyer / investor first.**

The experience must still be easy enough for a normal home buyer to use, with more advanced developer and professional tools available underneath.

### Product design rule

A 15-year-old or a 60-year-old should be able to understand the next action. A sophisticated investor should still find the underlying evidence, maths, assumptions, and advanced tools credible and useful.

---

## 4. Gold-Standard Test Property

**Erf 1570** is the canonical end-to-end test property for the MVP.

Reason:
- real purchased property
- access to real supporting information and documents
- known zoning and build-potential questions
- useful SG / cadastral evidence
- market and strategy use cases
- real acquisition, build, resale, rental, and feasibility numbers can be tested

Major product features should be validated against Erf 1570 before being considered production-ready.

---

## 5. Core Product Journey

The canonical user journey is:

1. Find or click a property
2. Easy Erf opens a read-only **Property First Read / Property Overview** that orients the user with the selected parcel and intelligence already recorded
3. The user explicitly chooses **Investigate this property** or **Continue investigation** to enter Guided Investigation
4. Guided Step 1 confirms the erf / parcel identity
5. Easy Erf uses available public, paid, uploaded, and derived evidence
6. Easy Erf shows what it knows, what it does not know, and confidence level
7. Easy Erf gives one clear **Next Best Step**
8. User supplies missing evidence only when needed, with clear instructions on how to obtain it
9. Easy Erf interprets the evidence and updates the property file
10. Easy Erf runs strategy and calculator scenarios using transparent maths and assumptions
11. Site Potential turns verified or explicitly assumed constraints into a deterministic parcel/build envelope and street-side build-line view
12. Market Evidence adds comparable and market context
13. Easy Erf Report continuously improves as evidence and analysis improve
14. Ask Easy Erf explains, compares, calculates, and guides actions throughout

Property First Read is the default selected-property entry experience. It is a zero-commit orientation surface, not a second investigation state. Guided Investigation is the default normal-user investigation experience once the user explicitly begins investigating. Expert Workbench tools remain available underneath as a secondary path.

The overall product should still feel like one intelligent investigation, not a sequence of disconnected pages or tabs. The Property First Read, Guided Investigation, expert tools, evidence, calculations, Site Potential and report are views over the same property file and investigation state.

---

## 6. Canonical Product Architecture

### Layer 1: Property Identity

One canonical property / parcel identity.

All evidence, calculations, strategies, uploads, reports, market evidence, and AI answers must be bound to the selected property.

### Layer 2: Evidence Registry

Every important fact must know where it came from.

Evidence can include:
- official cadastral / SG information
- municipal sources
- zoning schemes and planning rules
- title / deeds information
- Lightstone / WinDeed or similar paid reports
- uploaded PDFs, images, TIFFs, plans, and certificates
- listing URLs and comparable evidence
- maps, imagery, public datasets, and environmental sources
- user-entered facts and assumptions

Evidence must retain source, date, property binding, confidence, and whether it is official, user-supplied, inferred, or derived.

### Layer 3: Structured Property Intelligence

Normalize evidence into reusable property facts, including:
- erf number and legal identity
- address / working address
- extent / area
- ownership and title indicators
- zoning
- building lines
- coverage
- height
- density / dwelling rights
- servitudes and restrictions
- environmental and planning constraints
- topography and physical characteristics
- sales and transfer history
- market comparables
- listing evidence
- estimated buildability
- strategy assumptions

No major screen should create a competing version of the same fact.

### Layer 4: Master Investigation Plan

For each property, Easy Erf maintains a living plan of what needs to be known.

Each investigation item is classified as:
- Required
- Recommended
- Optional

Each item has a state such as:
- Verified
- Working / inferred
- Missing
- Conflicting
- Not applicable
- Skipped

The UI should prioritize one **Next Best Step**, rather than dumping every missing item on the user.

### Layer 5: Strategy & Calculators

Strategy and calculators are a first-class pillar of Easy Erf.

They turn property facts into decisions using deterministic maths first, with AI used to explain, suggest scenarios, compare outcomes, and identify missing assumptions.

The user should be able to see the numbers, formulas, assumptions, and sensitivity clearly.

### Layer 6: Site Potential

Site Potential converts verified or explicitly assumed constraints into a **deterministic build envelope**, not a generated architectural concept.

The active MVP output is limited to:
- a parcel/map view showing the potential build envelope or build lines
- a street-side / street-level view showing the relevant build lines, height and envelope limits
- explicit assumptions, evidence confidence and source provenance
- an accept or skip state that is shared with Guided Investigation and the Easy Erf Report

Inputs may include:
- parcel geometry
- SG / cadastral information
- zoning
- building lines
- coverage
- height
- density
- title restrictions
- environmental constraints
- topography
- access / street frontage

**The active product does not generate house designs, facades, rendered buildings, architectural concepts or AI building images.** Historical generated-design tables, assets, APIs and fields may remain temporarily for backward compatibility, but they are not the active user journey, completion contract or product promise.

Site Potential outputs must never appear more authoritative than the evidence beneath them. A build envelope is not an approved building plan, municipal approval or professional design.

### Layer 7: Market Evidence

Market Evidence supports pricing, valuation, acquisition, resale, rental, and strategy decisions through:
- active listings
- sold comparables when available
- user-supplied listing URLs
- imported listing data
- price per square metre
- property similarity scoring
- local market context

### Layer 8: Easy Erf Report

The Easy Erf Report is the living destination of the investigation.

It begins as soon as a property is identified and improves as evidence and analysis improve.

Every important module should feed the report rather than becoming an isolated dead-end workspace.

### Layer 9: Ask Easy Erf

Ask Easy Erf is the conversational interface over the property, evidence, investigation, strategy, calculators, Site Potential, market evidence, and report.

It should not act as a generic chatbot.

It must:
- answer from available evidence and structured facts
- cite / identify the underlying source where appropriate
- distinguish verified facts from assumptions
- use calculator outputs rather than inventing arithmetic
- explain why a conclusion is uncertain
- recommend the Next Best Step when evidence is missing
- be able to initiate or navigate useful actions in the product

---

## 7. Evidence and Trust Rules

Easy Erf must visibly distinguish **known** from **inferred**.

Examples:
- published zoning rules are not automatically property-specific verified rights
- a General Plan is not automatically the selected erf's individual SG diagram
- a paid property report is not automatically the certified title deed
- a Site Potential build envelope is not an approved building plan or municipal approval
- AI interpretation is not official evidence
- a user-entered assumption is not a verified property fact

Confidence and provenance are product features, not legal disclaimers added at the end.

Document identity must scale nationally without treating administrative geography as a hard parcel gate. Province, municipality, district, town, suburb, locality and address wording are corroborating context only: they can inform confidence, but cannot alone reject a readable document as the wrong property. Automatic mismatch is reserved for an explicit conflicting LPI/cadastral identifier, a different subject erf, or a different subject portion of the same erf. A readable document without a uniquely matching cadastral identifier remains confirmable user-supported evidence; a General Plan can support an erf through safely filtered annotations without becoming that erf's individual SG diagram.

---

## 8. Strategy & Calculator System

### Product principle

The strategy engine should feel closer to serious investor tools such as BiggerPockets-style deal analysis, but connected directly to the selected erf and its evidence.

The calculations must be predominantly mathematical and deterministic. AI adds interpretation, scenario suggestions, plain-English explanation, and warnings about weak assumptions.

### MVP calculator priorities

1. **Deal Snapshot**
   - asking / purchase price
   - land / property size
   - acquisition costs
   - total cash required
   - financing summary
   - target strategy
   - headline return / margin

2. **Maximum Offer Calculator**
   - target return
   - expected resale / GDV or rental value
   - build / renovation budget
   - acquisition costs
   - finance and holding costs
   - contingency
   - selling costs
   - outputs maximum supportable purchase price

3. **Acquisition Cost Calculator**
   - purchase price
   - transfer duty assumptions
   - conveyancing / registration assumptions
   - financing costs where relevant
   - due-diligence costs
   - immediate capital requirements

4. **Build / Development Feasibility**
   - erf area
   - assumed or verified coverage
   - usable / buildable area
   - floor area assumptions
   - build rate per m2
   - professional fees
   - external works
   - contingency
   - total development cost

5. **Residual Land Value**
   - GDV / expected completed value
   - target developer margin
   - build and soft costs
   - financing and holding costs
   - selling costs
   - residual value available for land

6. **Resale / GDV Profit Calculator**
   - total project cost
   - expected sale value
   - gross profit
   - net profit
   - margin on cost
   - margin on revenue
   - break-even resale value

7. **Rental Scenario**
   - market rent
   - vacancy
   - operating expenses
   - management
   - rates / taxes / levies
   - debt service
   - NOI
   - cash flow
   - cap rate
   - cash-on-cash return

8. **ROI / ROE Calculator**
   - return on total cost
   - return on invested cash
   - leveraged vs unleveraged view
   - equity created / lost

9. **Price-per-m2 Comparator**
   - land price per m2
   - building price per m2
   - comparable sale / asking price per m2
   - subject-vs-market comparison

10. **Break-Even Calculator**
    - resale break-even
    - rental break-even
    - required occupancy / rent
    - required selling price

11. **Sensitivity Analysis**
    - purchase price
    - build cost
    - build size
    - project duration
    - interest rate
    - rent
    - resale / GDV
    - vacancy
    - contingency

The user should be able to quickly see best case, base case, and downside case.

### Later calculator expansion

- IRR / NPV
- refinance / BRRRR scenarios
- subdivision feasibility
- multi-unit development
- phased development
- short-term rental analysis
- renovation / flip analysis
- holding-period comparison
- portfolio allocation
- tax scenario interfaces where appropriate and safe

### Calculator trust rules

Every calculation must show:
- formula / method
- inputs
- source of each input where known
- user assumptions
- whether a property constraint is verified or estimated
- outputs
- sensitivity to key assumptions

AI may explain calculations but may not silently replace deterministic maths.

---

## 9. Easy Erf Report Structure

The report should be understandable at a glance, then deepen page by page.

### First screen / first page
- property identity
- address / erf / area / size
- map / parcel visual
- Easy Erf verdict
- biggest opportunity
- biggest risk
- key strategy numbers
- report readiness / evidence confidence
- prominent Ask Easy Erf input

### Deeper sections
- property identity
- evidence summary
- ownership and title
- SG / cadastral / boundaries
- zoning and planning
- buildability / building controls
- environmental and physical checks
- Site Potential
- market evidence and comparables
- Strategy & Calculators
- investment scenarios
- risks and unknowns
- documents and paid reports
- source / evidence appendix

Paid reports, uploaded SG diagrams, strategy outputs, calculations, and the accepted deterministic Site Potential envelope/build-line state should flow into the report automatically where relevant.

---

## 10. Guided UX Rules

The default experience should be guided, not expert-first.

The user should frequently see language like:

- "Here is what I found."
- "Here is what I still need."
- "This is verified."
- "This is only a working assumption."
- "The easiest way to improve this is..."
- "Next best step..."

When asking the user to obtain something, Easy Erf should explain exactly how.

Examples:
- how to obtain an SG diagram
- how to buy and download a Lightstone / WinDeed report
- how to upload a title document
- how to copy a Property24 comparable URL
- how to obtain municipal planning evidence

Expert workspaces remain available underneath for users who want depth and direct control.

---

## 11. MVP Definition

The MVP is not "every property in South Africa."

The product MVP is:

**One real property investigation works extremely well end-to-end, using Erf 1570 as the gold-standard case, within the Kouga / St Francis pilot geography.**

A successful product MVP allows a user to:
- identify the property
- establish a working address
- bind and read cadastral / SG evidence
- add title / ownership evidence
- establish working zoning with transparent confidence
- complete core property checks
- understand build constraints and deterministic Site Potential
- add Market Evidence
- run powerful strategy calculators
- compare scenarios
- understand risks and missing evidence
- ask grounded questions
- produce a useful Easy Erf Report

The immediate commercial MVP is:

**Sell and fulfill the first real R999 Early Access Easy Erf Property Investigation for one property using the canonical Easy Erf property file plus human review.**

Do not delay this commercial proof until every evidence source or investigation step is automated.

---

## 12. Roadmap

### NOW: Make the core investigation excellent and prove willingness to pay

- Erf 1570 end-to-end
- first real R999 Early Access human-reviewed property investigation
- one canonical property file
- evidence registry and confidence discipline
- one clear Next Best Step
- Guided experience that feels like an AI investigator, not a form wizard
- SG / cadastral evidence
- title / paid-report workflow
- zoning and planning confidence states
- property checks
- Strategy & Calculators integrated into the property
- deterministic Site Potential integrated into strategy
- Market Evidence integrated into strategy
- living Easy Erf Report
- Ask Easy Erf across the workflow
- coherent public shell, My Investigations and Account
- Founder Operations for real support and operational visibility

### NEXT: Automate evidence acquisition and support operations

- stronger cadastral retrieval
- zoning / planning sources
- municipal data integrations
- paid-report integrations
- document extraction improvements
- address intelligence
- listing and comparable import
- environmental and public-data sources
- trusted cross-user support inspection for Founder Operations
- audited entitlement, job-retry and support actions where real backend capabilities exist

### THEN: Decision intelligence

- stronger deterministic build envelope
- development scenarios using explicit numerical assumptions, not generated architectural renders
- financial scenario comparison
- investor strategy recommendations
- risk scoring
- market / comparable intelligence
- scenario sensitivity and decision summaries

### LATER: Platform expansion

- monitoring and alerts
- property passport
- professional collaboration / local property team
- transaction / due-diligence room
- portfolio tools
- professional marketplace / fulfilment
- enterprise / API products
- additional municipalities
- national coverage
- satellite / Earth-observation intelligence where commercially justified

---

## 13. Product Decisions Locked Unless Explicitly Changed

- Product name: **Easy Erf**
- Approved logo direction remains locked
- Primary MVP user: serious property buyer / investor
- Home-buyer UX must remain simple and approachable
- Developer-grade depth lives underneath Guided mode
- Property First Read / Property Overview is the default selected-property entry experience
- Guided Investigation is the default normal-user investigation experience once investigation begins
- Expert mode remains available but secondary
- Selecting or opening an erf does not automatically start Guided Investigation. Property confirmation is the first Guided investigation task after the user explicitly begins or continues the investigation. This supersedes the earlier assumption that property selection immediately starts investigation.
- Erf 1570 is the gold-standard test property
- Kouga / St Francis remains the initial pilot geography
- Easy Erf Report is the living destination of the investigation
- Ask Easy Erf is grounded in the property file, not a generic chatbot
- Strategy & Calculators are a core product pillar
- Calculations are deterministic maths first, AI explanation second
- **Active Site Potential is deterministic parcel/map build envelope plus street-side build lines only. No generated house concepts, rendered buildings, facades or AI architectural imagery are part of the active product. This supersedes the earlier generated-concept direction.**
- Site Potential must inherit evidence confidence and assumptions
- Paid reports are an important evidence and commercial pathway
- Evidence provenance and confidence must be preserved
- Visual evidence traceability: when a stored SG document has a safe derived preview, the living report may show that preview beside identity-gated findings. Preview generation is convenience evidence display only; it never changes identity, lineage or planning provenance, and a missing preview remains an honest limitation.
- Administrative geography is corroborating document context, not a hard property-identity gate; readable ambiguity is resolved through existing user confirmation, while only strong cadastral contradictions automatically mismatch
- **Current commercial MVP includes a once-off R999 Early Access human-reviewed Easy Erf Property Investigation for one property. It is not a subscription. Checkout remains fail-closed until a real verified payment path is configured.**
- Pay-per-use or pay-per-property offers must remain truthful to real entitlement and payment infrastructure.
- My Investigations derives from canonical property/investigation state and must not create a separate progress engine.
- Founder Operations extends the existing protected admin architecture and must not create a second admin-role system.
- Privileged admin mutations require a trusted backend boundary and audit trail before UI controls are exposed.
- `docs/EASY_ERF_DESIGN_SYSTEM.md` is the canonical lightweight visual and terminology reference.
- GitHub `main` is the code source of truth
- This document is the product source of truth

---

## 14. Delivery Workflow

All meaningful work follows:

**Idea -> Master Plan classification -> impact check -> branch -> implementation -> tests -> PR -> review -> merge -> production sync -> live QA**

Before starting a feature, answer:
- Does this already exist?
- Where does it belong in the canonical architecture?
- Which existing facts / evidence / state should it reuse?
- What must not be duplicated?
- Does it improve the investigation, strategy, report, customer continuity or safe operations?
- Does it create design or terminology drift elsewhere?
- Is it NOW, NEXT, THEN, or LATER?

No new chat, external builder, agent, admin system or branch gets to create a competing roadmap.

---

## 15. Tool and Environment Roles

### GitHub `main`
Absolute source of truth for production code.

### Master Plan
`docs/EASY_ERF_MASTER_PLAN.md` is the canonical product-direction document.

### Design System
`docs/EASY_ERF_DESIGN_SYSTEM.md` is the canonical lightweight reference for visual roles, reusable patterns, navigation, terminology and responsive coherence.

### Repository engineering
Repository-first engineering is the default implementation, debugging, review and test path. Use one focused branch / implementation tranche at a time. Avoid overlapping agents solving the same problem.

### Codex
Codex may be used for focused engineering under the model, reasoning, credit-risk, scope and stop-condition controls in `AGENTS.md`. Do not use broad archaeology or high-cost models when direct repository inspection can narrow the task first.

### Lovable
Lovable is **not authorized for build work by default**. It may only be used for a specifically approved task after the owner explicitly authorizes that exact use. General instructions to continue building do not authorize Lovable credits or implementation work.

### Vercel
Do not use Vercel for Easy Erf unless the owner explicitly reverses the repository governance prohibition.

### ChatGPT project / control room
Product strategy, architecture, roadmap, decisions, and orchestration should be consolidated into one Easy Erf control-room conversation/project.

Other chats may generate ideas, but those ideas must be brought back into this Master Plan before becoming implementation work.

---

## 16. Change-Control Rule

When a major product direction changes:

1. Update this Master Plan first.
2. State what previous decision is being superseded.
3. Identify impacted UX, data model, report, calculators, operations and existing features.
4. Only then open implementation work.

2026-08-28 change-control correction:

- The earlier generated Site Potential concept direction is superseded by deterministic map/build-envelope plus street-side build lines only.
- The active generated-concept user flow was removed in PRs #127 and #128 before this Master Plan was refreshed. This document now resolves that drift and governs future work.
- Historical generation data may remain for compatibility, but future active UX, report completion and commercial copy must not depend on generated concepts.
- The R999 one-property human-reviewed Early Access investigation is now part of the NOW commercial MVP and must not disappear from the active build without an explicit product decision here.

This change-control rule prevents repeated redesign, duplicated code, fragmented external-builder projects, unsafe operational shortcuts and unnecessary engineering / AI spend.

---

## 17. Autonomous property-investigation workforce

Easy Erf is evolving from a collection of property information and AI features into a South Africa-specific autonomous property-investigation workforce. The user assigns understandable jobs while the product performs as much evidence-grounded work as the available tools and sources allow.

The first real job is **Investigate this property's planning position**. It reuses the canonical parcel, `ParcelPlanningAssessment`, municipality planning registries, uploaded evidence and `PropertyEvidencePack`. It returns a machine-readable Agent Job Contract V1 result with goal, inputs, context, tools, process, evidence, confidence, actions, approval rules, output and next job.

V1 deliberately adds no new agent-memory or planning-results table. Guided Investigation, Dossier and Report remain interfaces over the same canonical planning and evidence state. A persisted investigation-run ledger is deferred until asynchronous continuation, audit history, professional review or API consumers prove the need.

The user-facing rule remains **One screen. One clear job.** Internal worker architecture is not exposed as fake personalities.

See `docs/EASY_ERF_AGENT_JOBS_V1.md`.

---

## 18. Founder Operations architecture

The existing protected `/admin` area evolves into **Easy Erf Founder Operations**. Do not create a parallel admin application or a second role model.

Founder Operations has a different job from the customer application, so it may use denser tables, logs, filters and operational statuses. It must still inherit Easy Erf typography, semantic colors, controls, status meanings, responsive behavior and terminology.

### V1: read-first operational truth

The first production-quality console should prefer real operational records over vanity metrics. It may surface data already available to the current admin authorization boundary, including:

- report orders and fulfilment failures
- provider audit activity and latency
- provider settings/health
- existing provider readiness diagnostics
- existing public-data diagnostics

Do not substitute demo-property counts for registered users, active investigations or production activity.

### Trusted support layer

Cross-user investigation detail, uploaded evidence, legacy Site Potential job state, entitlements, support notes, refunds, grants, retries and repairs are privileged support capabilities. They require a trusted backend boundary with:

- existing admin-role authorization
- least privilege
- server-side validation
- actor admin id
- target user id where applicable
- action type
- previous/new state where useful
- reason or support note
- timestamp and result
- reversible behavior where practical

No service-role credential may reach the browser. Do not expose a refund, credit-grant, destructive repair or impersonation control before a real audited backend action exists.

Developer/debug tools must remain clearly separated from normal operations even when linked from the same Founder Operations shell.

---

## 19. R999 Early Access commercial proof

The R999 Early Access Easy Erf Property Investigation is the shortest path to validating real customer value without waiting for full automation.

### Offer

- R999 introductory once-off price
- one property
- human-assisted and human-reviewed
- uses the canonical Easy Erf property file and evidence already gathered
- supplements automation with public/official research and human review when the product cannot yet complete the work autonomously

### Reviewed output emphasis

- Property Truth
- Property Potential
- deal killers and key risks
- conflicts and unknowns
- clear next steps and professional confirmation points
- Strategy and financial analysis where relevant

### Trust boundary

The Early Access investigation is not a zoning certificate, title opinion, valuation, approved building plan or professional sign-off. Anything Easy Erf cannot verify remains unresolved or clearly labelled as an assumption.

### Checkout boundary

The public purchase action must remain disabled unless a real verified payment path is configured. A checkout link, payment-provider response or test charge alone does not prove the complete purchase-to-fulfilment workflow.

### Commercial acceptance

Commercial MVP acceptance requires one real customer to pay through the verified payment path and receive the promised human-reviewed investigation. The product should learn from that fulfillment before expanding plans, subscriptions, marketplaces or national automation.
