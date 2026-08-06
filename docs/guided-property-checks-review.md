# Guided Property checks review

## Purpose

Verify that Step 6 gathers useful building and site evidence without claiming that a structure is approved, illegal, compliant, or buildable.

## Required desktop flow

1. Complete or skip earlier guided steps and open **Property checks**.
2. Switch among approved plans, existing-building photos, site photos, and topographic survey.
3. Confirm each upload receives the correct file category and source label.
4. Confirm topographic surveys are read and identity-checked.
5. Confirm photos and plans remain viewable and removable.
6. Confirm **Continue to Market evidence** enables after at least one recognized property-check evidence type is present.
7. Use **Back** to revisit Zoning and return without losing evidence.
8. Confirm **Skip for now** advances without marking the step complete.

## Irregular-building warning

- Upload one or more existing-building photos without approved plans.
- Confirm Easy Erf displays an unresolved irregular-building risk.
- Confirm the wording does not say the building is illegal or unapproved as a fact.
- Add an approved-plan file and confirm the missing-plan warning clears.
- Confirm the screen still states that an architect, surveyor, or municipality must compare the current buildings with the approved plans.

## Evidence classification

### Approved municipal plans

- User must deliberately choose **Approved municipal plans** before upload.
- Sales plans, concept plans, inspiration images, and unapproved architect drawings must not be described as approved.
- The file remains user-classified until municipal provenance is checked.

### Existing-building photos

- Encourage coverage of every addition, outbuilding, garage, deck, flatlet, pool enclosure, and visible alteration.
- Photos are observations only and do not prove approval status.

### Site and boundary photos

- Confirm the guidance covers access, slope, retaining walls, boundaries, services, vegetation, and neighbouring levels.
- Photos must not create survey-grade boundary conclusions.

### Topographic survey

- A survey only counts as matched survey evidence when extraction is ready and the property identity is matched.
- Wrong-property, failed, partial, and unverified surveys remain visible but do not count as matched evidence.

## Mobile review

- Evidence selection cards remain tappable without horizontal scrolling.
- Upload, official planning links, status cards, Back, Skip, and Continue remain visible and usable.
- Long file names and source names truncate or wrap safely.
- Upload and reading progress remain visible after the action.

## Trust wording

Confirm the screen states that:

- Easy Erf organizes evidence but does not certify building legality.
- A missing approved plan set creates an unresolved risk, not proof of illegality.
- User-classified approved plans still need municipal provenance.
- Site photos are observations, not boundary surveys.
- A professional must compare current buildings, boundaries, and plans.

## Automated checks before merge

- Focused property-check journey and shell tests.
- Full Vitest suite.
- TypeScript check.
- Targeted ESLint for changed files.
- Production build.
- Desktop and mobile interaction pass.
