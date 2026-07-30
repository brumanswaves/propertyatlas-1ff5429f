# Guided Investigation Phase 1

This document is the implementation contract for the first controlled phase of the guided Easy Erf Report journey.

## Product decision

Investigation is the normal user's primary workflow. It performs the active task directly. Existing workbenches remain available through a subdued expert-workspace launcher, but they are no longer the default path.

## Phase 1 scope

1. Add a data-driven eight-step journey registry:
   - confirm-property
   - add-address
   - sg-diagram
   - title
   - zoning
   - property-checks
   - market
   - report
2. Add a versioned, parcel-scoped journey snapshot that persists only non-derivable navigation state:
   - currentStepId
   - intentionallyVisitedStepIds
   - skippedStepIds
   - lastMeaningfulActionAt
   - expertWorkspaceOpen / lastExpertView, kept separate from guided resume state
3. Derive completion, blocked and recommended states from existing evidence and workspace state. Do not duplicate evidence state.
4. Build the guided shell, progress navigator, mobile step header, Back, Continue, Skip and View all steps.
5. Implement Step 1 fully inside Investigation:
   - show concise official parcel identity
   - reuse the existing parcel map slot
   - confirm identity directly
   - flag possible wrong parcel directly
   - automatically advance to Step 2 after successful confirmation
6. Resume a selected property at the first incomplete recommended step. Do not resume at the last random expert tab.
7. Add a subdued `Open full research workspace` control. Existing workbenches and routes remain intact.
8. Do not implement Steps 2-8 actions yet. They may render honest preview shells for navigator continuity, but must not contain fake buttons or claim completion.

## Explicit exclusions

- No Lovable work
- No production publish or deploy
- No homepage redesign yet
- No address input or reverse geocoding yet
- No SG upload relocation yet
- No title upload relocation yet
- No zoning form relocation yet
- No market importer relocation yet
- No four-hub navigation rewrite
- No Zustand or new state library
- No package or lockfile changes
- No database migrations
- No branding changes

## UX rules

- One screen, one job, one primary action.
- Required actions are never hidden behind disclosures.
- Only the active Step 1 confirmation action may use solid orange in Phase 1.
- Expert workspace access is visually secondary.
- Mobile always has a visible return-to-map action supplied by the existing panel.
- Completed and available steps are revisitable.
- Skipped is distinct from complete.
- The journey must remain usable with keyboard and screen reader.

## Acceptance criteria

1. Selecting an erf opens the guided journey, not a workbench task list.
2. Eight steps are visible through desktop/mobile navigation.
3. Step 1 performs identity confirmation directly in Investigation.
4. `This may be the wrong erf` updates the existing identity state and provides a clear return-to-map/search path.
5. Successful confirmation advances to Step 2.
6. The journey resumes at the first incomplete recommended step after reload/reopen.
7. Opening an expert workspace does not overwrite guided resume state.
8. `Open full research workspace` exposes the existing navigation and all existing tools.
9. No journey step button routes users into an expert tab as its normal completion mechanism.
10. No fake Step 2-8 actions are introduced.
11. Existing parcel selection, save/share, uploads, evidence, report and expert routes remain intact.
12. Mobile navigation and close/back-to-map remain usable.
13. Existing tests pass and focused tests cover registry order, Step 1 completion, uncertain identity, resume, skip distinction, expert workspace separation and mobile controls.
14. TypeScript, lint on changed files and production build pass.
