# Easy Erf Design System

Status: canonical lightweight design reference.

This document exists to keep Easy Erf visually and linguistically coherent as the product evolves. It is deliberately practical. GitHub `main`, shared UI components and `src/styles.css` remain the implementation source of truth.

## 1. Product feeling

Easy Erf should feel like one calm, modern South African property investigation product with serious intelligence underneath.

Core rules:

- One screen. One clear job.
- Show complexity only when it helps the decision.
- Verified, working, assumed and missing information must look meaningfully different.
- Customer pages and operational/admin pages can have different density, but they share the same visual language.
- Improve the shared system once when a pattern is reused. Do not manually restyle many screens independently.

## 2. Brand

Approved product name: **Easy Erf**.

Approved logo direction remains locked. Do not redesign or substitute the logo.

Primary visual roles already live in `src/styles.css`:

- Primary navy: `--brand` / `--primary`
- Orange action accent: `--accent`
- Page background: `--background`
- Card/surface: `--card`
- Primary text: `--foreground`
- Secondary text: `--muted-foreground`
- Borders/inputs: `--border` / `--input`
- Success: `--success`
- Destructive/error: `--destructive`

Use semantic Tailwind classes such as `bg-primary`, `text-accent`, `bg-card`, `text-muted-foreground` and `border-border` before introducing literal hex/RGB values.

Hard-coded colors are acceptable only when the visual itself genuinely needs them, for example maps, imagery, charts, print rendering or a specialized visualization. Established brand colors should not be recopied as component-local hex values.

## 3. Evidence and confidence semantics

The product must preserve the same evidence meaning everywhere:

- **Verified / source-supported:** positive, trustworthy treatment. Never imply more authority than the source provides.
- **Working / user-confirmed conclusion:** distinct from official proof. Use warning/attention treatment when confirmation or stronger evidence still matters.
- **Assumed / inferred:** clearly labelled as an assumption or inference.
- **Missing / unresolved:** neutral or warning treatment depending on whether it blocks the next decision.
- **Conflict / error:** destructive treatment only when evidence conflicts or a process actually failed.

Do not use green merely because a workflow step is complete if the underlying conclusion is still an assumption.

## 4. Typography

Primary interface font: **Inter**.

Headings should use a consistent hierarchy rather than one-off sizes:

- Page title: strong, concise, usually one line on desktop.
- Section title: names one decision area or job.
- Card title: short noun/action phrase.
- Eyebrow/status text: small uppercase only when it adds scanning value.
- Supporting copy: readable sentence case with restrained line length.

Avoid dense all-caps UI and avoid marketing language inside investigation workspaces.

## 5. Spacing and shape

The current Easy Erf system favors:

- generous page gutters
- compact internal card spacing
- rounded cards and controls
- thin neutral borders
- restrained shadows
- clear separation through spacing before decoration

Do not add extra gradients, shadows, pills or nested cards merely for visual interest.

## 6. Canonical interaction hierarchy

### Primary action

One strongest action per screen or decision area. Use the Easy Erf action accent or the canonical primary button treatment.

### Secondary action

Use outline, neutral or lower-emphasis treatment.

### Destructive action

Use the destructive semantic treatment and require appropriate confirmation when the action has meaningful consequences.

### Next Best Step

There should be one canonical Next Best Step derived from investigation/report intelligence where available. Do not create local hard-coded action lists that compete with canonical guidance.

## 7. Core reusable patterns

Before creating a new pattern, inspect existing shared components.

Preferred reusable concepts include:

- global header/navigation
- page shell
- section header
- information card
- evidence/status card
- confidence/status chip
- Next Best Step card
- empty/loading/error states
- form controls
- dialogs/modals
- account shell
- My Investigations property card/row
- admin metric and operational status cards

When the same styling appears on multiple surfaces, promote it into a shared component or token rather than copying classes indefinitely.

## 8. Navigation architecture

Primary customer navigation:

1. **Find a Property**
2. **How It Works**
3. **Pricing**

Signed-in utilities:

- **My Investigations**
- **Account**

Desktop and mobile use the same information architecture.

Footer resources contain supporting pages such as FAQ, Data Sources, About, Contact and legal material. Audience pages, Roadmap, Partnerships and older feature/report pages must not grow the primary navigation again without a deliberate product decision.

Admin access is protected by admin authorization and belongs to the operational/admin experience, not the public primary navigation.

## 9. Canonical terminology

Use these names consistently unless a documented distinction requires otherwise:

- Property Overview
- Guided Investigation
- Easy Erf Report
- Site Potential
- Strategy
- Market Evidence
- Ask Easy Erf
- My Investigations
- Next Best Step
- verified evidence
- working conclusion
- assumption
- missing or unresolved evidence

Avoid reviving PropertyAtlas, ErfStoep, generic "research dossier" terminology, or multiple names for the same customer-facing concept.

## 10. Responsive behavior

Mobile and desktop are responsive presentations of the same product.

Every meaningful customer-facing tranche should verify at least:

- small phone
- larger phone
- tablet
- normal desktop
- wide desktop when the page materially changes at wide widths

Do not hide the primary action on mobile. Do not introduce mobile-only obsolete navigation. Do not shrink desktop tables/forms until they become unusable; recompose them deliberately.

## 11. Customer versus Founder Operations

Founder Operations may be denser and use tables, filters, logs and operational status because its job is different.

It must still inherit:

- Easy Erf typography
- semantic colors
- form/control styling
- card and border language
- status meanings
- responsive navigation conventions

It should feel like **Easy Erf Operations**, not a separate developer dashboard.

## 12. Continuous coherence requirement

For every meaningful UI/product tranche, finish with this check:

**Does this change create design or terminology drift elsewhere?**

If the propagation is low-risk and directly related, fix the shared component or adjacent surfaces in the same tranche. If it would create major unrelated scope, record the follow-up explicitly.

A feature is not complete only because it works. It is complete when it also looks and behaves like Easy Erf.
