/**
 * Tests for scheduled-report-executor.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockUpdateScheduleAfterRun: vi.fn(),
  mockUpload: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    execute: mocks.mockExecute,
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({
    queryChunks: [strings.join('?')],
    values: vals,
  }),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/db/queries/scheduled-reports-queries', () => ({
  updateScheduleAfterRun: mocks.mockUpdateScheduleAfterRun,
}));

vi.mock('@/lib/services/document-storage-service', () => ({
  default: class MockDocStorage {
    upload = mocks.mockUpload;
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { executeScheduledReport } from '../scheduled-report-executor';

describe('scheduled-report-executor', () => {
  const mockSchedule = {
    id: 'sched-1',
    reportId: 'report-1',
    organizationId: 'org-1',
    format: 'csv',
    name: 'Test Report',
    deliveryConfig: {},
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns failure when export job creation fails', async () => {
    mocks.mockExecute.mockRejectedValueOnce(new Error('DB error'));
    mocks.mockUpdateScheduleAfterRun.mockResolvedValue(undefined);

    const result = await executeScheduledReport(mockSchedule);
    expect(result.success).toBe(false);
    expect(result.error).toBe('DB error');
    expect(mocks.mockUpdateScheduleAfterRun).toHaveBeenCalledWith('sched-1', false, 'DB error');
  });

  it('returns failure when no data available', async () => {
    // createExportJob succeeds
    mocks.mockExecute.mockResolvedValueOnce([{ id: 'job-1' }]);
    // fetchReportData → get report config
    mocks.mockExecute.mockResolvedValueOnce([{ config: { reportType: 'claims' } }]);
    // execute claims query returns empty
    mocks.mockExecute.mockResolvedValueOnce([]);
    mocks.mockUpdateScheduleAfterRun.mockResolvedValue(undefined);

    const result = await executeScheduledReport(mockSchedule);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No data');
  });

  it('returns failure when report not found', async () => {
    mocks.mockExecute.mockResolvedValueOnce([{ id: 'job-1' }]);
    // fetchReportData → report not found
    mocks.mockExecute.mockResolvedValueOnce([]);
    mocks.mockUpdateScheduleAfterRun.mockResolvedValue(undefined);

    const result = await executeScheduledReport(mockSchedule);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Report not found');
  });
});
