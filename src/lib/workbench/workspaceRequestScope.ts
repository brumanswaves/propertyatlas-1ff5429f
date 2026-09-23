/** A single mounted selection lifetime, not just an owner/parcel comparison. */
export interface WorkspaceRequestScope {
  userId: string;
  signal: AbortSignal;
  assertCurrent: () => void;
}
