/** Upload limit shared with the intake route. Bytes above this are not sent to a processor. */
export const OCR_MAX_BYTES = 50 * 1024 * 1024;

/** Temporary extract cap. Overflow is discarded and never logged. */
export const OCR_MAX_EXTRACT_CHARS = 200_000;

export type OcrDispatchKind = 'image' | 'pdf' | 'text' | 'unsupported';

function startsWith(buffer: Buffer, signature: string | number[]): boolean {
  const bytes = typeof signature === 'string' ? Buffer.from(signature, 'latin1') : Buffer.from(signature);
  if (buffer.length < bytes.length) return false;
  return buffer.subarray(0, bytes.length).equals(bytes);
}

function isWebp(buffer: Buffer): boolean {
  return buffer.length >= 12
    && buffer.subarray(0, 4).toString('latin1') === 'RIFF'
    && buffer.subarray(8, 12).toString('latin1') === 'WEBP';
}

function looksLikeText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 8192);
  return sample.length > 0 && !sample.includes(0);
}

/**
 * Choose a processor from the bytes. A filename or browser MIME wins only when
 * the bytes have no container or document signature.
 */
export function ocrDispatchKind(buffer: Buffer, declaredMime: string, declaredFileType: string): OcrDispatchKind {
  if (buffer.length === 0 || buffer.length > OCR_MAX_BYTES) return 'unsupported';
  if (startsWith(buffer, '%PDF')) return 'pdf';
  if (
    startsWith(buffer, [0x89, 0x50, 0x4e, 0x47])
    || startsWith(buffer, [0xff, 0xd8, 0xff])
    || startsWith(buffer, 'GIF8')
    || isWebp(buffer)
  ) {
    return 'image';
  }
  if (startsWith(buffer, 'PK') || startsWith(buffer, 'Rar!')) return 'unsupported';

  const mime = declaredMime.toLowerCase();
  const fileType = declaredFileType.toLowerCase();
  if (!looksLikeText(buffer)) return 'unsupported';
  if (mime.startsWith('image/') && !mime.includes('svg')) return 'image';
  if (
    mime.startsWith('text/')
    || mime.includes('json')
    || fileType === 'txt'
    || fileType === 'csv'
    || fileType === 'json'
  ) {
    return 'text';
  }
  if (mime.includes('pdf') || fileType === 'pdf') return 'text';
  return 'unsupported';
}

export function boundExtractedText(text: string): { text: string; truncated: boolean } {
  if (text.length <= OCR_MAX_EXTRACT_CHARS) return { text, truncated: false };
  return { text: text.slice(0, OCR_MAX_EXTRACT_CHARS), truncated: true };
}
