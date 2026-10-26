/**
 * Untrusted-upload handling for referral intake. Everything about an upload
 * that the sender controls (filename, declared type, declared class, embedded
 * text) is data, never instruction, and never a classification.
 */
export type UploadFlag =
  | 'MIME_MISMATCH'
  | 'ENCRYPTED_OR_PASSWORD_PROTECTED'
  | 'POLYGLOT_SUSPECTED'
  | 'OVERSIZE'
  | 'EMPTY'
  | 'UNKNOWN_SIGNATURE'
  | 'INSTRUCTION_LIKE_TEXT_IN_METADATA'
  | 'CLASS_CLAIM_IGNORED';

export interface UploadInput {
  readonly filename: string;
  readonly declaredMime: string;
  /** Classification asserted by the uploader. Always ignored. */
  readonly declaredClass?: string;
  readonly header: Uint8Array;
  readonly tail?: Uint8Array;
  readonly sizeBytes: number;
  readonly maxBytes: number;
}

export interface UploadAssessment {
  readonly dataClass: 'QUARANTINED';
  readonly verdict: 'SCAN_PENDING' | 'NEEDS_CORRECTION' | 'REJECTED';
  readonly sniffedType: 'pdf' | 'png' | 'jpeg' | 'zip' | 'unknown';
  readonly flags: readonly UploadFlag[];
  /** Sanitized display text. Rendered as inert data only. */
  readonly displayName: string;
  /** Uploaded never means verified. */
  readonly verified: false;
}

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);
const ascii = (b: Uint8Array) => Array.from(b, (c) => (c >= 32 && c < 127 ? String.fromCharCode(c) : ' ')).join('');

function containsSignature(bytes: Uint8Array, sig: number[]): boolean {
  for (let i = 0; i + sig.length <= bytes.length; i++) {
    if (sig.every((v, j) => bytes[i + j] === v)) return true;
  }
  return false;
}

export function sniffType(header: Uint8Array): UploadAssessment['sniffedType'] {
  if (startsWith(header, [0x25, 0x50, 0x44, 0x46])) return 'pdf';
  if (startsWith(header, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (startsWith(header, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(header, [0x50, 0x4b, 0x03, 0x04])) return 'zip';
  return 'unknown';
}

const MIME_FOR: Record<UploadAssessment['sniffedType'], string[]> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpeg: ['image/jpeg'],
  zip: ['application/zip'],
  unknown: [],
};

const INSTRUCTION_LIKE = /(ignore (all|previous)|disregard|system prompt|you are now|approve this|release (this )?document|mark (as )?(complete|approved))/i;

export function sanitizeDisplayText(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 120);
}

export function assessUpload(u: UploadInput): UploadAssessment {
  const flags: UploadFlag[] = [];
  const sniffed = sniffType(u.header);
  if (u.sizeBytes === 0) flags.push('EMPTY');
  if (u.sizeBytes > u.maxBytes) flags.push('OVERSIZE');
  if (sniffed === 'unknown') flags.push('UNKNOWN_SIGNATURE');
  else if (!MIME_FOR[sniffed].includes(u.declaredMime.toLowerCase())) flags.push('MIME_MISMATCH');

  if (sniffed === 'pdf') {
    const scan = ascii(u.header) + ' ' + ascii(u.tail ?? new Uint8Array());
    if (/\/Encrypt\b/.test(scan)) flags.push('ENCRYPTED_OR_PASSWORD_PROTECTED');
    if (containsSignature(u.tail ?? new Uint8Array(), [0x50, 0x4b, 0x03, 0x04])) flags.push('POLYGLOT_SUSPECTED');
  }
  if (INSTRUCTION_LIKE.test(u.filename)) flags.push('INSTRUCTION_LIKE_TEXT_IN_METADATA');
  if (u.declaredClass) flags.push('CLASS_CLAIM_IGNORED');

  const reject = flags.includes('OVERSIZE') || flags.includes('EMPTY');
  const correct = flags.some((f) => ['MIME_MISMATCH', 'ENCRYPTED_OR_PASSWORD_PROTECTED', 'POLYGLOT_SUSPECTED', 'UNKNOWN_SIGNATURE'].includes(f));
  return {
    dataClass: 'QUARANTINED',
    verdict: reject ? 'REJECTED' : correct ? 'NEEDS_CORRECTION' : 'SCAN_PENDING',
    sniffedType: sniffed,
    flags,
    displayName: sanitizeDisplayText(u.filename),
    verified: false,
  };
}

/** Classification is only ever set by an authorized human, never by upload metadata or content. */
export const CONTENT_MAY_SET_CLASSIFICATION = false as const;
