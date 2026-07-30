import type {
  ManualVendorInput,
  Vendor,
  VendorAssignment,
  VendorAssignmentInput,
  VendorAssignmentStatus,
  VendorRole,
} from "./types";

const VALID_ROLES: VendorRole[] = [
  "town-planner",
  "architect",
  "builder",
  "land-surveyor",
  "conveyancer",
  "engineer",
  "estate-agent",
  "valuation",
  "environmental",
  "other",
];

const VALID_STATUSES: VendorAssignmentStatus[] = [
  "considering",
  "contacted",
  "quote_requested",
  "quote_received",
  "selected",
  "work_underway",
  "completed",
  "not_using",
];

function newId(prefix: string): string {
  const cryptoObj = typeof crypto !== "undefined" ? crypto : undefined;
  if (cryptoObj && "randomUUID" in cryptoObj) return `${prefix}_${cryptoObj.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function trimOrNull(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function coerceRole(value: unknown): VendorRole {
  return typeof value === "string" && (VALID_ROLES as string[]).includes(value)
    ? (value as VendorRole)
    : "other";
}

function coerceStatus(value: unknown): VendorAssignmentStatus {
  return typeof value === "string" && (VALID_STATUSES as string[]).includes(value)
    ? (value as VendorAssignmentStatus)
    : "considering";
}

export function createVendorRecord(input: ManualVendorInput): Vendor {
  const now = new Date().toISOString();
  return {
    id: newId("vendor"),
    name: trimOrNull(input.name, 200) ?? "Unnamed contact",
    company: trimOrNull(input.company, 200),
    role: coerceRole(input.role),
    phone: trimOrNull(input.phone, 60),
    email: trimOrNull(input.email, 200),
    website: trimOrNull(input.website, 300),
    serviceArea: trimOrNull(input.serviceArea, 200),
    source: trimOrNull(input.source, 120),
    notes: trimOrNull(input.notes, 2000),
    originPlaceId: trimOrNull(input.originPlaceId, 200),
    createdAt: now,
    updatedAt: now,
  };
}

/** Adds a vendor to the directory, or returns the existing record if it already exists. */
export function upsertVendorInDirectory(
  directory: Vendor[],
  input: ManualVendorInput,
): { directory: Vendor[]; vendor: Vendor } {
  if (input.originPlaceId) {
    const existing = directory.find((vendor) => vendor.originPlaceId === input.originPlaceId);
    if (existing) return { directory, vendor: existing };
  }
  const vendor = createVendorRecord(input);
  return { directory: [...directory, vendor], vendor };
}

export function updateVendorInDirectory(
  directory: Vendor[],
  vendorId: string,
  patch: Partial<ManualVendorInput>,
): Vendor[] {
  return directory.map((vendor) => {
    if (vendor.id !== vendorId) return vendor;
    return {
      ...vendor,
      name: patch.name !== undefined ? (trimOrNull(patch.name, 200) ?? vendor.name) : vendor.name,
      company: patch.company !== undefined ? trimOrNull(patch.company, 200) : vendor.company,
      role: patch.role !== undefined ? coerceRole(patch.role) : vendor.role,
      phone: patch.phone !== undefined ? trimOrNull(patch.phone, 60) : vendor.phone,
      email: patch.email !== undefined ? trimOrNull(patch.email, 200) : vendor.email,
      website: patch.website !== undefined ? trimOrNull(patch.website, 300) : vendor.website,
      serviceArea:
        patch.serviceArea !== undefined ? trimOrNull(patch.serviceArea, 200) : vendor.serviceArea,
      source: patch.source !== undefined ? trimOrNull(patch.source, 120) : vendor.source,
      notes: patch.notes !== undefined ? trimOrNull(patch.notes, 2000) : vendor.notes,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function deleteVendorFromDirectory(directory: Vendor[], vendorId: string): Vendor[] {
  return directory.filter((vendor) => vendor.id !== vendorId);
}

export function coerceVendor(value: unknown): Vendor | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<Vendor>;
  const name = trimOrNull(raw.name, 200);
  const id = trimOrNull(raw.id, 120);
  if (!name || !id) return null;
  const now = new Date().toISOString();
  return {
    id,
    name,
    company: trimOrNull(raw.company, 200),
    role: coerceRole(raw.role),
    phone: trimOrNull(raw.phone, 60),
    email: trimOrNull(raw.email, 200),
    website: trimOrNull(raw.website, 300),
    serviceArea: trimOrNull(raw.serviceArea, 200),
    source: trimOrNull(raw.source, 120),
    notes: trimOrNull(raw.notes, 2000),
    originPlaceId: trimOrNull(raw.originPlaceId, 200),
    createdAt: trimOrNull(raw.createdAt, 80) ?? now,
    updatedAt: trimOrNull(raw.updatedAt, 80) ?? now,
  };
}

export function coerceVendorDirectory(value: unknown): Vendor[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const vendor = coerceVendor(item);
    return vendor ? [vendor] : [];
  });
}

export function createAssignmentRecord(
  vendorId: string,
  parcelId: string,
  input: VendorAssignmentInput & { roleOnProperty: VendorRole },
): VendorAssignment {
  const now = new Date().toISOString();
  return {
    id: newId("assignment"),
    vendorId,
    parcelId,
    roleOnProperty: coerceRole(input.roleOnProperty),
    status: input.status ? coerceStatus(input.status) : "considering",
    scopeOfWork: trimOrNull(input.scopeOfWork, 2000),
    quoteAmount: typeof input.quoteAmount === "number" ? input.quoteAmount : null,
    quoteDate: trimOrNull(input.quoteDate, 40),
    quoteNotes: trimOrNull(input.quoteNotes, 2000),
    nextFollowUpDate: trimOrNull(input.nextFollowUpDate, 40),
    propertyNotes: trimOrNull(input.propertyNotes, 2000),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Assigns a saved vendor to a parcel. If the vendor is already assigned to
 * this parcel, the existing assignment is updated in place rather than
 * creating a duplicate assignment record.
 */
export function assignVendorToParcel(
  assignments: VendorAssignment[],
  vendorId: string,
  parcelId: string,
  input: VendorAssignmentInput & { roleOnProperty: VendorRole },
): { assignments: VendorAssignment[]; assignment: VendorAssignment } {
  const existing = assignments.find(
    (assignment) => assignment.vendorId === vendorId && assignment.parcelId === parcelId,
  );
  if (existing) {
    const updated = updateAssignment(assignments, existing.id, input);
    const assignment = updated.find((item) => item.id === existing.id) as VendorAssignment;
    return { assignments: updated, assignment };
  }
  const assignment = createAssignmentRecord(vendorId, parcelId, input);
  return { assignments: [...assignments, assignment], assignment };
}

export function updateAssignment(
  assignments: VendorAssignment[],
  assignmentId: string,
  patch: VendorAssignmentInput,
): VendorAssignment[] {
  return assignments.map((assignment) => {
    if (assignment.id !== assignmentId) return assignment;
    return {
      ...assignment,
      roleOnProperty:
        patch.roleOnProperty !== undefined
          ? coerceRole(patch.roleOnProperty)
          : assignment.roleOnProperty,
      status: patch.status !== undefined ? coerceStatus(patch.status) : assignment.status,
      scopeOfWork:
        patch.scopeOfWork !== undefined
          ? trimOrNull(patch.scopeOfWork, 2000)
          : assignment.scopeOfWork,
      quoteAmount:
        patch.quoteAmount !== undefined
          ? typeof patch.quoteAmount === "number"
            ? patch.quoteAmount
            : null
          : assignment.quoteAmount,
      quoteDate:
        patch.quoteDate !== undefined ? trimOrNull(patch.quoteDate, 40) : assignment.quoteDate,
      quoteNotes:
        patch.quoteNotes !== undefined
          ? trimOrNull(patch.quoteNotes, 2000)
          : assignment.quoteNotes,
      nextFollowUpDate:
        patch.nextFollowUpDate !== undefined
          ? trimOrNull(patch.nextFollowUpDate, 40)
          : assignment.nextFollowUpDate,
      propertyNotes:
        patch.propertyNotes !== undefined
          ? trimOrNull(patch.propertyNotes, 2000)
          : assignment.propertyNotes,
      updatedAt: new Date().toISOString(),
    };
  });
}

/** Records a received quote and moves the assignment status forward. */
export function recordQuote(
  assignments: VendorAssignment[],
  assignmentId: string,
  quote: { quoteAmount: number | null; quoteDate: string | null; quoteNotes?: string | null },
): VendorAssignment[] {
  return updateAssignment(assignments, assignmentId, {
    status: "quote_received",
    quoteAmount: quote.quoteAmount,
    quoteDate: quote.quoteDate,
    quoteNotes: quote.quoteNotes,
  });
}

export function markAssignmentSelected(
  assignments: VendorAssignment[],
  assignmentId: string,
): VendorAssignment[] {
  return updateAssignment(assignments, assignmentId, { status: "selected" });
}

/** Removes the assignment from this property only; the saved vendor record is untouched. */
export function removeAssignment(
  assignments: VendorAssignment[],
  assignmentId: string,
): VendorAssignment[] {
  return assignments.filter((assignment) => assignment.id !== assignmentId);
}

export function coerceAssignment(value: unknown, parcelId: string): VendorAssignment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<VendorAssignment>;
  const id = trimOrNull(raw.id, 120);
  const vendorId = trimOrNull(raw.vendorId, 120);
  if (!id || !vendorId) return null;
  const now = new Date().toISOString();
  return {
    id,
    vendorId,
    parcelId,
    roleOnProperty: coerceRole(raw.roleOnProperty),
    status: coerceStatus(raw.status),
    scopeOfWork: trimOrNull(raw.scopeOfWork, 2000),
    quoteAmount: typeof raw.quoteAmount === "number" ? raw.quoteAmount : null,
    quoteDate: trimOrNull(raw.quoteDate, 40),
    quoteNotes: trimOrNull(raw.quoteNotes, 2000),
    nextFollowUpDate: trimOrNull(raw.nextFollowUpDate, 40),
    propertyNotes: trimOrNull(raw.propertyNotes, 2000),
    createdAt: trimOrNull(raw.createdAt, 80) ?? now,
    updatedAt: trimOrNull(raw.updatedAt, 80) ?? now,
  };
}

export function coerceAssignmentList(value: unknown, parcelId: string): VendorAssignment[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      const assignment = coerceAssignment(item, parcelId);
      return assignment ? [assignment] : [];
    })
    .filter((assignment) => assignment.parcelId === parcelId);
}
