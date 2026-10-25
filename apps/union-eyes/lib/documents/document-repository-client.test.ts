import { describe, expect, it, vi } from 'vitest';
import {
  listDenied,
  requestAuthorizedDownload,
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
