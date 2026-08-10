export interface SavedPropertyRecord {
  userData: unknown;
  externalLinks: unknown;
}

export interface SavedPropertyPersistenceInput {
  userId: string;
  parcelId: string;
  userData: Record<string, unknown>;
  externalLinks: unknown;
  readExisting: () => Promise<SavedPropertyRecord | null>;
  write: (record: {
    userId: string;
    parcelId: string;
    userData: Record<string, unknown>;
    externalLinks: unknown;
  }) => Promise<void>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Saves by the user/parcel conflict key while preserving unrelated user-data namespaces. */
export async function persistSavedProperty(input: SavedPropertyPersistenceInput) {
  const existing = await input.readExisting();
  await input.write({
    userId: input.userId,
    parcelId: input.parcelId,
    userData: { ...record(existing?.userData), ...input.userData },
    externalLinks: existing?.externalLinks ?? input.externalLinks,
  });
}
