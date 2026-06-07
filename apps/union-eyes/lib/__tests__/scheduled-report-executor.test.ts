/**
 * Tests for scheduled-report-executor.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockUpdateScheduleAfterRun: vi.fn(),
  mockUpload: vi.fn(),
  mockSendScheduledReportEmail: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: { execute: mocks.mockExecute },
}));

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: any[]) => ({
      queryChunks: [strings.join('?')],
      values: vals,
    }),
    { raw: vi.fn((s: string) => s) }
  ),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/db/queries/scheduled-reports-queries', () => ({
  updateScheduleAfterRun: mocks.mockUpdateScheduleAfterRun,
}));

vi.mock('@/lib/services/document-storage-service', () => ({
  default: class MockDocStorage {
    uploadDocument = mocks.mockUpload;
  },
}));

vi.mock('@/lib/email/report-email-templates', () => ({
  sendScheduledReportEmail: mocks.mockSendScheduledReportEmail,
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { executeScheduledReport, retryFailedExecution } from '../scheduled-report-executor';

describe('scheduled-report-executor', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeSchedule = (overrides: Record<string, unknown> = {}): any => ({
    id: 'sched-1',
    reportId: 'report-1',
    organizationId: 'org-1',
    format: 'csv',
    name: 'Test Report',
    deliveryConfig: {},
    recipients: [],
    parameters: {},
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    mocks.mockUpdateScheduleAfterRun.mockResolvedValue(undefined);
    mocks.mockSendScheduledReportEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── executeScheduledReport ─────────────────────────────────────────────────
  describe('executeScheduledReport', () => {
    it('returns failure when export job creation fails', async () => {
      mocks.mockExecute.mockRejectedValueOnce(new Error('DB error'));
      const result = await executeScheduledReport(makeSchedule());
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
      expect(mocks.mockUpdateScheduleAfterRun).toHaveBeenCalledWith('sched-1', false, 'DB error');
    });

    it('returns failure when report not found', async () => {
      mocks.mockExecute
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([]);
      const result = await executeScheduledReport(makeSchedule());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Report not found');
    });

    it('returns failure when no data available', async () => {
      mocks.mockExecute
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([{ config: { reportType: 'claims' } }])
        .mockResolvedValueOnce([]);
      const result = await executeScheduledReport(makeSchedule());
      expect(result.success).toBe(false);
      expect(result.error).toContain('No data');
    });

    it('succeeds with CSV format and claims data', async () => {
      mocks.mockExecute
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([{ config: { reportType: 'claims' } }])
        .mockResolvedValueOnce([{ claim_number: '001', status: 'open' }])
        .mockResolvedValueOnce(undefined);
      mocks.mockUpload.mockResolvedValue({ url: 'https://storage/report.csv' });

      const result = await executeScheduledReport(makeSchedule());
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
      expect(result.fileUrl).toBe('https://storage/report.csv');
      expect(result.fileSizeBytes).toBeGreaterThan(0);
    });

    it('succeeds with JSON format', async () => {
      mocks.mockExecute
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([{ config: { reportType: 'default' } }])
        .mockResolvedValueOnce([{ id: '1', status: 'open' }])
        .mockResolvedValueOnce(undefined);
      mocks.mockUpload.mockResolvedValue({ url: 'https://storage/report.json' });

      const result = await executeScheduledReport(makeSchedule({ format: 'json' }));
      expect(result.success).toBe(true);
    });

    it('handles analytics with valid groupBy', async () => {
      mocks.mockExecute
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([{ config: { reportType: 'analytics', groupBy: 'status' } }])
        .mockResolvedValueOnce([{ category: 'open', count: 5 }])
        .mockResolvedValueOnce(undefined);
      mocks.mockUpload.mockResolvedValue({ url: 'https://storage/analytics.csv' });

      const result = await executeScheduledReport(makeSchedule());
      expect(result.success).toBe(true);
    });

    it('rejects analytics with invalid groupBy', async () => {
      mocks.mockExecute
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([{ config: { reportType: 'analytics', groupBy: 'DROP TABLE' } }]);

      const result = await executeScheduledReport(makeSchedule());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid groupBy column');
    });

    it('handles custom query with approved key', async () => {
      mocks.mockExecute
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([{ config: { reportType: 'custom', queryKey: 'claims_summary', query: 'anything' } }])
        .mockResolvedValueOnce([{ total: 10, total_amount: 5000 }])
        .mockResolvedValueOnce(undefined);
      mocks.mockUpload.mockResolvedValue({ url: 'https://storage/custom.csv' });

      const result = await executeScheduledReport(makeSchedule());
      expect(result.success).toBe(true);
    });

    it('rejects custom query with unapproved key', async () => {
      mocks.mockExecute
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([{ config: { reportType: 'custom', queryKey: 'evil', query: 'DROP TABLE' } }]);

      const result = await executeScheduledReport(makeSchedule());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or unapproved custom query');
    });

    it('delivers via email when recipients exist', async () => {
      mocks.mockExecute
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([{ config: { reportType: 'claims' } }])
        .mockResolvedValueOnce([{ claim_number: '001', status: 'open' }])
        .mockResolvedValueOnce(undefined);
      mocks.mockUpload.mockResolvedValue({ url: 'https://storage/report.csv' });

      const result = await executeScheduledReport(makeSchedule({ recipients: ['admin@test.com'] }));
      expect(result.success).toBe(true);
      expect(mocks.mockSendScheduledReportEmail).toHaveBeenCalled();
    });

    it('delivers via webhook when configured', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);
      mocks.mockExecute
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([{ config: { reportType: 'claims' } }])
        .mockResolvedValueOnce([{ claim_number: '001', status: 'open' }])
        .mockResolvedValueOnce(undefined);
      mocks.mockUpload.mockResolvedValue({ url: 'https://storage/report.csv' });

      const result = await executeScheduledReport(makeSchedule({
        parameters: { webhookUrl: 'https://webhook.test/report' },
      }));
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://webhook.test/report',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('fails when webhook returns non-ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, statusText: 'Server Error' }));
      mocks.mockExecute
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([{ config: { reportType: 'claims' } }])
        .mockResolvedValueOnce([{ claim_number: '001', status: 'open' }])
        .mockResolvedValueOnce(undefined);
      mocks.mockUpload.mockResolvedValue({ url: 'https://storage/report.csv' });

      const result = await executeScheduledReport(makeSchedule({
        parameters: { webhookUrl: 'https://webhook.test/report' },
      }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Webhook delivery failed');
    });

    it('fails for unsupported format', async () => {
      mocks.mockExecute
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([{ config: { reportType: 'claims' } }])
        .mockResolvedValueOnce([{ claim_number: '001', status: 'open' }]);

      const result = await executeScheduledReport(makeSchedule({ format: 'docx' }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported export format');
    });
  });

  // ── retryFailedExecution ───────────────────────────────────────────────────
  describe('retryFailedExecution', () => {
    it('throws when schedule not found', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      await expect(retryFailedExecution('sched-missing')).rejects.toThrow('Schedule not found');
    });

    it('returns failure when max retries exceeded', async () => {
      mocks.mockExecute.mockResolvedValue([{ id: 'sched-1', failure_count: 5 }]);
      const result = await retryFailedExecution('sched-1', 3);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Max retries exceeded');
    });

    it('retries execution successfully', async () => {
      mocks.mockExecute
        .mockResolvedValueOnce([{
          id: 'sched-1', reportId: 'report-1', organizationId: 'org-1',
          format: 'csv', name: 'Test', recipients: [], parameters: {}, failure_count: 1,
        }])
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([{ config: { reportType: 'claims' } }])
        .mockResolvedValueOnce([{ claim_number: '001', status: 'open' }])
        .mockResolvedValueOnce(undefined);
      mocks.mockUpload.mockResolvedValue({ url: 'https://storage/report.csv' });

      const result = await retryFailedExecution('sched-1');
      expect(result.success).toBe(true);
    });
  });
});
