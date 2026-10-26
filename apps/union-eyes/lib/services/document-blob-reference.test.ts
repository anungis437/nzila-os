// Strict storage references (B2, B4). The reference authority is the existing integrity service; these tests pin what it
// will and will not accept.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  downloadBuffer: vi.fn(),
  computeSha256: vi.fn(),
  generateSasUrl: vi.fn(),
}));

vi.mock('@/lib/blob-client', () => ({
  downloadBuffer: mocks.downloadBuffer,
  computeSha256: mocks.computeSha256,
  generateSasUrl: mocks.generateSasUrl,
}));

import {
  StoredBlobError,
  parseOwnStorageUrl,
  resolveStoredBlob,
  storedBlobFailure,
  verifiedLegacyBlobPath,
} from '@/lib/services/document-blob-integrity-service';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const OWN = 'https://uestore.blob.core.windows.net/union-eyes';
const env = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.AZURE_STORAGE_BLOB_ENDPOINT;
  delete process.env.AZURE_BLOB_CONTAINER;
  process.env.AZURE_STORAGE_ACCOUNT_NAME = 'uestore';
  mocks.downloadBuffer.mockResolvedValue(Buffer.from('content'));
  mocks.computeSha256.mockReturnValue('c'.repeat(64));
  mocks.generateSasUrl.mockResolvedValue('https://signed.example/fresh');
});

afterEach(() => {
  process.env = { ...env };
});

describe('parseOwnStorageUrl', () => {
  it('names the blob path of a URL into this application\'s own storage, discarding any signature', () => {
    expect(parseOwnStorageUrl(`${OWN}/documents/${ORG}/a.pdf?sv=old&sig=abc`)).toBe(`documents/${ORG}/a.pdf`);
  });

  it.each([
    ['another host', `https://evil.example/union-eyes/documents/${ORG}/a.pdf`],
    ['a look-alike host', `https://uestore.blob.core.windows.net.evil.example/union-eyes/documents/${ORG}/a.pdf`],
    ['another account', `https://other.blob.core.windows.net/union-eyes/documents/${ORG}/a.pdf`],
    ['plain http', `http://uestore.blob.core.windows.net/union-eyes/documents/${ORG}/a.pdf`],
    ['embedded credentials', `https://user:pw@uestore.blob.core.windows.net/union-eyes/documents/${ORG}/a.pdf`],
    ['another container', `https://uestore.blob.core.windows.net/other/documents/${ORG}/a.pdf`],
    ['a relative segment', `${OWN}/documents/${ORG}/../${OTHER}/a.pdf`],
    ['an encoded relative segment', `${OWN}/documents/${ORG}/%2e%2e/${OTHER}/a.pdf`],
    ['a backslash segment', `${OWN}/documents/${ORG}/a%5Cb.pdf`],
    ['a container-only URL', `${OWN}`],
    ['not a URL', 'documents/org/a.pdf'],
  ])('refuses %s', (_label, url) => {
    expect(parseOwnStorageUrl(url)).toBeNull();
  });

  it('refuses everything when no storage account is configured', () => {
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    expect(parseOwnStorageUrl(`${OWN}/documents/${ORG}/a.pdf`)).toBeNull();
  });

  it('honours the emulator endpoint outside production only', () => {
    process.env.AZURE_STORAGE_BLOB_ENDPOINT = 'http://127.0.0.1:10000/devstoreaccount1/';
    expect(parseOwnStorageUrl(`http://127.0.0.1:10000/devstoreaccount1/union-eyes/documents/${ORG}/a.pdf`)).toBe(`documents/${ORG}/a.pdf`);
    expect(parseOwnStorageUrl(`http://127.0.0.1:10000/other/union-eyes/documents/${ORG}/a.pdf`)).toBeNull();
    (process.env as Record<string, string>).NODE_ENV = 'production';
    expect(parseOwnStorageUrl(`http://127.0.0.1:10000/devstoreaccount1/union-eyes/documents/${ORG}/a.pdf`)).toBeNull();
  });
});

describe('verifiedLegacyBlobPath', () => {
  it('accepts only a legacy URL that points into the organization\'s own folder', () => {
    expect(verifiedLegacyBlobPath(`${OWN}/documents/${ORG}/a.pdf?sig=x`, ORG)).toBe(`documents/${ORG}/a.pdf`);
    expect(verifiedLegacyBlobPath(`${OWN}/documents/${OTHER}/a.pdf`, ORG)).toBeNull();
    expect(verifiedLegacyBlobPath('https://evil.example/a.pdf', ORG)).toBeNull();
    expect(verifiedLegacyBlobPath(null, ORG)).toBeNull();
  });
});

describe('resolveStoredBlob', () => {
  it('rejects an external file URL with an invalid-reference error and reads nothing', async () => {
    const error = await resolveStoredBlob({ organizationId: ORG, fileUrl: `https://evil.example/documents/${ORG}/a.pdf` }).catch((e) => e);
    expect(error).toBeInstanceOf(StoredBlobError);
    expect(error.code).toBe('INVALID_REFERENCE');
    expect(mocks.downloadBuffer).not.toHaveBeenCalled();
  });

  it('rejects another organization\'s blob path as a foreign tenant and reads nothing', async () => {
    const error = await resolveStoredBlob({ organizationId: ORG, blobPath: `documents/${OTHER}/a.pdf` }).catch((e) => e);
    expect(error.code).toBe('FOREIGN_TENANT');
    expect(mocks.downloadBuffer).not.toHaveBeenCalled();
  });

  it('rejects traversal inside the organization prefix', async () => {
    const error = await resolveStoredBlob({ organizationId: ORG, blobPath: `documents/${ORG}/../${OTHER}/a.pdf` }).catch((e) => e);
    expect(error.code).toBe('INVALID_REFERENCE');
  });

  it('rejects the bare organization folder', async () => {
    expect((await resolveStoredBlob({ organizationId: ORG, blobPath: `documents/${ORG}/` }).catch((e) => e)).code).toBe('INVALID_REFERENCE');
  });

  it('resolves an own-storage URL by re-signing the verified path, never returning the submitted URL', async () => {
    const result = await resolveStoredBlob({ organizationId: ORG, fileUrl: `${OWN}/documents/${ORG}/a.pdf?sig=stale` });
    expect(result).toEqual({ blobPath: `documents/${ORG}/a.pdf`, fileUrl: 'https://signed.example/fresh', contentHash: 'c'.repeat(64) });
    expect(mocks.generateSasUrl).toHaveBeenCalledWith('union-eyes', `documents/${ORG}/a.pdf`);
  });

  it('accepts a claimed hash only when it equals the server-computed one (case-insensitive)', async () => {
    await expect(
      resolveStoredBlob({ organizationId: ORG, blobPath: `documents/${ORG}/a.pdf`, expectedContentHash: 'C'.repeat(64) }),
    ).resolves.toMatchObject({ contentHash: 'c'.repeat(64) });
    const error = await resolveStoredBlob({ organizationId: ORG, blobPath: `documents/${ORG}/a.pdf`, expectedContentHash: 'd'.repeat(64) }).catch((e) => e);
    expect(error.code).toBe('CONTENT_HASH_MISMATCH');
    expect(mocks.generateSasUrl).toHaveBeenCalledTimes(1);
  });

  it('reports a missing blob without leaking storage detail', async () => {
    mocks.downloadBuffer.mockRejectedValueOnce(new Error('BlobNotFound https://uestore.blob.core.windows.net/...'));
    const error = await resolveStoredBlob({ organizationId: ORG, blobPath: `documents/${ORG}/a.pdf` }).catch((e) => e);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).not.toContain('blob.core');
  });
});

describe('storedBlobFailure', () => {
  it('maps a hash mismatch to a conflict and every other refusal to a validation failure', () => {
    expect(storedBlobFailure(new StoredBlobError('CONTENT_HASH_MISMATCH', 'm')).status).toBe('conflict');
    expect(storedBlobFailure(new StoredBlobError('FOREIGN_TENANT', 'm')).status).toBe('validation');
    expect(storedBlobFailure(new Error('x')).status).toBe('validation');
  });
});
