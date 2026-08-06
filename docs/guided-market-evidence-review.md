# Guided Market evidence review

## Purpose

Verify that Step 7 makes listing evidence easy to add while preserving the difference between the subject listing, comparable evidence, and a formal valuation.

## Required desktop flow

1. Complete or skip earlier guided steps and open **Market evidence**.
2. Select **Active listing for this erf**.
3. Paste a supported Property24 URL and run the importer.
4. Review the captured title, price, property type, rooms, land size, building size, location, warnings, and missing fields.
5. Edit incorrect captured values before saving.
6. Confirm the save explicitly attaches the listing to the selected erf without claiming an automatic cadastral match.
7. Switch to **Comparable listing or sale** and repeat with a comparable property.
8. Confirm the comparable saves separately from the active listing.
9. Open and remove saved records.
10. Confirm **Continue to Review report** enables after at least one market record is saved.
11. Use **Back** and return without losing saved market evidence.
12. Confirm **Skip for now** advances without marking Market complete.

## Active listing trust rules

- The active listing is user-confirmed, not automatically matched to the erf.
- A suburb, town, map approximation, or hidden address is not enough for an automatic property match.
- Active listing asking price is not included in comparable summary calculations.
- The asking price is not a valuation or evidence of achieved sale price.
- Older active-listing records remain separate and should not silently become comps.

## Comparable evidence trust rules

- Comparable evidence only affects the market summary after review and save.
- Review location, property type, land size, building size, condition, date, and relationship before relying on it.
- Asking prices must not be described as sold prices.
- Weak or broad comparisons remain labelled with their saved relationship and confidence.
- Removing a comparable must remove it from subsequent market calculations.

## Import failure cases

- Unsupported source URL.
- Invalid or unsafe URL.
- Listing page unavailable.
- Import service unavailable.
- Missing price, address, erf number, size, or property details.
- Portal layout changed and fields could not be extracted.

Each failure must preserve the pasted URL, show a useful message, and allow retry or manual use of Expert mode without creating evidence automatically.

## Mobile review

- Active and comparable mode cards remain tappable without horizontal scrolling.
- URL input, analyse button, progress, review, editing, warnings, and save controls remain usable.
- Saved evidence cards wrap safely and keep Open and Remove accessible.
- Back, Skip, and Continue remain visible and usable.

## Cross-workspace consistency

1. Save an active listing in Guided mode.
2. Open Expert Market and confirm it appears in the active-listing section.
3. Save a comparable in Expert mode and confirm Guided mode updates.
4. Remove evidence in either mode and confirm the other mode updates.
5. Confirm both modes use the same `SavedMarketEvidence` store and listing importer.

## Automated checks before merge

- Focused guided market journey and shell tests.
- Existing listing importer and market summary tests.
- Full Vitest suite.
- TypeScript check.
- Targeted ESLint for changed files.
- Production build.
- Desktop and mobile interaction pass.
