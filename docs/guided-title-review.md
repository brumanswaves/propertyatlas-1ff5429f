# Guided title review checklist

## User flow

1. Open official deeds guidance or the paid reports workspace.
2. Upload the title deed or ownership document for the selected erf.
3. Easy Erf stores the document in the private Erf File Vault.
4. The existing document reader extracts evidence and checks the property identity.
5. Review document-backed ownership and deed claims with source file, page and confidence.
6. Continue to Confirm zoning only after a readable title document matches the selected erf.

## Required review cases

- Signed-out users can open guidance but cannot upload.
- PDF and supported image documents upload successfully.
- Unsupported, empty and oversized files show clear errors.
- Extraction starts automatically after upload.
- Failed, partial and unverified extraction can be retried.
- A wrong-property title document is rejected and cannot complete the step.
- A readable, identity-matched subject title document completes the step.
- Extracted ownership and deeds claims retain file name, page and confidence.
- Title conditions, servitudes, easements, rights of way, endorsements and restrictions appear only when stated in the document.
- No extracted claim silently replaces official parcel identity.
- The original file can be opened and removed.
- Back and Skip remain available.
- No shared bypass Continue control appears.
- Paid reports remain an optional confidence upgrade and do not automatically replace the title deed.

## Verification limitation

The connector environment cannot resolve github.com from its local runtime, so full Vitest, TypeScript, ESLint, production build and interactive browser checks remain required before merge.
