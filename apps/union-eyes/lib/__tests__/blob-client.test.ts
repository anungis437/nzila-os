import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockUploadBuffer: vi.fn(),
  mockDownloadBuffer: vi.fn(),
  mockGenerateSasUrl: vi.fn(),
  mockComputeSha256: vi.fn(),
  mockContainer: vi.fn(),
  mockDeleteIfExists: vi.fn(),
  mockAssertBufferSafeForUpload: vi.fn(),
}));

vi.mock('@nzila/blob', () => ({
  uploadBuffer: mocks.mockUploadBuffer,
  downloadBuffer: mocks.mockDownloadBuffer,
  generateSasUrl: mocks.mockGenerateSasUrl,
  computeSha256: mocks.mockComputeSha256,
  container: mocks.mockContainer,
}));

vi.mock('@/lib/security/clamav', () => ({
  assertBufferSafeForUpload: mocks.mockAssertBufferSafeForUpload,
}));

describe('blob-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AZURE_BLOB_CONTAINER = 'test-container';

    mocks.mockUploadBuffer.mockResolvedValue({
      blobPath: 'docs/test.pdf',
      sha256: 'abc123',
      sizeBytes: 1024,
    });
    mocks.mockAssertBufferSafeForUpload.mockResolvedValue({
      status: 'clean',
      scannedAt: '2026-04-27T00:00:00.000Z',
      engine: 'clamav',
    });
    mocks.mockGenerateSasUrl.mockResolvedValue('https://storage.blob.core.windows.net/test/docs/test.pdf?sig=xxx');
    mocks.mockContainer.mockReturnValue({
      getBlockBlobClient: () => ({
        deleteIfExists: mocks.mockDeleteIfExists.mockResolvedValue(undefined),
      }),
    });
  });

  it('putBlob uploads buffer and returns result', async () => {
    const { putBlob } = await import('../blob-client');
    const buf = Buffer.from('hello');
    const result = await putBlob('docs/test.pdf', buf, { contentType: 'application/pdf' });

    expect(result.pathname).toBe('docs/test.pdf');
    expect(result.contentType).toBe('application/pdf');
    expect(result.sha256).toBe('abc123');
    expect(result.sizeBytes).toBe(1024);
    expect(result.malwareScan.status).toBe('clean');
    expect(result.url).toContain('https://');
    expect(mocks.mockAssertBufferSafeForUpload).toHaveBeenCalled();
  });

  it('putBlob adds random suffix when requested', async () => {
    const { putBlob } = await import('../blob-client');
    const buf = Buffer.from('data');
    await putBlob('file.pdf', buf, { addRandomSuffix: true });

    const callArg = mocks.mockUploadBuffer.mock.calls[0][0];
    expect(callArg.blobPath).not.toBe('file.pdf');
    expect(callArg.blobPath).toContain('.pdf');
  });

  it('putBlob defaults contentType to application/octet-stream', async () => {
    const { putBlob } = await import('../blob-client');
    const buf = Buffer.from('data');
    const result = await putBlob('file.bin', buf);

    expect(result.contentType).toBe('application/octet-stream');
  });

  it('putBlob surfaces malware scan failures', async () => {
    const { putBlob } = await import('../blob-client');
    const buf = Buffer.from('danger');
    mocks.mockAssertBufferSafeForUpload.mockRejectedValue(new Error('blocked'));

    await expect(putBlob('file.bin', buf)).rejects.toThrow('blocked');
    expect(mocks.mockUploadBuffer).not.toHaveBeenCalled();
  });

  it('deleteBlob deletes by plain path', async () => {
    const { deleteBlob } = await import('../blob-client');
    await deleteBlob('docs/test.pdf');

    expect(mocks.mockContainer).toHaveBeenCalled();
    expect(mocks.mockDeleteIfExists).toHaveBeenCalled();
  });

  it('deleteBlob extracts path from URL', async () => {
    const { deleteBlob } = await import('../blob-client');
    await deleteBlob('https://storage.blob.core.windows.net/container/docs/test.pdf?sig=xxx');

    expect(mocks.mockDeleteIfExists).toHaveBeenCalled();
  });
});
