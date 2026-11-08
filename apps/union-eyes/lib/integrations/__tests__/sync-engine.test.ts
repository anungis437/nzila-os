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
  // A real SET-NX-style exclusive lock, held in memory for this test file only: an honest double of the Redis-backed
  // lock in lib/services/cache-service.ts, so a test proves real mutual-exclusion semantics, not a stubbed-true/false.
  const locks = new Map<string, string>();
  const lockKey = (name: string, namespace: string) => `${namespace}:${name}`;
  const acquireLock = vi.fn(async (name: string, _ttlSeconds?: number, namespace = 'lock') => {
    const key = lockKey(name, namespace);
    if (locks.has(key)) return null;
    const token = `tok-${Math.random()}`;
    locks.set(key, token);
    return token;
  });
  const releaseLock = vi.fn(async (name: string, token: string, namespace = 'lock') => {
    const key = lockKey(name, namespace);
    if (locks.get(key) !== token) return false;
    locks.delete(key);
    return true;
  });
  const isLocked = vi.fn(async (name: string, namespace = 'lock') => locks.has(lockKey(name, namespace)));
  return { q, db, factory, cron, cronCb: undefined as undefined | (() => unknown), locks, acquireLock, releaseLock, isLocked };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db', () => ({ db: h.db }));
vi.mock('node-cron', () => ({ default: h.cron }));
vi.mock('../factory', () => ({ IntegrationFactory: { getInstance: () => h.factory } }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/services/cache-service', () => ({
  acquireLock: h.acquireLock,
  releaseLock: h.releaseLock,
  isLocked: h.isLocked,
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
    h.locks.clear();
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
    expect(await engine.isSyncRunning('org1', IntegrationProvider.WORKDAY, SyncType.FULL)).toBe(false);
  });

  it('executeSync refuses a second concurrent run for the same organization/provider/type via the distributed lock, and releases it once the first finishes', async () => {
    push([{ id: 'log-concurrent' }]); // createSyncLog for the first run (org1)
    let resolveSync: (v: unknown) => void = () => {};
    const inFlight = new Promise((resolve) => { resolveSync = resolve; });
    // org1's sync pauses on inFlight; a different organization gets the normal, immediately-resolving integration.
    h.factory.getIntegration.mockImplementation(async (organizationId: string) =>
      organizationId === 'org1' ? { sync: () => inFlight } : makeIntegration(),
    );

    const first = engine.executeSync('org1', IntegrationProvider.WORKDAY, { type: SyncType.FULL });
    // Poll this test's own lock-map double (not a guess at an exact microtask-tick count) until the first
    // call's acquireLock has actually landed, bounded so a real failure to acquire fails fast instead of hanging.
    for (let i = 0; i < 50 && h.locks.size === 0; i++) await Promise.resolve();
    expect(h.locks.size).toBe(1);

    expect(await engine.isSyncRunning('org1', IntegrationProvider.WORKDAY, SyncType.FULL)).toBe(true);
    await expect(
      engine.executeSync('org1', IntegrationProvider.WORKDAY, { type: SyncType.FULL })
    ).rejects.toMatchObject({ code: 'SYNC_IN_PROGRESS' });
    // A different organization is a different lock key and is not blocked by the first run.
    push([{ id: 'log-other-org' }]);
    push({});
    await expect(
      engine.executeSync('org2', IntegrationProvider.WORKDAY, { type: SyncType.FULL })
    ).resolves.toMatchObject({ success: true });

    push({}); // updateSyncLog for the first run
    resolveSync({
      success: true, recordsProcessed: 1, recordsCreated: 1, recordsUpdated: 0, recordsFailed: 0, cursor: 'c', errors: [],
    });
    await first;
    expect(await engine.isSyncRunning('org1', IntegrationProvider.WORKDAY, SyncType.FULL)).toBe(false);
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

  it('isSyncRunning reflects running state', async () => {
    expect(await engine.isSyncRunning('org1', IntegrationProvider.WORKDAY, SyncType.FULL)).toBe(false);
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
