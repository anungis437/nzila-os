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
  return output as T;
}
