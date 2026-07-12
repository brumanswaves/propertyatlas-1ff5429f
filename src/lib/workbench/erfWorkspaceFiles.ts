export const SG_DIAGRAM_MAX_BYTES = 20 * 1024 * 1024;
export const PAID_REPORT_MAX_BYTES = 20 * 1024 * 1024;

const DB_NAME = "erfstoep-workbench-files";
const DB_VERSION = 1;
const STORE_NAME = "attachments";

export type PaidReportProvider = "lightstone" | "windeed";
export type ErfWorkspaceAttachmentKind =
  | "sg-diagram"
  | "paid-report-lightstone"
  | "paid-report-windeed";
export type ErfWorkspaceAttachmentStatus = "uploaded_reference_only";

export interface ErfWorkspaceAttachmentMetadata {
  id: string;
  parcelId: string;
  kind: ErfWorkspaceAttachmentKind;
  provider?: PaidReportProvider;
  status?: ErfWorkspaceAttachmentStatus;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  sourceLabel: string;
}

export interface ErfWorkspaceAttachmentRecord extends ErfWorkspaceAttachmentMetadata {
  file: Blob;
}

export type SgDiagramFileValidation =
  | { ok: true }
  | { ok: false; reason: "too_large" | "unsupported_type" };
export type PaidReportFileValidation =
  | { ok: true }
  | { ok: false; reason: "too_large" | "unsupported_type" };

const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"];
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/tif",
];

export function sgDiagramAttachmentKey(parcelId: string) {
  return `${parcelId}:sg-diagram`;
}

export function sgDiagramAttachmentRecordKey(parcelId: string, attachmentId: string) {
  return `${sgDiagramAttachmentKey(parcelId)}:${attachmentId}`;
}

export function paidReportAttachmentKind(provider: PaidReportProvider): ErfWorkspaceAttachmentKind {
  return provider === "lightstone" ? "paid-report-lightstone" : "paid-report-windeed";
}

export function paidReportAttachmentKey(parcelId: string, provider: PaidReportProvider) {
  return `${parcelId}:${paidReportAttachmentKind(provider)}`;
}

export function paidReportAttachmentRecordKey(
  parcelId: string,
  provider: PaidReportProvider,
  attachmentId: string,
) {
  return `${paidReportAttachmentKey(parcelId, provider)}:${attachmentId}`;
}

export function isTiffAttachment(fileName: string, fileType?: string) {
  const lowerName = fileName.toLowerCase();
  const lowerType = String(fileType ?? "").toLowerCase();
  return lowerName.endsWith(".tif") || lowerName.endsWith(".tiff") || lowerType.includes("tiff");
}

export function isPreviewableImageAttachment(fileName: string, fileType?: string) {
  const lowerName = fileName.toLowerCase();
  const lowerType = String(fileType ?? "").toLowerCase();
  if (isTiffAttachment(fileName, fileType)) return false;
  return (
    lowerType === "image/png" ||
    lowerType === "image/jpeg" ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg")
  );
}

export function isPdfAttachment(fileName: string, fileType?: string) {
  return (
    fileName.toLowerCase().endsWith(".pdf") ||
    String(fileType ?? "").toLowerCase() === "application/pdf"
  );
}

export function validateSgDiagramFile(file: File): SgDiagramFileValidation {
  if (file.size > SG_DIAGRAM_MAX_BYTES) return { ok: false, reason: "too_large" };
  const lowerName = file.name.toLowerCase();
  const lowerType = file.type.toLowerCase();
  const supported =
    ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension)) ||
    ACCEPTED_MIME_TYPES.includes(lowerType);
  return supported ? { ok: true } : { ok: false, reason: "unsupported_type" };
}

export function validatePaidReportFile(file: File): PaidReportFileValidation {
  if (file.size > PAID_REPORT_MAX_BYTES) return { ok: false, reason: "too_large" };
  return isPdfAttachment(file.name, file.type)
    ? { ok: true }
    : { ok: false, reason: "unsupported_type" };
}

function openFilesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local file storage."));
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openFilesDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = work(store);
    let result: T | undefined;
    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error ?? new Error("Local file storage failed."));
    }
    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("Local file storage failed."));
    };
  });
}

export async function saveSgDiagramAttachment(parcelId: string, file: File) {
  const validation = validateSgDiagramFile(file);
  if (!validation.ok) return validation;
  const id = crypto.randomUUID();
  const record: ErfWorkspaceAttachmentRecord = {
    id,
    parcelId,
    kind: "sg-diagram",
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    sourceLabel: "User uploaded SG diagram",
    file,
  };
  await withStore("readwrite", (store) =>
    store.put(record, sgDiagramAttachmentRecordKey(parcelId, id)),
  );
  return { ok: true as const, record };
}

export async function savePaidReportAttachment(
  parcelId: string,
  provider: PaidReportProvider,
  file: File,
) {
  const validation = validatePaidReportFile(file);
  if (!validation.ok) return validation;

  const existing = await readPaidReportAttachments(parcelId, provider);
  await Promise.all(
    existing.map((attachment) => removePaidReportAttachment(parcelId, provider, attachment.id)),
  );

  const id = crypto.randomUUID();
  const sourceLabel =
    provider === "lightstone" ? "User uploaded Lightstone report" : "User uploaded WinDeed report";
  const record: ErfWorkspaceAttachmentRecord = {
    id,
    parcelId,
    kind: paidReportAttachmentKind(provider),
    provider,
    status: "uploaded_reference_only",
    fileName: file.name,
    fileType: file.type || "application/pdf",
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    sourceLabel,
    file,
  };
  await withStore("readwrite", (store) =>
    store.put(record, paidReportAttachmentRecordKey(parcelId, provider, id)),
  );
  return { ok: true as const, record };
}

export async function readSgDiagramAttachment(parcelId: string) {
  const attachments = await readSgDiagramAttachments(parcelId);
  return attachments[0] ?? null;
}

export async function readSgDiagramAttachments(parcelId: string) {
  const prefix = `${sgDiagramAttachmentKey(parcelId)}:`;
  const records =
    (await withStore<ErfWorkspaceAttachmentRecord[]>(
      "readonly",
      (store) => store.getAll() as IDBRequest<ErfWorkspaceAttachmentRecord[]>,
    )) ?? [];

  const normalized = records
    .filter((record) => record?.parcelId === parcelId && record.kind === "sg-diagram")
    .map((record) => ({ ...record, id: record.id || crypto.randomUUID() }));

  const legacy = await withStore<ErfWorkspaceAttachmentRecord>("readonly", (store) =>
    store.get(sgDiagramAttachmentKey(parcelId)),
  );
  if (legacy && !normalized.some((record) => record.fileName === legacy.fileName)) {
    normalized.push({ ...legacy, id: legacy.id || "legacy-sg-diagram" });
  }

  return normalized.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function readPaidReportAttachments(parcelId: string, provider?: PaidReportProvider) {
  const records =
    (await withStore<ErfWorkspaceAttachmentRecord[]>(
      "readonly",
      (store) => store.getAll() as IDBRequest<ErfWorkspaceAttachmentRecord[]>,
    )) ?? [];
  const allowedKinds = provider
    ? [paidReportAttachmentKind(provider)]
    : [paidReportAttachmentKind("lightstone"), paidReportAttachmentKind("windeed")];

  return records
    .filter(
      (record) =>
        record?.parcelId === parcelId &&
        allowedKinds.includes(record.kind) &&
        (!provider || record.provider === provider),
    )
    .map((record) => ({ ...record, id: record.id || crypto.randomUUID() }))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function readPaidReportAttachment(parcelId: string, provider: PaidReportProvider) {
  const attachments = await readPaidReportAttachments(parcelId, provider);
  return attachments[0] ?? null;
}

export async function removeSgDiagramAttachment(parcelId: string, attachmentId?: string) {
  if (!attachmentId) {
    await withStore("readwrite", (store) => store.delete(sgDiagramAttachmentKey(parcelId)));
    return;
  }
  if (attachmentId === "legacy-sg-diagram") {
    await withStore("readwrite", (store) => store.delete(sgDiagramAttachmentKey(parcelId)));
    return;
  }
  await withStore("readwrite", (store) =>
    store.delete(sgDiagramAttachmentRecordKey(parcelId, attachmentId)),
  );
}

export async function removePaidReportAttachment(
  parcelId: string,
  provider: PaidReportProvider,
  attachmentId?: string,
) {
  if (!attachmentId) {
    const existing = await readPaidReportAttachments(parcelId, provider);
    await Promise.all(
      existing.map((attachment) => removePaidReportAttachment(parcelId, provider, attachment.id)),
    );
    return;
  }
  await withStore("readwrite", (store) =>
    store.delete(paidReportAttachmentRecordKey(parcelId, provider, attachmentId)),
  );
}
