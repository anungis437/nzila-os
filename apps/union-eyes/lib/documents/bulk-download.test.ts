import { describe, expect, it, vi } from 'vitest';
import {
  authorizeBulkDownload,
  BULK_DOWNLOAD_LIMIT,
  bulkOutcomeNotice,
  issuedDownloadUrls,
  recordBrowserOpens,
} from './bulk-download';

const OPEN = '11111111-1111-4111-8111-111111111111';
const CLOSED = '22222222-2222-4222-8222-222222222222';

describe('canonical bulk download', () => {
  it('authorizes every id and treats a URL as issued, not transferred', async () => {
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
    expect(report.authorizationComplete).toBe(false);
    expect(report.approved).toBe(1);
    expect(report.urlsIssued).toBe(1);
    expect(report.denied).toBe(2);
    expect(report.transferCompleted).toBe(0);
    expect(issuedDownloadUrls(report)).toEqual(['https://storage.example/signed.pdf']);
    expect(bulkOutcomeNotice('en', report)).toBe(
      '1 download URL issued. 2 denied. 0 failed. 0 browser opens attempted. 0 browser opens failed. File transfer is not confirmed.',
    );
    expect(bulkOutcomeNotice('fr', report)).toMatch(/refuses/);
    expect(bulkOutcomeNotice('en', report)).not.toMatch(/downloaded/i);
  });

  it('records a browser open without marking the file transfer complete', async () => {
    const authorized = await authorizeBulkDownload([OPEN], async () =>
      new Response(JSON.stringify({ data: { downloadUrl: 'https://storage.example/a.pdf' } }), { status: 200 }));
    const opened = recordBrowserOpens(authorized, () => true);
    expect(opened.openAttempted).toBe(1);
    expect(opened.openFailed).toBe(0);
    expect(opened.transferCompleted).toBe(0);
    expect(opened.items[0]?.transferCompleted).toBe(false);

    const blocked = recordBrowserOpens(authorized, () => false);
    expect(blocked.openAttempted).toBe(1);
    expect(blocked.openFailed).toBe(1);
    expect(blocked.transferCompleted).toBe(0);
  });

  it('does not call the download route again for a repeated id and caps the batch', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: { downloadUrl: 'https://storage.example/a.pdf' } }), { status: 200 }));
    const repeated = await authorizeBulkDownload([OPEN, OPEN], fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(repeated.authorizationComplete).toBe(true);
    expect(repeated.transferCompleted).toBe(0);

    const ids = Array.from({ length: BULK_DOWNLOAD_LIMIT + 2 }, (_, index) => {
      const suffix = index.toString(16).padStart(12, '0');
      return `11111111-1111-4111-8111-${suffix}`;
    });
    const report = await authorizeBulkDownload(ids, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1 + BULK_DOWNLOAD_LIMIT);
    expect(report.truncated).toBe(true);
    expect(report.authorizationComplete).toBe(false);
    expect(report.failed).toBe(2);
    expect(report.urlsIssued).toBe(BULK_DOWNLOAD_LIMIT);
  });

  it('records a storage failure without a url', async () => {
    const report = await authorizeBulkDownload([OPEN], async () => {
      throw new Error('network down');
    });
    expect(report.items).toEqual([{
      id: OPEN,
      authorization: 'failed',
      urlIssued: false,
      openAttempted: false,
      openFailed: false,
      transferCompleted: false,
      denial: 'storage_failure',
    }]);
    expect(issuedDownloadUrls(report)).toEqual([]);
    expect(report.authorizationComplete).toBe(false);
  });
});
