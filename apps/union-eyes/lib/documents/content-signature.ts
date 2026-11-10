/**
 * Server-side check that a received file is the type it is declared to be, read from its bytes, not from the name or the
 * Content-Type the client sent. Only types whose content can be recognized are admitted for an outside party's upload:
 * archives (zip, rar), whose contents are not inspected here, and SVG, which carries script, are refused.
 * DEF-0B8-FED-EXTERNAL-UPLOAD-CLIENT-CLAIMED-TYPE-SIZE-NO-SCAN-WHOLE-BLOB-READ.
 */

export const EXTERNAL_UPLOAD_MIME_TYPES = [
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
] as const;

export type ExternalUploadMimeType = (typeof EXTERNAL_UPLOAD_MIME_TYPES)[number];

const startsWith = (bytes: Buffer, signature: number[] | string, offset = 0): boolean => {
  const expected = typeof signature === 'string' ? Buffer.from(signature, 'latin1') : Buffer.from(signature);
  return bytes.length >= offset + expected.length && bytes.subarray(offset, offset + expected.length).equals(expected);
};

const OLE_COMPOUND = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP_LOCAL_HEADER = [0x50, 0x4b, 0x03, 0x04];

/** An Office Open XML package: a zip whose entries include [Content_Types].xml and the part folder of the declared application. */
const isOoxml = (bytes: Buffer, partFolder: string): boolean =>
  startsWith(bytes, ZIP_LOCAL_HEADER) && bytes.includes('[Content_Types].xml', 0, 'latin1') && bytes.includes(partFolder, 0, 'latin1');

/** Text: no NUL byte and valid UTF-8. */
const isText = (bytes: Buffer): boolean => {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
};

const MATCHES: Record<ExternalUploadMimeType, (bytes: Buffer) => boolean> = {
  'application/pdf': (b) => startsWith(b, '%PDF-'),
  // The three legacy Office formats share one container format; its signature is what can be checked.
  'application/msword': (b) => startsWith(b, OLE_COMPOUND),
  'application/vnd.ms-excel': (b) => startsWith(b, OLE_COMPOUND),
  'application/vnd.ms-powerpoint': (b) => startsWith(b, OLE_COMPOUND),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (b) => isOoxml(b, 'word/'),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (b) => isOoxml(b, 'xl/'),
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': (b) => isOoxml(b, 'ppt/'),
  'text/plain': isText,
  'text/csv': isText,
  'image/jpeg': (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  'image/png': (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/gif': (b) => startsWith(b, 'GIF87a') || startsWith(b, 'GIF89a'),
  'image/webp': (b) => startsWith(b, 'RIFF') && startsWith(b, 'WEBP', 8),
};

export type ContentTypeCheck =
  | { ok: true; mimeType: ExternalUploadMimeType }
  | { ok: false; reason: 'type_not_allowed' | 'content_mismatch' };

/** Whether the bytes are of the declared type, which must be one admitted for an outside party's upload. */
export function verifyDeclaredContentType(bytes: Buffer, declared: string): ContentTypeCheck {
  if (!(EXTERNAL_UPLOAD_MIME_TYPES as readonly string[]).includes(declared)) return { ok: false, reason: 'type_not_allowed' };
  const mimeType = declared as ExternalUploadMimeType;
  return MATCHES[mimeType](bytes) ? { ok: true, mimeType } : { ok: false, reason: 'content_mismatch' };
}
