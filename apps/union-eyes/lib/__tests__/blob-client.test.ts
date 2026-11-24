import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';

const mocks = vi.hoisted(() => ({
  mockUploadBuffer: vi.fn(),
  mockDownloadBuffer: vi.fn(),
  mockGenerateSasUrl: vi.fn(),
  mockComputeSha256: vi.fn(),
  mockContainer: vi.fn(),
  mockDeleteIfExists: vi.fn(),
  mockAssertBufferSafeForUpload: vi.fn(),
  mockGetProperties: vi.fn(),
  mockDownload: vi.fn(),
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
        getProperties: mocks.mockGetProperties,
        download: mocks.mockDownload,
      }),
    });
    mocks.mockGetProperties.mockResolvedValue({ contentLength: 5 });
    mocks.mockDownload.mockReset();
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

  it('readBlobBounded consumes real readable chunks and returns the exact bytes at the bound', async () => {
    const { readBlobBounded } = await import('../blob-client');
    const stream = Readable.from([Buffer.from('he'), new Uint8Array([108, 108, 111])]);
    mocks.mockDownload.mockResolvedValue({ readableStreamBody: stream });
    expect(await readBlobBounded('docs/test.pdf', 5)).toEqual(Buffer.from('hello'));
    expect(mocks.mockGetProperties).toHaveBeenCalledOnce();
    expect(mocks.mockDownload).toHaveBeenCalledOnce();
    expect(mocks.mockDownloadBuffer).not.toHaveBeenCalled();
  });

  it('readBlobBounded refuses a metadata-declared oversized file before opening its stream', async () => {
    const { readBlobBounded, BlobTooLargeError } = await import('../blob-client');
    mocks.mockGetProperties.mockResolvedValue({ contentLength: 11 });
    const failure = await readBlobBounded('docs/test.pdf', 10).catch(error => error);
    expect(failure).toBeInstanceOf(BlobTooLargeError);
    expect(failure).toMatchObject({ sizeBytes: 11, maxBytes: 10 });
    expect(mocks.mockDownload).not.toHaveBeenCalled();
    expect(mocks.mockDownloadBuffer).not.toHaveBeenCalled();
  });

  it.each([
    { condition: 'metadata understates the blob', metadata: 1, chunks: [6, 5] },
    { condition: 'the blob grows after metadata was read', metadata: 10, chunks: [10, 1] },
    { condition: 'the metadata has no size', metadata: undefined, chunks: [5, 6] },
  ])('readBlobBounded destroys the actual stream when $condition and bytes exceed the bound', async ({ metadata, chunks }) => {
    const { readBlobBounded, BlobTooLargeError } = await import('../blob-client');
    const stream = Readable.from(chunks.map(size => Buffer.alloc(size, 97)));
    const destroy = vi.spyOn(stream, 'destroy');
    mocks.mockGetProperties.mockResolvedValue({ contentLength: metadata });
    mocks.mockDownload.mockResolvedValue({ readableStreamBody: stream });
    const failure = await readBlobBounded('docs/test.pdf', 10).catch(error => error);
    expect(failure).toBeInstanceOf(BlobTooLargeError);
    expect(failure).toMatchObject({ sizeBytes: 11, maxBytes: 10 });
    expect(destroy).toHaveBeenCalled();
    expect(stream.destroyed).toBe(true);
    expect(mocks.mockDownloadBuffer).not.toHaveBeenCalled();
  });

  it('readBlobBounded destroys a failed real stream and never returns its partial bytes', async () => {
    const { readBlobBounded } = await import('../blob-client');
    const failure = new Error('synthetic storage read failure');
    const stream = Readable.from((async function* () {
      yield Buffer.from('part');
      throw failure;
    })());
    const destroy = vi.spyOn(stream, 'destroy');
    mocks.mockDownload.mockResolvedValue({ readableStreamBody: stream });
    await expect(readBlobBounded('docs/test.pdf', 10)).rejects.toBe(failure);
    expect(destroy).toHaveBeenCalled();
    expect(stream.destroyed).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('readBlobBounded refuses invalid bound %s before storage access', async maxBytes => {
    const { readBlobBounded } = await import('../blob-client');
    await expect(readBlobBounded('docs/test.pdf', maxBytes)).rejects.toBeInstanceOf(RangeError);
    expect(mocks.mockContainer).not.toHaveBeenCalled();
    expect(mocks.mockGetProperties).not.toHaveBeenCalled();
    expect(mocks.mockDownload).not.toHaveBeenCalled();
  });
});
