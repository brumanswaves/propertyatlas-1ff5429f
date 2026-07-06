No code changes proposed. This turn is a read-only status check.

Findings:
- GitHub `main` HEAD: `0df22ab` (PR #1 "search-address-erf-flow" merged, plus `5c97c5c` merge of Dean cleanup).
- Preview HEAD: `0df22ab` — in sync with `origin/main`.
- `32249ff` "Rebuild search into address and erf flows" is included (ancestor of HEAD).
- Published site is still on `babb042`; 4 newer commits are unpublished. Requires **Publish → Update** to deploy.
- `src/components/map/SearchBar.tsx` implements the two-lane chooser (`SearchLane = "address" | "erf"`, `lane` starts `null`) with Google address autocomplete and structured erf fields.

Next step (only if you want it): click **Publish → Update** to roll the preview commit `0df22ab` to the live site. I will not publish without an explicit instruction.