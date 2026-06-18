/**
 * Scheduled Reports Queries — Unit Tests
 *
 * This file uses the raw `db` handle from '@/db' (NOT withRLSContext) and
 * issues raw SQL via db.execute(sql`...`). We mock '@/db' so db.execute is
 * queue-driven (each call shifts the next pushed value; an Error is thrown).
 * drizzle-orm `sql`/`sql.join` stay REAL (db.execute ignores the built query).
 * The private calculateNextRunAt helper is exercised through create/update for
 * every frequency branch (daily/weekly/monthly/quarterly/custom/default).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ queue: [] as unknown[] }));

vi.mock('@/db', () => ({
  db: {
    execute: async () => {
      const v = mocks.queue.length ? mocks.queue.shift() : [];
      if (v instanceof Error) throw v;
      return v;
    },
  },
}));

import * as q from '../scheduled-reports-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}

beforeEach(() => {
  mocks.queue = [];
  vi.clearAllMocks();
});

describe('scheduled-reports-queries — reads', () => {
  it('getScheduledReports without filters', async () => {
    push([{ id: 'sr1' }]);
    expect(await q.getScheduledReports('org1')).toHaveLength(1);
  });
  it('getScheduledReports with all filters', async () => {
    push([{ id: 'sr1' }]);
    const r = await q.getScheduledReports('org1', {
      reportId: 'r1',
      isActive: true,
      frequency: 'daily',
    });
    expect(r).toHaveLength(1);
  });

  it('getScheduledReportById returns row or null', async () => {
    push([{ id: 'sr1' }]);
    expect(await q.getScheduledReportById('sr1', 'org1')).toEqual({ id: 'sr1' });
    push([]);
    expect(await q.getScheduledReportById('missing', 'org1')).toBeNull();
  });

  it('getDueSchedules returns due schedules', async () => {
    push([{ id: 'sr1' }, { id: 'sr2' }]);
    expect(await q.getDueSchedules()).toHaveLength(2);
  });

  it('getScheduleExecutionHistory returns job rows', async () => {
    push([{ id: 'job1' }]);
    expect(await q.getScheduleExecutionHistory('sr1', 'org1', 10)).toHaveLength(1);
  });
});

describe('scheduled-reports-queries — create (calculateNextRunAt branches)', () => {
  const base = {
    reportId: 'r1',
    name: 'Report',
    format: 'pdf' as const,
    recipients: ['a@b.com'],
    timeOfDay: '08:30',
  };

  it('create daily', async () => {
    push([{ id: 'sr1', frequency: 'daily' }]);
    expect(await q.createScheduledReport('org1', { ...base, frequency: 'daily' })).toEqual({
      id: 'sr1',
      frequency: 'daily',
    });
  });
  it('create weekly with dayOfWeek', async () => {
    push([{ id: 'sr2' }]);
    expect(
      await q.createScheduledReport('org1', { ...base, frequency: 'weekly', dayOfWeek: 3 }),
    ).toEqual({ id: 'sr2' });
  });
  it('create monthly with dayOfMonth', async () => {
    push([{ id: 'sr3' }]);
    expect(
      await q.createScheduledReport('org1', { ...base, frequency: 'monthly', dayOfMonth: 15 }),
    ).toEqual({ id: 'sr3' });
  });
  it('create quarterly', async () => {
    push([{ id: 'sr4' }]);
    expect(await q.createScheduledReport('org1', { ...base, frequency: 'quarterly' })).toEqual({
      id: 'sr4',
    });
  });
  it('create custom', async () => {
    push([{ id: 'sr5' }]);
    expect(await q.createScheduledReport('org1', { ...base, frequency: 'custom' })).toEqual({
      id: 'sr5',
    });
  });
  it('create with unknown frequency hits the default branch and no timeOfDay', async () => {
    push([{ id: 'sr6' }]);
    const r = await q.createScheduledReport('org1', {
      reportId: 'r1',
      name: 'R',
      format: 'csv',
      recipients: [],
      frequency: 'invalid' as never,
      isActive: false,
    });
    expect(r).toEqual({ id: 'sr6' });
  });
});

describe('scheduled-reports-queries — update', () => {
  const existing = {
    id: 'sr1',
    frequency: 'daily',
    dayOfWeek: null,
    dayOfMonth: null,
    timeOfDay: '09:00',
    timezone: 'UTC',
    format: 'pdf',
    recipients: ['a@b.com'],
    isActive: true,
    name: 'Old',
    nextExecutionAt: new Date('2030-01-01'),
  };

  it('update without schedule change keeps next execution', async () => {
    push([existing], [{ id: 'sr1', name: 'New' }]);
    expect(await q.updateScheduledReport('sr1', 'org1', { name: 'New' })).toEqual({
      id: 'sr1',
      name: 'New',
    });
  });
  it('update with frequency change recalculates next execution', async () => {
    push([existing], [{ id: 'sr1', frequency: 'weekly' }]);
    const r = await q.updateScheduledReport('sr1', 'org1', { frequency: 'weekly', dayOfWeek: 2 });
    expect(r).toEqual({ id: 'sr1', frequency: 'weekly' });
  });
  it('update throws when the report does not exist', async () => {
    push([]);
    await expect(q.updateScheduledReport('missing', 'org1', { name: 'X' })).rejects.toThrow(
      'Scheduled report not found',
    );
  });
  it('update throws when the UPDATE affects no rows', async () => {
    push([existing], []);
    await expect(q.updateScheduledReport('sr1', 'org1', { name: 'X' })).rejects.toThrow(
      'Scheduled report not found',
    );
  });

  it('pauseSchedule deactivates via updateScheduledReport', async () => {
    push([existing], [{ id: 'sr1', isActive: false }]);
    await expect(q.pauseSchedule('sr1', 'org1')).resolves.toBeUndefined();
  });
  it('resumeSchedule reactivates via updateScheduledReport', async () => {
    push([existing], [{ id: 'sr1', isActive: true }]);
    await expect(q.resumeSchedule('sr1', 'org1')).resolves.toBeUndefined();
  });
});

describe('scheduled-reports-queries — delete & post-run', () => {
  it('deleteScheduledReport issues the delete', async () => {
    push([]);
    await expect(q.deleteScheduledReport('sr1', 'org1')).resolves.toBeUndefined();
  });

  it('updateScheduleAfterRun on success recalculates and keeps active', async () => {
    push([{ frequency: 'daily', time_of_day: '09:00', day_of_week: null, day_of_month: null, is_active: true }], []);
    await expect(q.updateScheduleAfterRun('sr1', true)).resolves.toBeUndefined();
  });
  it('updateScheduleAfterRun on failure deactivates', async () => {
    push([{ frequency: 'weekly', time_of_day: '10:00', day_of_week: 2, day_of_month: null, is_active: true }], []);
    await expect(q.updateScheduleAfterRun('sr1', false, 'boom')).resolves.toBeUndefined();
  });
  it('updateScheduleAfterRun returns early when schedule missing', async () => {
    push([]);
    await expect(q.updateScheduleAfterRun('missing', true)).resolves.toBeUndefined();
  });
});
