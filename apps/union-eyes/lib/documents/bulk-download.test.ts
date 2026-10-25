import { describe, expect, it, vi } from 'vitest';
import { authorizeBulkDownload, BULK_DOWNLOAD_LIMIT, bulkOutcomeNotice, permittedDownloadUrls } from './bulk-download';

const OPEN = '11111111-1111-4111-8111-111111111111';
const CLOSED = '22222222-2222-4222-8222-222222222222';

describe('canonical bulk download', () => {
  it('authorizes every id before any permitted url is collected', async () => {
    const calls: string[] = [];
    const report = await authorizeBulkDownload([OPEN, CLOSED, 'not-a-uuid'], async (input) => {
      calls.push(input);
      if (input.includes(CLOSED)) return new Response(JSON.stringify({ code: 'FORBIDDEN' }), { status: 403 });
      return new Response(JSON.stringify({ data: { downloadUrl: 'https://storage.example/signed.pdf' } }), { status: 200 });
    });

    expect(calls).toEqual([
      `/api/documents/${OPEN}/download`,
      `/api/documents/${CLOSED}/download`,
    ]);
    expect(report.complete).toBe(false);
    expect(report.permitted).toBe(1);
    expect(report.denied).toBe(2);
    expect(permittedDownloadUrls(report)).toEqual(['https://storage.example/signed.pdf']);
    expect(bulkOutcomeNotice('en', report)).toBe('1 downloaded. 2 denied. 0 failed.');
    expect(bulkOutcomeNotice('fr', report)).toMatch(/refuses/);
  });

  it('does not call the download route again for a repeated id and caps the batch', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: { downloadUrl: 'https://storage.example/a.pdf' } }), { status: 200 }));
    const repeated = await authorizeBulkDownload([OPEN, OPEN], fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(repeated.complete).toBe(true);

    const ids = Array.from({ length: BULK_DOWNLOAD_LIMIT + 2 }, (_, index) => {
      const suffix = index.toString(16).padStart(12, '0');
      return `11111111-1111-4111-8111-${suffix}`;
    });
    const report = await authorizeBulkDownload(ids, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1 + BULK_DOWNLOAD_LIMIT);
    expect(report.truncated).toBe(true);
    expect(report.complete).toBe(false);
    expect(report.failed).toBe(2);
  });

  it('records a storage failure without a url', async () => {
    const report = await authorizeBulkDownload([OPEN], async () => {
      throw new Error('network down');
    });
    expect(report.items).toEqual([{ id: OPEN, outcome: 'failed', denial: 'storage_failure' }]);
    expect(permittedDownloadUrls(report)).toEqual([]);
    expect(report.complete).toBe(false);
  });
});
