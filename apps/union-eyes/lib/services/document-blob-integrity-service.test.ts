import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockDownloadBuffer: vi.fn(),
  mockComputeSha256: vi.fn(),
  mockGenerateSasUrl: vi.fn(),
}));

vi.mock('@/lib/blob-client', () => ({
  downloadBuffer: mocks.mockDownloadBuffer,
  computeSha256: mocks.mockComputeSha256,
  generateSasUrl: mocks.mockGenerateSasUrl,
}));

import {
  extractBlobPathFromUrl,
  isBlobPathOwnedByOrganization,
  resolveStoredBlob,
} from '@/lib/services/document-blob-integrity-service';

describe('document-blob-integrity-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockDownloadBuffer.mockResolvedValue(Buffer.from('hello'));
    mocks.mockComputeSha256.mockReturnValue('sha256-1');
    mocks.mockGenerateSasUrl.mockResolvedValue('https://storage/documents/org-1/file.pdf?sig=1');
  });

  it('extracts blob path from storage url', () => {
    const blobPath = extractBlobPathFromUrl('https://storage.example.com/union-eyes/documents/org-1/file.pdf?sig=abc');
    expect(blobPath).toBe('documents/org-1/file.pdf');
  });

  it('checks organization ownership from blob path', () => {
    expect(isBlobPathOwnedByOrganization('documents/org-1/a.pdf', 'org-1')).toBe(true);
    expect(isBlobPathOwnedByOrganization('documents/org-2/a.pdf', 'org-1')).toBe(false);
  });

  it('resolves stored blob using blobPath and computes server hash', async () => {
    const result = await resolveStoredBlob({
      organizationId: 'org-1',
      blobPath: 'documents/org-1/file.pdf',
    });

    expect(result).toEqual({
      blobPath: 'documents/org-1/file.pdf',
      fileUrl: 'https://storage/documents/org-1/file.pdf?sig=1',
      contentHash: 'sha256-1',
    });
    expect(mocks.mockDownloadBuffer).toHaveBeenCalled();
    expect(mocks.mockComputeSha256).toHaveBeenCalled();
  });

  it('rejects blob paths outside organization scope', async () => {
    await expect(
      resolveStoredBlob({
        organizationId: 'org-1',
        blobPath: 'documents/org-2/file.pdf',
      }),
    ).rejects.toThrow('Blob path is not scoped to organization storage');
  });
});
