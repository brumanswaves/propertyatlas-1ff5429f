# Guided live QA round 1

This branch fixes the first authenticated live QA findings without changing production data or project configuration.

- Working-address autocomplete while typing
- Dense SG General Plan TIFF overview plus bounded high-detail tiles
- Paid-report purchase and upload guidance on Check title
- Working zoning can advance while remaining clearly unverified
- Site Potential added as explicit Guided step 7 of 9

The user's private SG files are not included. Regression tests use synthetic fixtures and the observed scan dimensions only.

Final verification is run from the canonical PR branch so all Guided fixes are checked against the exact merge candidate.
