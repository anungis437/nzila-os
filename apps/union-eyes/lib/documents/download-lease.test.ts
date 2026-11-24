import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DOCUMENT_DOWNLOAD_LEASE_MS,
  DocumentDownloadLeaseError,
  issueDocumentDownloadLease,
  verifyDocumentDownloadLease,
  type DocumentDownloadLeaseInput,
} from './download-lease';

const KEY = 'explicit-synthetic-document-download-lease-key-20261123';
const NOW = Date.parse('2026-11-23T22:00:00.000Z');
const input: DocumentDownloadLeaseInput = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  documentId: '33333333-3333-4333-8333-333333333333',
  versionId: '44444444-4444-4444-8444-444444444444',
  fingerprint: 'a'.repeat(64),
};
const expected = { organizationId: input.organizationId, userId: input.userId, documentId: input.documentId };

function code(operation: () => unknown, wanted: 'INVALID' | 'EXPIRED' = 'INVALID') {
  try { operation(); } catch (error) {
    expect(error).toBeInstanceOf(DocumentDownloadLeaseError);
    expect((error as DocumentDownloadLeaseError).code).toBe(wanted);
    expect((error as Error).message).not.toContain(KEY);
    return;
  }
  throw new Error('Expected a safe lease refusal');
}

// Adversarial producer independent of issueDocumentDownloadLease: a valid MAC
// must not make a malformed, noncanonical or extended payload acceptable.
function signRaw(json: string, key = KEY, purpose = 'union-eyes/document-download-lease/token/v1\0') {
  const encoded = Buffer.from(json, 'utf8').toString('base64url');
  const derived = createHmac('sha256', key).update('union-eyes/document-download-lease/signing-key/v1\0').digest();
  const signature = createHmac('sha256', derived).update(purpose).update(encoded).digest('base64url');
  return `v1.${encoded}.${signature}`;
}
function originalPayload() {
  return { version: 1, ...input, issuedAt: NOW, expiresAt: NOW + DOCUMENT_DOWNLOAD_LEASE_MS };
}

beforeEach(() => vi.stubEnv('EVIDENCE_SEAL_KEY', KEY));
afterEach(() => vi.unstubAllEnvs());

describe('document download leases', () => {
  it('binds the actor, organization, document, exact version and artifact fingerprint without blob paths or SAS', () => {
    const { token, expiresAt } = issueDocumentDownloadLease(input, { now: NOW });
    const payload = verifyDocumentDownloadLease(token, expected, { now: NOW });
    expect(payload).toEqual(originalPayload());
    expect(expiresAt).toBe(NOW + 3_600_000);
    expect(token.split('.')).toHaveLength(3);
    expect(JSON.stringify(payload)).not.toMatch(/blobPath|downloadUrl|fileUrl|sig=|@|https?:/);
  });

  it('preserves a null version pin for a server-verified legacy artifact', () => {
    const { token } = issueDocumentDownloadLease({ ...input, versionId: null }, { now: NOW });
    expect(verifyDocumentDownloadLease(token, expected, { now: NOW }).versionId).toBeNull();
  });

  it('never renews the original one-hour expiry when the same token is verified again', () => {
    const { token, expiresAt } = issueDocumentDownloadLease(input, { now: NOW });
    expect(verifyDocumentDownloadLease(token, expected, { now: NOW + 30 * 60_000 }).expiresAt).toBe(expiresAt);
    expect(verifyDocumentDownloadLease(token, expected, { now: expiresAt - 1 }).expiresAt).toBe(expiresAt);
    code(() => verifyDocumentDownloadLease(token, expected, { now: expiresAt }), 'EXPIRED');
    code(() => verifyDocumentDownloadLease(token, expected, { now: expiresAt + 1 }), 'EXPIRED');
  });

  it.each(['organizationId', 'userId', 'documentId'] as const)('refuses the same lease for another %s', (field) => {
    const { token } = issueDocumentDownloadLease(input, { now: NOW });
    code(() => verifyDocumentDownloadLease(token, { ...expected, [field]: 'different-identifier' }, { now: NOW }));
    code(() => verifyDocumentDownloadLease(token, { ...expected, [field]: 'different-identifier' }, { now: NOW + DOCUMENT_DOWNLOAD_LEASE_MS }));
  });

  it.each(['versionId', 'fingerprint'] as const)('refuses a modified %s even when every other field is intact', (field) => {
    const { token } = issueDocumentDownloadLease(input, { now: NOW });
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    payload[field] = field === 'fingerprint' ? 'b'.repeat(64) : 'different-version';
    parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
    code(() => verifyDocumentDownloadLease(parts.join('.'), expected, { now: NOW }));
  });

  it('refuses a modified MAC and a MAC under another purpose or directly under the root evidence key', () => {
    const { token } = issueDocumentDownloadLease(input, { now: NOW });
    const parts = token.split('.');
    const bytes = Buffer.from(parts[2], 'base64url'); bytes[0] ^= 1;
    code(() => verifyDocumentDownloadLease(`${parts[0]}.${parts[1]}.${bytes.toString('base64url')}`, expected, { now: NOW }));
    code(() => verifyDocumentDownloadLease(signRaw(JSON.stringify(originalPayload()), KEY, 'unrelated-purpose\0'), expected, { now: NOW }));
    const direct = createHmac('sha256', KEY).update(parts[1]).digest('base64url');
    code(() => verifyDocumentDownloadLease(`v1.${parts[1]}.${direct}`, expected, { now: NOW }));
  });

  it('refuses both issue and verification when the existing key is absent, weak or rotated, in every environment', () => {
    const { token } = issueDocumentDownloadLease(input, { now: NOW });
    for (const environment of ['production', 'development', 'test']) {
      vi.stubEnv('NODE_ENV', environment);
      for (const key of [undefined, '', 'short', ' '.repeat(32)]) {
        vi.stubEnv('EVIDENCE_SEAL_KEY', key);
        code(() => issueDocumentDownloadLease(input, { now: NOW }));
        code(() => verifyDocumentDownloadLease(token, expected, { now: NOW }));
      }
    }
    vi.stubEnv('EVIDENCE_SEAL_KEY', KEY + '-rotated');
    code(() => verifyDocumentDownloadLease(token, expected, { now: NOW }));
  });

  it.each([
    ['extra field', { ...originalPayload(), blobPath: 'private/should-never-be-accepted' }],
    ['missing field', { ...originalPayload(), versionId: undefined }],
    ['unsupported version', { ...originalPayload(), version: 2 }],
    ['extended lifetime', { ...originalPayload(), expiresAt: NOW + DOCUMENT_DOWNLOAD_LEASE_MS + 1 }],
    ['negative clock', { ...originalPayload(), issuedAt: -1 }],
    ['fractional clock', { ...originalPayload(), issuedAt: NOW + 0.5, expiresAt: NOW + DOCUMENT_DOWNLOAD_LEASE_MS + 0.5 }],
    ['invalid version pin', { ...originalPayload(), versionId: 42 }],
    ['invalid fingerprint', { ...originalPayload(), fingerprint: 'not-a-content-hash' }],
  ])('refuses a correctly signed payload with %s', (_name, payload) => {
    code(() => verifyDocumentDownloadLease(signRaw(JSON.stringify(payload)), expected, { now: NOW }));
  });

  it('refuses noncanonical JSON, duplicate fields, padded base64url and alternate encodings with the same decoded MAC', () => {
    code(() => verifyDocumentDownloadLease(signRaw(JSON.stringify(originalPayload(), null, 2)), expected, { now: NOW }));
    const json = JSON.stringify(originalPayload());
    code(() => verifyDocumentDownloadLease(signRaw(json.replace('"version":1,', '"version":1,"version":1,')), expected, { now: NOW }));
    const { token } = issueDocumentDownloadLease(input, { now: NOW });
    const [prefix, payload, mac] = token.split('.');
    code(() => verifyDocumentDownloadLease(`${prefix}.${payload}=.${mac}`, expected, { now: NOW }));
    code(() => verifyDocumentDownloadLease(`${prefix}.${payload}.${mac}=`, expected, { now: NOW }));
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const index = alphabet.indexOf(mac.at(-1)!);
    const noncanonical = mac.slice(0, -1) + alphabet[index | 1];
    expect(Buffer.from(noncanonical, 'base64url')).toEqual(Buffer.from(mac, 'base64url'));
    code(() => verifyDocumentDownloadLease(`${prefix}.${payload}.${noncanonical}`, expected, { now: NOW }));
  });

  it.each(['', 'v1', 'v2.invalid.invalid', 'v1...invalid', 'v1.%20.invalid', 'x'.repeat(4097)])('refuses a malformed or oversized token', (token) => {
    code(() => verifyDocumentDownloadLease(token, expected, { now: NOW }));
  });

  it('refuses oversized identities, path/PII fields, missing version pins and additional binding fields', () => {
    for (const candidate of [
      { ...input, userId: 'x'.repeat(256) },
      { ...input, userId: 'person@example.invalid' },
      { ...input, documentId: '../other-document' },
      { ...input, versionId: undefined },
      { ...input, blobPath: 'documents/private' },
    ]) code(() => issueDocumentDownloadLease(candidate as DocumentDownloadLeaseInput, { now: NOW }));
    const { token } = issueDocumentDownloadLease(input, { now: NOW });
    code(() => verifyDocumentDownloadLease(token, { ...expected, blobPath: 'documents/private' } as typeof expected, { now: NOW }));
    const oversizedPayload = signRaw(JSON.stringify({ ...originalPayload(), userId: 'x'.repeat(2048) }));
    expect(oversizedPayload.length).toBeLessThan(4096);
    code(() => verifyDocumentDownloadLease(oversizedPayload, expected, { now: NOW }));
  });

  it('refuses future-issued leases and invalid verification or issuance clocks', () => {
    const { token } = issueDocumentDownloadLease(input, { now: NOW });
    code(() => verifyDocumentDownloadLease(token, expected, { now: NOW - 1 }));
    for (const now of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER]) {
      code(() => issueDocumentDownloadLease(input, { now }));
      if (now !== Number.MAX_SAFE_INTEGER) code(() => verifyDocumentDownloadLease(token, expected, { now }));
    }
  });
});
