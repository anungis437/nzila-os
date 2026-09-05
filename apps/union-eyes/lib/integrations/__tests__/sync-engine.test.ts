import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntegrationProvider, SyncType, SyncStatus } from '../types';

const h = vi.hoisted(() => {
  const q: unknown[] = [];
  const shift = () => (q.length ? q.shift() : []);
  const makeChain = () => {
    const c: Record<string, unknown> = {};
    for (const m of [
      'select', 'from', 'where', 'orderBy', 'limit', 'set', 'values', 'returning',
      'onConflictDoUpdate', 'update', 'insert', 'delete', 'innerJoin', 'leftJoin',
      'offset', 'groupBy',
    ]) c[m] = () => c;
    (c as { then: unknown }).then = (
      res: (v: unknown) => unknown,
      rej: (e: unknown) => unknown
    ) => {
      const v = shift();
      if (v instanceof Error) return Promise.reject(v).then(res, rej);
      return Promise.resolve(v).then(res, rej);
    };
    return c;
  };
  const db = { select: makeChain, insert: makeChain, update: makeChain, delete: makeChain };
  const factory = { getIntegration: vi.fn() };
  const cron = {
    schedule: vi.fn((_expr: string, cb: () => unknown) => {
      h.cronCb = cb;
      return { stop: vi.fn() };
    }),
    validate: vi.fn(() => true),
  };
  return { q, db, factory, cron, cronCb: undefined as undefined | (() => unknown) };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db', () => ({ db: h.db }));
vi.mock('node-cron', () => ({ default: h.cron }));
vi.mock('../factory', () => ({ IntegrationFactory: { getInstance: () => h.factory } }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { SyncEngine, executeFullSync, executeIncrementalSync, getSyncHistory } from '../sync-engine';

const push = (...rows: unknown[]) => h.q.push(...rows);

const makeIntegration = () => ({
  sync: vi.fn().mockResolvedValue({
    success: true,
    recordsProcessed: 3,
    recordsCreated: 1,
    recordsUpdated: 2,
    recordsFailed: 0,
    cursor: 'cur',
    errors: [],
  }),
});

describe('SyncEngine', () => {
  let engine: SyncEngine;

  beforeEach(() => {
    h.q.length = 0;
    vi.clearAllMocks();
    h.cron.validate.mockReturnValue(true);
    h.factory.getIntegration.mockResolvedValue(makeIntegration());
    engine = SyncEngine.getInstance();
  });

  it('getInstance returns a singleton', () => {
    expect(SyncEngine.getInstance()).toBe(engine);
  });

  it('executeSync runs a full sync and updates the log', async () => {
    push([{ id: 'log1' }]); // createSyncLog returning
    push({}); // updateSyncLog
    const result = await engine.executeSync('org1', IntegrationProvider.WORKDAY, {
      type: SyncType.FULL,
    });
    expect(result.success).toBe(true);
    expect(result.recordsProcessed).toBe(3);
  });

  it('executeSync rethrows and clears the running job on failure', async () => {
    push([{ id: 'log1' }]); // createSyncLog returning
    h.factory.getIntegration.mockResolvedValue({
      sync: () => Promise.reject(new Error('sync boom')),
    });
    await expect(
      engine.executeSync('org1', IntegrationProvider.WORKDAY, { type: SyncType.FULL })
    ).rejects.toThrow('sync boom');
    expect(engine.isSyncRunning('org1', IntegrationProvider.WORKDAY, SyncType.FULL)).toBe(false);
  });

  it('executeFullSync delegates to executeSync', async () => {
    push([{ id: 'log2' }]);
    push({});
    const result = await engine.executeFullSync('org1', IntegrationProvider.WORKDAY, ['o1']);
    expect(result.success).toBe(true);
  });

  it('executeIncrementalSync uses the last sync cursor', async () => {
    push([{ completedAt: new Date(), cursor: 'c1', status: SyncStatus.SUCCESS }]); // getLastSync
    push([{ id: 'log3' }]); // createSyncLog
    push({}); // updateSyncLog
    const result = await engine.executeIncrementalSync('org1', IntegrationProvider.WORKDAY);
    expect(result.success).toBe(true);
  });

  it('executeSync (incremental) resolves cursor via prepareSyncOptions', async () => {
    push([{ id: 'log4' }]); // createSyncLog
    push([{ completedAt: new Date(), cursor: 'c2', status: SyncStatus.SUCCESS }]); // prepareSyncOptions -> getLastSync
    push({}); // updateSyncLog
    const result = await engine.executeSync('org1', IntegrationProvider.WORKDAY, {
      type: SyncType.INCREMENTAL,
    });
    expect(result.success).toBe(true);
  });

  it('scheduleSync registers a cron task when enabled', async () => {
    await engine.scheduleSync({
      organizationId: 'org1',
      provider: IntegrationProvider.WORKDAY,
      type: SyncType.FULL,
      schedule: '0 * * * *',
      enabled: true,
    });
    expect(h.cron.schedule).toHaveBeenCalled();
    // exercise the scheduled callback
    push([{ id: 'log5' }]);
    push({});
    await h.cronCb?.();
    expect(h.factory.getIntegration).toHaveBeenCalled();
  });

  it('scheduleSync stops/skips when not enabled', async () => {
    await engine.scheduleSync({
      organizationId: 'org1',
      provider: IntegrationProvider.ADP,
      type: SyncType.FULL,
      enabled: false,
    });
    expect(h.cron.schedule).not.toHaveBeenCalled();
  });

  it('scheduleSync throws on invalid cron expression', async () => {
    h.cron.validate.mockReturnValue(false);
    await expect(
      engine.scheduleSync({
        organizationId: 'org1',
        provider: IntegrationProvider.WORKDAY,
        type: SyncType.FULL,
        schedule: 'not-a-cron',
        enabled: true,
      })
    ).rejects.toMatchObject({ code: 'INVALID_SCHEDULE' });
  });

  it('getSyncHistory returns rows filtered by provider', async () => {
    push([{ id: 'h1' }, { id: 'h2' }]);
    const rows = await engine.getSyncHistory('org1', IntegrationProvider.WORKDAY, 10);
    expect(rows).toHaveLength(2);
  });

  it('isSyncRunning reflects running state', () => {
    expect(engine.isSyncRunning('org1', IntegrationProvider.WORKDAY, SyncType.FULL)).toBe(false);
  });

  it('convenience executeFullSync works', async () => {
    push([{ id: 'log6' }]);
    push({});
    const result = await executeFullSync('org1', IntegrationProvider.WORKDAY);
    expect(result.success).toBe(true);
  });

  it('convenience executeIncrementalSync works', async () => {
    push([{ completedAt: new Date(), cursor: 'c3', status: SyncStatus.SUCCESS }]);
    push([{ id: 'log7' }]);
    push({});
    const result = await executeIncrementalSync('org1', IntegrationProvider.WORKDAY);
    expect(result.success).toBe(true);
  });

  it('convenience getSyncHistory works', async () => {
    push([{ id: 'h3' }]);
    const rows = await getSyncHistory('org1');
    expect(rows).toHaveLength(1);
  });
});
