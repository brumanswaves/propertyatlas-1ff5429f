/**
 * Registers an SG preview settlement promise with the report print lifecycle.
 * Kept outside the React component module so Fast Refresh sees component-only exports.
 */
export function registerSgPreviewSettlement(
  onPreviewSettlement: ((settlement: Promise<void>) => void) | undefined,
  settlement: Promise<void>,
) {
  onPreviewSettlement?.(settlement);
}
