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

/**
 * What the server answers after it has received a file (POST /api/documents/upload with canonicalIntake=1, or
 * POST /api/documents/intakes). The intake id is the only handle: there is no storage path to hold, send or delete.
 */
export type CanonicalIntake = {
  intakeId: string;
  checksum: string;
  size: number;
  mimeType: string;
  filename: string;
  expiresAt: string;
};

/** Intake is the server's receipt. A document row, a storage path or a URL is not an intake. */
export function readCanonicalIntake(body: unknown): CanonicalIntake | null {
  if (!body || typeof body !== 'object') return null;
  const envelope = body as Record<string, unknown>;
  const source = envelope.data && typeof envelope.data === 'object' ? (envelope.data as Record<string, unknown>) : envelope;
  for (const forbidden of ['url', 'fileUrl', 'downloadUrl', 'blobPath', 'storageKey', 'contentText']) {
    if (forbidden in source) return null;
  }
  const intakeId = source.intakeId;
  const checksum = source.checksum;
  const filename = source.filename;
  const mimeType = source.mimeType;
  const size = source.size;
  const expiresAt = source.expiresAt;
  if (typeof intakeId !== 'string' || !UUID.test(intakeId)) return null;
  if (typeof checksum !== 'string' || typeof filename !== 'string' || typeof expiresAt !== 'string') return null;
  if (typeof mimeType !== 'string' || typeof size !== 'number' || !Number.isFinite(size)) return null;
  return { intakeId, checksum, size, mimeType, filename, expiresAt };
}

export function repositoryIntakePayload(intake: CanonicalIntake, privacyLabel: string) {
  return {
    title: intake.filename,
    filename: intake.filename,
    intakeId: intake.intakeId,
    documentType: 'ocr_upload',
    privacyLabel,
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
  | { kind: 'review'; text: string; revisionNo: number | null }
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
  const revisionNo = typeof record.revisionNo === 'number' && Number.isInteger(record.revisionNo) ? record.revisionNo : null;
  return { kind: 'review', text: record.text, revisionNo };
}

export type TranscriptSaveResult =
  | { kind: 'saved'; revisionNo: number }
  | { kind: 'stale' }
  | { kind: 'denied' }
  | { kind: 'failed' };

/**
 * A correction is saved as a human draft revision (PUT /api/documents/[id]/transcript). It is not reviewed and it is not
 * evidence; the screen never claims otherwise, and a stale edit is reported rather than overwritten.
 */
export function interpretTranscriptSave(status: number, body: unknown): TranscriptSaveResult {
  if (status === 409) return { kind: 'stale' };
  if (status === 401 || status === 403 || status === 404) return { kind: 'denied' };
  if (status !== 200 || !body || typeof body !== 'object') return { kind: 'failed' };
  const data = (body as { data?: unknown }).data;
  const revision = data && typeof data === 'object' ? (data as { revision?: unknown }).revision : null;
  const revisionNo = revision && typeof revision === 'object' ? (revision as { revisionNo?: unknown }).revisionNo : null;
  if (typeof revisionNo !== 'number' || !Number.isInteger(revisionNo)) return { kind: 'failed' };
  return { kind: 'saved', revisionNo };
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
      notSaved: 'Le document n a pas ete enregistre. Les objets stockes ne peuvent pas etre supprimes depuis cet ecran.',
      transcript: 'Correction enregistree comme brouillon de revision. Elle n est ni examinee ni une preuve.',
      transcriptStale: 'La transcription a change depuis son chargement. Rechargez avant de corriger.',
      transcriptDenied: 'Vous n avez pas l autorisation de modifier cette transcription.',
      transcriptFailed: 'La correction n a pas ete enregistree. Le texte original est inchange.',
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
    notSaved: 'The document was not saved. Stored objects cannot be deleted from this screen.',
    transcript: 'Correction saved as a draft revision. It is not reviewed and not evidence.',
    transcriptStale: 'The transcript changed since it was loaded. Reload before correcting.',
    transcriptDenied: 'You do not have permission to change this transcript.',
    transcriptFailed: 'The correction was not saved. The extracted text is unchanged.',
    cancel: 'Cancel',
    cancelled: 'Processing cancelled.',
    retry: 'Retry',
    save: 'Save correction',
    duplicate: 'This file is already being processed.',
    folder: 'The requested folder is not a field on the canonical repository.',
    limitation: 'OCR text, the correction, and the original document stay separate.',
  };
}
