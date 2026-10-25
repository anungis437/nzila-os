/**
 * OCR intake rules. Extracted text is untrusted. A list row, a blob path, and a
 * privacy label are not interchangeable, and none of them is a legal fact.
 */

export const OCR_MAX_BYTES = 50 * 1024 * 1024;

export const OCR_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
] as const;

export const OCR_PRIVACY_LABELS = [
  'public_internal',
  'team_confidential',
  'lro_confidential',
  'privileged',
  'case_restricted',
  'highly_sensitive',
] as const;

export type OcrPrivacyLabel = (typeof OCR_PRIVACY_LABELS)[number];

export type UploadAssessment =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'oversize' | 'unsupported' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assessUpload(file: { name: string; size: number; type: string }): UploadAssessment {
  if (!file.name || file.size <= 0) return { ok: false, reason: 'empty' };
  if (file.size > OCR_MAX_BYTES) return { ok: false, reason: 'oversize' };
  if (!(OCR_MIME_TYPES as readonly string[]).includes(file.type)) return { ok: false, reason: 'unsupported' };
  return { ok: true };
}

/** Server-side discard is allowed only for this organization's blob prefix. */
export function isDiscardableBlobPath(path: string, organizationId: string): boolean {
  if (!organizationId || organizationId.includes('/') || organizationId.includes('..')) return false;
  if (!path || path.includes('..') || path.includes('\\') || path.includes('://') || path.startsWith('/')) return false;
  const prefix = `documents/${organizationId}/`;
  return path.startsWith(prefix) && path.length > prefix.length;
}

export type CanonicalIntake = {
  blobPath: string;
  checksum: string;
  size: number;
  mimeType: string;
  filename: string;
};

/** Intake is the blob contract only. A document row or a storage URL is not intake. */
export function readCanonicalIntake(body: unknown): CanonicalIntake | null {
  if (!body || typeof body !== 'object') return null;
  const source = body as Record<string, unknown>;
  if ('url' in source || 'fileUrl' in source || 'downloadUrl' in source || 'id' in source || 'contentText' in source) {
    return null;
  }
  const blobPath = source.blobPath;
  const checksum = source.checksum;
  const filename = source.filename;
  const mimeType = source.mimeType;
  const size = source.size;
  if (typeof blobPath !== 'string' || typeof checksum !== 'string' || typeof filename !== 'string') return null;
  if (typeof mimeType !== 'string' || typeof size !== 'number' || !Number.isFinite(size)) return null;
  return { blobPath, checksum, size, mimeType, filename };
}

export function repositoryIntakePayload(intake: CanonicalIntake, privacyLabel: string) {
  return {
    title: intake.filename,
    filename: intake.filename,
    blobPath: intake.blobPath,
    documentType: 'ocr_upload',
    mimeType: intake.mimeType,
    privacyLabel,
    fileSize: intake.size,
  };
}

export type CreatedDocumentRef = {
  id: string;
  title: string | null;
  documentType: string | null;
  privacyLabel: string | null;
};

/** Keep the identifier and classification. Drop storage URLs and extracted text. */
export function readCreatedDocument(body: unknown): CreatedDocumentRef | null {
  if (!body || typeof body !== 'object') return null;
  const source = body as Record<string, unknown>;
  const row = source.data && typeof source.data === 'object' ? (source.data as Record<string, unknown>) : source;
  const id = row.id;
  if (typeof id !== 'string' || !UUID.test(id)) return null;
  return {
    id,
    title: typeof row.title === 'string' ? row.title : null,
    documentType: typeof row.documentType === 'string' ? row.documentType : null,
    privacyLabel: typeof row.privacyLabel === 'string' ? row.privacyLabel : null,
  };
}

export type OcrInterpretation =
  | { kind: 'review'; text: string }
  | { kind: 'unavailable' }
  | { kind: 'denied' }
  | { kind: 'failed' };

/**
 * OCR text is a review draft. A persisted or authoritative flag from the response
 * is not accepted as a legal record.
 */
export function interpretOcr(status: number, body: unknown): OcrInterpretation {
  if (status === 501) return { kind: 'unavailable' };
  if (status === 401 || status === 403 || status === 404) return { kind: 'denied' };
  if (status !== 200 || !body || typeof body !== 'object') return { kind: 'failed' };
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return { kind: 'failed' };
  const record = data as Record<string, unknown>;
  if (record.persisted === true || record.authoritative === true) return { kind: 'failed' };
  if (typeof record.text !== 'string') return { kind: 'failed' };
  if ('blobPath' in record || 'fileUrl' in record || 'contentText' in record) return { kind: 'failed' };
  return { kind: 'review', text: record.text };
}

export function transcriptSaveUnavailable(): { accepted: false; reason: 'ocr-transcript-persistence' } {
  return { accepted: false, reason: 'ocr-transcript-persistence' };
}

export function ocrCopy(locale: string) {
  const french = locale.toLowerCase().startsWith('fr');
  if (french) {
    return {
      title: 'Versement OCR',
      classification: 'Classification',
      chooseClassification: 'Choisissez une classification avant le versement.',
      choose: 'Choisir ou capturer un document',
      empty: 'Le fichier est vide.',
      oversize: 'Le fichier depasse 50 Mo.',
      unsupported: 'Ce type de fichier n est pas accepte.',
      uploading: 'Versement autorise en cours.',
      saved: 'Le document canonique est enregistre. Le texte OCR n est pas une preuve.',
      processing: 'Extraction en cours.',
      review: 'Texte extrait non verifie. Il ne devient pas une preuve.',
      noText: 'Aucun texte extrait. Ce n est pas un enregistrement verifie.',
      unavailable: 'Le moteur OCR n est pas disponible pour ce fichier.',
      denied: 'Vous n avez pas l autorisation de traiter ce document.',
      failed: 'Le traitement OCR a echoue. Le document enregistre reste inchange.',
      transcript: 'La transcription corrigee ne peut pas etre enregistree. Aucune ecriture canonique n existe pour ce texte.',
      cancel: 'Annuler',
      cancelled: 'Traitement annule.',
      retry: 'Reessayer',
      save: 'Enregistrer la correction',
      duplicate: 'Ce fichier est deja en cours de traitement.',
      folder: 'Le dossier demande n est pas un champ du referentiel canonique.',
      limitation: 'Le texte OCR, la correction et le document original restent distincts.',
    };
  }
  return {
    title: 'OCR upload',
    classification: 'Classification',
    chooseClassification: 'Choose a classification before upload.',
    choose: 'Choose or capture a document',
    empty: 'The file is empty.',
    oversize: 'The file is larger than 50 MB.',
    unsupported: 'This file type is not accepted.',
    uploading: 'Authorized upload in progress.',
    saved: 'The canonical document is saved. OCR text is not evidence.',
    processing: 'Extraction in progress.',
    review: 'Unverified extracted text. It does not become evidence.',
    noText: 'No text was extracted. This is not a verified record.',
    unavailable: 'OCR is not available for this file.',
    denied: 'You do not have permission to process this document.',
    failed: 'OCR processing failed. The saved document was left unchanged.',
    transcript: 'The corrected transcription cannot be saved. There is no canonical write for that text.',
    cancel: 'Cancel',
    cancelled: 'Processing cancelled.',
    retry: 'Retry',
    save: 'Save correction',
    duplicate: 'This file is already being processed.',
    folder: 'The requested folder is not a field on the canonical repository.',
    limitation: 'OCR text, the correction, and the original document stay separate.',
  };
}
