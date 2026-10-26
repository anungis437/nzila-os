import { describe, expect, it, vi } from 'vitest';
import {
  listDenied,
  requestAuthorizedDownload,
  requestBulkDownload,
  submitDocumentVersion,
  submitRepositoryDocument,
} from './document-repository-client';

const DOC = '11111111-1111-4111-8111-111111111111';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('document repository client', () => {
  it('downloads only through the audited route and ignores a list file url', async () => {
    const fetchImpl = vi.fn(async (input: string) => {
      expect(input).toBe(`/api/documents/${DOC}/download`);
      expect(input).not.toContain('secret.example');
      return jsonResponse(200, { success: true, data: { downloadUrl: 'https://storage.example/signed' } });
    });

    const result = await requestAuthorizedDownload(DOC, fetchImpl);
    expect(result).toEqual({ downloadUrl: 'https://storage.example/signed', denial: null });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails closed for forged ids, restricted responses, storage, and audit', async () => {
    const fetchImpl = vi.fn();
    await expect(requestAuthorizedDownload('not-a-uuid', fetchImpl)).resolves.toEqual({
      downloadUrl: null,
      denial: 'malformed_id',
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    fetchImpl.mockResolvedValueOnce(jsonResponse(403, { code: 'FORBIDDEN' }));
    await expect(requestAuthorizedDownload(DOC, fetchImpl)).resolves.toMatchObject({ denial: 'unauthorized' });

    fetchImpl.mockResolvedValueOnce(jsonResponse(502, { code: 'EXTERNAL_SERVICE_ERROR' }));
    await expect(requestAuthorizedDownload(DOC, fetchImpl)).resolves.toMatchObject({ denial: 'storage_failure' });

    fetchImpl.mockResolvedValueOnce(jsonResponse(503, { code: 'SERVICE_UNAVAILABLE' }));
    await expect(requestAuthorizedDownload(DOC, fetchImpl)).resolves.toMatchObject({ denial: 'audit_failure' });
  });

  it('does not treat a failed or conflicting upload as saved', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(403, { code: 'FORBIDDEN' }))
      .mockResolvedValueOnce(jsonResponse(409, { code: 'CONFLICT' }))
      .mockResolvedValueOnce(jsonResponse(500, { code: 'INTERNAL' }))
      .mockResolvedValueOnce(jsonResponse(201, { success: true, data: { id: DOC } }));

    await expect(submitRepositoryDocument({ title: 'A' }, fetchImpl)).resolves.toMatchObject({
      accepted: false,
      denial: 'unauthorized',
    });
    await expect(submitRepositoryDocument({ title: 'A' }, fetchImpl)).resolves.toMatchObject({
      accepted: false,
      denial: 'conflict',
    });
    await expect(submitRepositoryDocument({ title: 'A' }, fetchImpl)).resolves.toMatchObject({
      accepted: false,
      denial: 'upload_rejected',
    });
    await expect(submitRepositoryDocument({ title: 'A' }, fetchImpl)).resolves.toEqual({
      accepted: true,
      denial: null,
    });
    expect(fetchImpl.mock.calls.every((call) => call[0] === '/api/documents/repository' && call[1].method === 'POST')).toBe(true);
  });

  it('rejects a version write that the canonical route does not accept', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(409, { code: 'CONFLICT' }));
    await expect(submitDocumentVersion(DOC, { fileUrl: 'https://files.example/v2', contentHash: 'abc' }, fetchImpl)).resolves.toEqual({
      accepted: false,
      denial: 'conflict',
    });
    await expect(submitDocumentVersion('forged', { fileUrl: 'https://files.example/v2', contentHash: 'abc' }, fetchImpl)).resolves.toEqual({
      accepted: false,
      denial: 'malformed_id',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not present a forbidden list as an empty library', () => {
    expect(listDenied(403, { data: [] })).toBe('unauthorized');
    expect(listDenied(200, { unexpected: true })).toBe('list_unavailable');
    expect(listDenied(200, { data: [{ id: DOC }] })).toBeNull();
  });
});

describe('bulk download client', () => {
  const A = '11111111-1111-4111-8111-111111111111';
  const B = '22222222-2222-4222-8222-222222222222';

  it('reads a partial report as a report, not as a failure and not as success', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        success: true,
        data: {
          atomic: false, status: 'partial', requested: 2, issued: 1, failed: 1,
          items: [{ documentId: A, outcome: 'issued', downloadUrl: 'https://s/a' }, { documentId: B, outcome: 'denied' }],
        },
      }),
    );
    const result = await requestBulkDownload([A, B], fetchImpl);
    expect(result.denial).toBeNull();
    expect(result.report).toMatchObject({ status: 'partial', issued: 1, failed: 1 });
    expect(fetchImpl).toHaveBeenCalledWith('/api/documents/repository/downloads', expect.objectContaining({ method: 'POST' }));
  });

  it('refuses locally what the server would refuse, without a request', async () => {
    const fetchImpl = vi.fn();
    await expect(requestBulkDownload([], fetchImpl)).resolves.toEqual({ report: null, denial: 'none_selected' });
    await expect(requestBulkDownload(['nope'], fetchImpl)).resolves.toEqual({ report: null, denial: 'malformed_id' });
    await expect(requestBulkDownload(Array.from({ length: 26 }, () => A), fetchImpl)).resolves.toEqual({ report: null, denial: 'bulk_limit' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats a body that does not say it is non-atomic, or a transport failure, as unavailable', async () => {
    await expect(requestBulkDownload([A], vi.fn(async () => jsonResponse(200, { data: { status: 'complete', items: [] } })))).resolves.toMatchObject({ report: null, denial: 'bulk_unavailable' });
    await expect(requestBulkDownload([A], vi.fn(async () => { throw new Error('offline'); }))).resolves.toMatchObject({ report: null, denial: 'bulk_unavailable' });
    await expect(requestBulkDownload([A], vi.fn(async () => jsonResponse(403, {})))).resolves.toMatchObject({ report: null, denial: 'unauthorized' });
  });

  it('reads a rejected storage reference on a write as its own denial, and a hash mismatch as a conflict', async () => {
    await expect(submitRepositoryDocument({}, vi.fn(async () => jsonResponse(400, {})))).resolves.toEqual({ accepted: false, denial: 'reference_rejected' });
    await expect(submitDocumentVersion(A, { fileUrl: 'u', contentHash: 'h' }, vi.fn(async () => jsonResponse(409, {})))).resolves.toEqual({ accepted: false, denial: 'conflict' });
  });
});
