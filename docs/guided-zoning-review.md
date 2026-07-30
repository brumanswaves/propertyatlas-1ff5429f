# Guided Confirm zoning review

## Purpose

Verify that Step 5 confirms parcel-specific zoning without turning a manual selection, a general scheme, or an unrelated document into a property right.

## Required desktop flow

1. Complete or skip the earlier guided steps and open **Confirm zoning**.
2. Confirm the municipality and available zone list are appropriate for the selected erf.
3. Open the registered municipal planning sources.
4. Select the zoning stated by the property-specific record.
5. Upload a supported zoning certificate or municipal zoning record.
6. Confirm Easy Erf reads the file and checks its identity.
7. Confirm **Continue to Property checks** remains disabled until the selected zone is supported by a readable, matched zoning claim.
8. Use **Back** to revisit Title and return to Zoning without losing the selection or file.
9. Confirm **Skip for now** advances without marking zoning complete.

## Required mobile flow

- Zone selection, official source links, upload, file status, extracted claims, Back, Skip, and Continue remain usable without horizontal scrolling.
- Long source names, file names, extracted values, and quotes wrap or truncate safely.
- Upload progress and errors remain visible above the fold after the action.

## Evidence and identity cases

### Accepted

- The document extraction status is `ready`.
- The document identity status is `matched` for the active parcel.
- A subject-scoped planning claim with key `zoning` is present.
- The extracted zoning value agrees with the selected registry zone code or name.

### Not accepted

- File uploaded but not read.
- Extraction failed, is partial, or has no zoning claim.
- Identity is unverified or mismatched.
- The document is a general Land Use Scheme with no property-specific identity.
- The extracted zoning states a different zone from the selection.
- The user selects a zone without attaching evidence.
- Numeric controls are inferred from the selected zone when the registry values remain `manual_candidate`.

## Trust wording

Confirm the screen states that:

- A manual zone selection is not proof.
- General scheme documents explain rules but do not prove the zoning of the erf.
- The property-specific document must match the erf and state the selected zoning.
- Confirmed zoning does not automatically confirm height, coverage, building lines, consent uses, departures, title restrictions, approved plans, or a right to build.
- Extracted values are document-derived evidence, not legal advice or municipal approval.

## Cross-workspace consistency

1. Select or change the zone in Guided mode.
2. Open the Expert Zoning & Build workspace and confirm the same selection appears.
3. Change the zone in Expert mode and confirm Guided mode updates.
4. Confirm both modes use the same document-backed completion gate.
5. Remove the supporting zoning document and confirm both modes return to an unconfirmed state.

## Automated checks before merge

- Focused zoning evidence and guided component tests.
- Full Vitest suite.
- TypeScript check.
- Targeted ESLint for changed files.
- Production build.
- Desktop and mobile interaction pass.
