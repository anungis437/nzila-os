export type SignatureEvidenceClass =
  | 'internal_review'
  | 'signature_request'
  | 'provider_issued'
  | 'verified_completed'
  | 'historical_evidence';

const EXTERNAL_PROVIDERS = new Set(['docusign', 'hellosign', 'adobe_sign', 'pandadoc']);
const STORED_TERMINAL = new Set(['signed', 'completed', 'declined', 'voided', 'expired']);

/**
 * Classify a stored signature row.
 * `verified_completed` requires a provider acknowledgment timestamp already on the record.
 * This function does not invent that timestamp or a provider event.
 */
export function classifySignatureEvidence(record: Record<string, unknown>): SignatureEvidenceClass {
  if (record.reviewOnly === true || record.kind === 'internal_review') return 'internal_review';
  const status = typeof record.status === 'string' ? record.status : '';
  const provider = typeof record.provider === 'string' ? record.provider : '';
  const envelope = typeof record.providerEnvelopeId === 'string' && record.providerEnvelopeId.length > 0;
  const acknowledged = record.providerAcknowledgedAt != null && record.providerAcknowledgedAt !== '';
  if (acknowledged && status === 'completed' && envelope && EXTERNAL_PROVIDERS.has(provider)) {
    return 'verified_completed';
  }
  if (STORED_TERMINAL.has(status)) return 'historical_evidence';
  if (envelope && EXTERNAL_PROVIDERS.has(provider)) return 'provider_issued';
  return 'signature_request';
}

function isSignatureDocument(record: Record<string, unknown>): boolean {
  return typeof record.status === 'string' && (
    typeof record.title === 'string'
    || typeof record.fileName === 'string'
    || typeof record.provider === 'string'
    || typeof record.providerEnvelopeId === 'string'
  );
}

const STORAGE_KEYS = new Set([
  'fileUrl',
  'file_url',
  'storageKey',
  'storage_key',
  'contentText',
  'content_text',
  'blobPath',
  'blob_path',
  'signedUrl',
  'signed_url',
  'downloadUrl',
  'download_url',
  'thumbnail_url',
  'thumbnailUrl',
  'url',
]);

/** Drop storage locations and extracted text. Signature status and identity stay. */
export function projectSignaturePayload<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => projectSignaturePayload(item)) as T;
  }
  if (!value || typeof value !== 'object') return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (STORAGE_KEYS.has(key)) continue;
    output[key] = projectSignaturePayload(entry);
  }
  if (isSignatureDocument(output)) {
    output.evidenceClass = classifySignatureEvidence(output);
  }
  return output as T;
}
