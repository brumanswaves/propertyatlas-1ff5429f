# Guided SG diagram review checklist

## User flow

1. Confirm property.
2. Add or skip the working address.
3. Open the official SG document list or CSG Property Viewer.
4. Download the subject erf diagram.
5. Upload the PDF or image to the private Erf File Vault.
6. Easy Erf reads the file and checks its identity against the selected parcel.
7. Continue to Check title only when a readable subject diagram is matched.

## Required review cases

- Direct SG document URL can be built from parcel identifiers.
- CSG viewer fallback appears when a direct document URL cannot be built.
- Signed-out users can open official sources but cannot upload.
- Supported PDF and image uploads are stored and automatically read.
- Unsupported, empty and oversized files show clear errors.
- A matched, searchable subject diagram completes the step.
- A wrong-property diagram is rejected and cannot complete the step.
- A parent General Plan remains context only and cannot complete the subject SG step.
- Failed, partial or unverified extraction can be retried.
- Uploaded files can be opened and removed.
- Back and Skip remain available.
- No shared bypass Continue button appears.
- File vault updates refresh Guided and Expert views for the same erf.

## Verification limitation

The connector environment used to prepare this draft could not resolve github.com from its local runtime, so full Vitest, TypeScript, ESLint, production build and interactive browser checks remain required before merge.
