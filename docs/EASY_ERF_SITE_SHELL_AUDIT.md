# Easy Erf Site Shell Audit

Date: 2026-08-15

Status: implementation audit for the navigation, public pages, account and Founder Operations coherence tranche.

## Product decision

The current global shell exposes too many historical pages and different information architecture on desktop versus mobile. Public copy also materially understates or misrepresents the current product.

The global shell will be simplified around the actual customer journey:

**Find a Property → understand How It Works → understand Pricing → investigate → return through My Investigations.**

## Route audit

| Surface | Decision | Reason / required work |
| --- | --- | --- |
| `/` | Keep, rename navigation label to **Find a Property** | Canonical search/map entry into property selection and Property Overview. |
| `/how-it-works` | Keep and rewrite | Becomes the main public product explanation. Current copy contains obsolete scoring, ownership/value and premium-upgrade claims. |
| `/features` | Remove from primary navigation; consolidate useful content into How It Works | Duplicates product explanation and still describes Easy Erf as public-data research plus a future report marketplace. |
| `/pricing` | Keep and rewrite | Must explain real free capabilities and optional pay-per-use/report pathways. No current subscription. |
| `/about` | Keep as footer/supporting page | Useful company/product context but not a primary customer job. Rewrite stale positioning where needed. |
| `/faq` | Keep in footer | Useful supporting decision/help content. Audit stale claims. |
| `/data-sources` | Keep in footer | Important trust/provenance page, especially while municipal coverage varies. |
| `/contact` | Keep in footer | Useful support/business contact surface. |
| `/for-investors` | Remove from global nav | Investor is the primary MVP user, so core product copy should already serve this user. Current page includes unsupported monitoring/alert language. |
| `/for-homeowners` | Remove from global nav | Current page contains unsupported valuation, ownership and transaction-monitoring claims. Retain only if future content earns a distinct job. |
| `/for-developers` | Remove from global nav | Current page contains outdated filters, scores, ownership and comparable-history claims. Development depth belongs in core Site Potential/Strategy explanation. |
| `/roadmap` | Remove from global nav | Internal/future direction should not compete with the current purchase/investigation journey. |
| `/partnerships` | Remove from global nav | Supporting business page only, if retained. |
| `/reports` | Remove from global nav and review for consolidation | Easy Erf Report is a living core product destination, not a detached marketing/report-store concept. |
| `/subscriptions` | Remove from global/footer navigation | Current MVP commercial decision is explicitly no subscription. Route should not imply an active subscription offer. |
| `/why` | Remove from global nav; consolidate useful differentiation into How It Works/About | Avoid another overlapping marketing page. |
| `/dashboard` | Keep route for compatibility; customer name becomes **My Investigations** | Must show canonical investigation state, where the user left off and the real Next Best Step. Current generic action list must go. |
| `/profile` | Keep route for compatibility; customer name becomes **Account** | Simplify to useful identity/account information and real entitlements/billing only where supported. |
| `/auth` | Keep | Sign-in/start path. Must inherit same shell and terminology. |
| `/admin` | Keep and expand existing guarded architecture | Becomes Founder Operations. Preserve health/provider tooling but separate developer/debug controls from customer operations. |
| `/admin/readiness` and related admin/debug routes | Keep protected and integrate under System Health / developer tools | Do not surface as public/customer navigation. |

Legacy/supporting routes are not deleted blindly in the foundation tranche. They remain addressable until useful content is consolidated, redirects are safe, and route/search impact is understood.

## Navigation architecture

### Public desktop and mobile

1. Find a Property
2. How It Works
3. Pricing
4. Sign in / Start free

### Signed in

Public primary links remain the same, plus:

- My Investigations
- Account
- Sign out

### Footer

Product:

- Find a Property
- How It Works
- Pricing
- My Investigations

Resources:

- FAQ
- Data Sources
- About
- Contact

Legal:

- Terms of Use
- Privacy Policy
- Disclaimer

### Admin

Admin is never public primary navigation. Founder Operations remains behind the existing admin guard. Its future internal IA should prioritize Overview, Users, Investigations, Jobs, Orders/Payments, Entitlements, Support/Errors and System Health, adding only sections backed by real data/actions.

## Confirmed functional drift

### Navigation

- Desktop and mobile currently expose different site architecture.
- Mobile currently behaves like a large page directory.
- Dashboard and Profile are separate top-level links rather than coherent signed-in utilities.

### Public copy

- Features materially understates the current Guided Investigation/Report/Site Potential product.
- How It Works contains unsupported or obsolete claims about estimated values, ownership tenure, scoring filters, monitoring and premium upgrades.
- Audience pages contain several capabilities the canonical product does not currently promise.
- Pricing focuses mainly on public-data research and future third-party reports rather than the current investigation experience.

### Dashboard

- Uses a hard-coded generic `NEXT_ACTIONS` list instead of canonical Guided/report intelligence.
- Counts some report-interest state from browser localStorage.
- Presents saved research dossiers rather than the clearer My Investigations mental model.

### Admin

- Existing `/admin` correctly reuses an admin guard and should be evolved, not replaced.
- Current page is mainly provider/readiness/debug tooling.
- Provider switching is explicitly browser-local development/staging behavior and must not be confused with production founder operations.
- Operational user support, job intervention, entitlements and audit history need trusted backend boundaries before powerful controls are added.

## Permanent coherence rule

Every future Easy Erf UI/product tranche must check whether its design, terminology or interaction improvements belong in the shared system or adjacent surfaces. Low-risk propagation should happen in the same tranche. Larger unrelated propagation must be recorded rather than ignored.
