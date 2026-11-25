import { createHmac, timingSafeEqual } from 'node:crypto';

export const DOCUMENT_DOWNLOAD_LEASE_MS = 60 * 60 * 1000;

const KEY_PURPOSE = 'union-eyes/document-download-lease/signing-key/v1\0';
const TOKEN_PURPOSE = 'union-eyes/document-download-lease/token/v1\0';
const MAX_TOKEN_CHARS = 4096;
const MAX_PAYLOAD_BYTES = 2048;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,254}$/;
const FINGERPRINT = /^[a-f0-9]{64}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const INPUT_KEYS = ['documentId', 'fingerprint', 'organizationId', 'userId', 'versionId'];
const PAYLOAD_KEYS = [...INPUT_KEYS, 'expiresAt', 'issuedAt', 'version'].sort();
const EXPECTED_KEYS = ['documentId', 'organizationId', 'userId'];

export interface DocumentDownloadLeaseInput {
  organizationId: string;
  userId: string;
  documentId: string;
  versionId: string | null;
  /** SHA-256 of the server-verified artifact and governance snapshot. */
  fingerprint: string;
}

export interface DocumentDownloadLeasePayload extends DocumentDownloadLeaseInput {
  version: 1;
  issuedAt: number;
  expiresAt: number;
}

export class DocumentDownloadLeaseError extends Error {
  constructor(public readonly code: 'INVALID' | 'EXPIRED') {
    super(code === 'EXPIRED' ? 'Document download lease expired' : 'Invalid document download lease');
    this.name = 'DocumentDownloadLeaseError';
  }
}

function invalid(): never {
  throw new DocumentDownloadLeaseError('INVALID');
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys);
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value);
}

function validInput(value: unknown): value is DocumentDownloadLeaseInput {
  if (!exactKeys(value, INPUT_KEYS)) return false;
  return identifier(value.organizationId) && identifier(value.userId) && identifier(value.documentId)
    && (value.versionId === null || identifier(value.versionId))
    && typeof value.fingerprint === 'string' && FINGERPRINT.test(value.fingerprint);
}

function time(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function canonicalPayload(value: DocumentDownloadLeasePayload): string {
  return JSON.stringify({
    version: value.version,
    organizationId: value.organizationId,
    userId: value.userId,
    documentId: value.documentId,
    versionId: value.versionId,
    fingerprint: value.fingerprint,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
  });
}

function signature(encodedPayload: string): Buffer {
  const key = process.env.EVIDENCE_SEAL_KEY;
  if (!key || key.trim().length === 0 || Buffer.byteLength(key, 'utf8') < 32) invalid();
  // The existing evidence key is used only to derive this purpose-specific key.
  const derived = createHmac('sha256', key).update(KEY_PURPOSE).digest();
  try {
    return createHmac('sha256', derived).update(TOKEN_PURPOSE).update(encodedPayload).digest();
  } finally {
    derived.fill(0);
  }
}

function decodeCanonical(value: string): Buffer {
  if (!BASE64URL.test(value)) invalid();
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value) invalid();
  return bytes;
}

/** The caller must obtain the pinned artifact facts through canonical authority. */
export function issueDocumentDownloadLease(
  input: DocumentDownloadLeaseInput,
  options?: { now?: number },
): { token: string; expiresAt: number } {
  if (!validInput(input)) invalid();
  const issuedAt = options?.now ?? Date.now();
  if (!time(issuedAt) || !time(issuedAt + DOCUMENT_DOWNLOAD_LEASE_MS)) invalid();
  const expiresAt = issuedAt + DOCUMENT_DOWNLOAD_LEASE_MS;
  const payload = canonicalPayload({ ...input, version: 1, issuedAt, expiresAt });
  if (Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD_BYTES) invalid();
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  const token = `v1.${encoded}.${signature(encoded).toString('base64url')}`;
  if (token.length > MAX_TOKEN_CHARS) invalid();
  return { token, expiresAt };
}

/** Authentication of this lease never replaces a fresh authority/version check. */
export function verifyDocumentDownloadLease(
  token: string,
  expected: { organizationId: string; userId: string; documentId: string },
  options?: { now?: number },
): DocumentDownloadLeasePayload {
  if (!exactKeys(expected, EXPECTED_KEYS) || !identifier(expected.organizationId)
    || !identifier(expected.userId) || !identifier(expected.documentId)) invalid();
  if (typeof token !== 'string' || token.length > MAX_TOKEN_CHARS) invalid();
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || parts[2].length !== 43) invalid();
  const bytes = decodeCanonical(parts[1]);
  if (bytes.length > MAX_PAYLOAD_BYTES) invalid();
  const presented = decodeCanonical(parts[2]);
  if (presented.length !== 32 || !timingSafeEqual(presented, signature(parts[1]))) invalid();
  let value: unknown;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { invalid(); }
  if (!exactKeys(value, PAYLOAD_KEYS) || value.version !== 1) invalid();
  const input = {
    organizationId: value.organizationId, userId: value.userId, documentId: value.documentId,
    versionId: value.versionId, fingerprint: value.fingerprint,
  };
  if (!validInput(input) || !time(value.issuedAt) || !time(value.expiresAt)
    || value.expiresAt - value.issuedAt !== DOCUMENT_DOWNLOAD_LEASE_MS) invalid();
  const payload: DocumentDownloadLeasePayload = {
    ...input, version: 1, issuedAt: value.issuedAt, expiresAt: value.expiresAt,
  };
  if (Buffer.from(canonicalPayload(payload), 'utf8').toString('base64url') !== parts[1]) invalid();
  if (payload.organizationId !== expected.organizationId || payload.userId !== expected.userId
    || payload.documentId !== expected.documentId) invalid();
  const now = options?.now ?? Date.now();
  if (!time(now) || payload.issuedAt > now) invalid();
  if (now >= payload.expiresAt) throw new DocumentDownloadLeaseError('EXPIRED');
  return payload;
}
