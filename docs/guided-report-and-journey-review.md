# Guided Report and full journey review

## Purpose

Verify that Step 8 presents the current evidence-backed report honestly and that the complete eight-step journey remains simple, reversible, and synchronized with Expert mode.

## Final report step

1. Complete or skip Steps 2 through 7 and open **Review report**.
2. Confirm the readiness percentage matches the existing master investigation plan.
3. Confirm supported findings and attention items match the existing Easy Erf Report brief.
4. Confirm material gaps remain visible even when the report can be opened.
5. Open **Preview current report**.
6. Confirm the existing Easy Erf Report tab opens and `reportStarted` becomes true.
7. Return to Investigation and confirm Review report is complete.
8. Use **Back** to revisit Market evidence and return to Report without losing saved evidence.

## Report trust rules

- Readiness measures evidence coverage, not investment quality or legal certainty.
- The report remains available when evidence is incomplete.
- Missing evidence, assumptions, contradictions, and unresolved risks remain labelled.
- The report must not invent ownership, zoning, value, sale history, building compliance, or development rights.
- Opening the report completes the guided journey, but does not state that all due diligence is complete.
- Adding or removing evidence after opening the report must update the same report view model.

## Full eight-step desktop flow

1. Select property.
2. Confirm property.
3. Add address.
4. Add SG diagram.
5. Check title.
6. Confirm zoning.
7. Add property-check evidence.
8. Add market evidence.
9. Review and open the report.

At every step confirm:

- **Back** opens the previous completed or available step.
- **View all steps** reopens completed earlier steps.
- Editing earlier information does not delete later evidence unless the earlier change invalidates its prerequisites.
- **Skip for now** remains distinct from complete.
- The final report cannot be skipped.
- The Guided resume step is not overwritten by the last Expert workspace tab.

## Invalidation cases

- Mark property identity uncertain after later evidence exists. Dependent steps become blocked without deleting files or evidence.
- Remove the saved working address. Address becomes incomplete without deleting SG, title, zoning, property, or market evidence.
- Remove the matched SG diagram. SG becomes incomplete.
- Remove the matched title document. Title becomes incomplete.
- Change the zoning selection so it conflicts with the document. Zoning becomes incomplete.
- Remove property-check evidence. Property checks become incomplete.
- Remove all market records. Market becomes incomplete.
- Reopen the report after each change and confirm readiness and gaps update.

## Full mobile flow

- The progress display and **View all steps** remain usable.
- Every step works without horizontal scrolling.
- Back, Skip, primary save, upload, importer, and report actions remain reachable.
- Long identifiers, addresses, source names, file names, claims, and listing titles wrap or truncate safely.
- Returning from official portals or the report resumes the correct Guided step.

## Expert mode synchronization

- Address uses the existing market-address store.
- SG, title, zoning, plans, photos, and surveys use the existing Erf File Vault.
- Zoning selection and evidence gate match Expert Zoning & Build.
- Market evidence uses the existing listing importer and `SavedMarketEvidence` store.
- Report readiness and content use the existing master plan and report view model.
- Opening Expert tools never creates a second copy of Guided data.

## Automated verification before merge

Run against the consolidated integration PR:

1. Focused Guided journey, component, zoning, property-check, market, and report tests.
2. Existing listing importer, extraction, file-vault, planning, report, and market-summary tests.
3. Full Vitest suite.
4. TypeScript check.
5. Targeted ESLint for every TypeScript file changed by the Guided integration.
6. Production build.
7. Git diff and generated-file checks.
8. Interactive desktop and mobile pass through all eight steps.

Repository-wide ESLint currently exposes unrelated legacy formatting debt, so the integration workflow intentionally lints the changed Guided files rather than treating pre-existing errors as failures in this PR.

## Integration review

PR #53 is the single draft integration PR against `main`. Earlier stacked PRs #46 through #52 are superseded and closed. Keep PR #53 in draft until automated verification and the interactive desktop and mobile pass are complete.
