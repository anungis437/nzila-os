import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntegrationProvider, SyncType, SyncStatus } from '../types';

const h = vi.hoisted(() => {
  const q: unknown[] = [];
  const shift = () => (q.length ? q.shift() : []);
  const setCalls: Record<string, unknown>[] = [];
  const makeChain = () => {
    const c: Record<string, unknown> = {};
    for (const m of [
      'select', 'from', 'where', 'orderBy', 'limit', 'values', 'returning',
      'onConflictDoUpdate', 'update', 'insert', 'delete', 'innerJoin', 'leftJoin',
      'offset', 'groupBy',
    ]) c[m] = () => c;
    // set() is recorded (not just chained) so a test can see exactly what updateSyncLog wrote - in particular, the
    // status/error it chose when a sync's lease was lost mid-run.
    c.set = (changes: Record<string, unknown>) => {
      setCalls.push(changes);
      return c;
    };
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
  // Token-checked, like releaseLock: only "renews" (a no-op for this in-memory double, which has no TTL/expiry of its
  // own) when the caller's token still matches what is held. A stale or already-lost token returns false.
  const extendLock = vi.fn(async (name: string, token: string, _ttlSeconds?: number, namespace = 'lock') => {
    const key = lockKey(name, namespace);
    return locks.get(key) === token;
  });
  const isLocked = vi.fn(async (name: string, namespace = 'lock') => locks.has(lockKey(name, namespace)));
  return { q, db, factory, cron, cronCb: undefined as undefined | (() => unknown), locks, acquireLock, releaseLock, extendLock, isLocked, setCalls };
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
  extendLock: h.extendLock,
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
    h.setCalls.length = 0;
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


  // DEF: SyncEngine lease renewal (Workstream C) - a sync whose external calls outlive the lock TTL must keep renewing
  // its own lock, or a second instance could acquire the same jobKey while this one is still running.
  it('renews the lock before the TTL would expire for a sync that runs longer than the renewal interval', async () => {
    push([{ id: 'log-renew' }]); // createSyncLog
    let resolveSync: (v: unknown) => void = () => {};
    const inFlight = new Promise((resolve) => { resolveSync = resolve; });
    h.factory.getIntegration.mockResolvedValue({ sync: () => inFlight });

    vi.useFakeTimers();
    try {
      const run = engine.executeSync('org1', IntegrationProvider.WORKDAY, { type: SyncType.FULL });
      await vi.advanceTimersByTimeAsync(0); // let acquireLock/createSyncLog settle

      // Advance past one renewal tick (TTL/2 = 300s at the current 600s TTL).
      await vi.advanceTimersByTimeAsync(300_000);
      expect(h.extendLock).toHaveBeenCalledTimes(1);
      expect(h.extendLock).toHaveBeenCalledWith(
        'org1:workday:full', expect.any(String), 600, 'integration-sync',
      );
      // The renewal succeeded (the honest-double extendLock checks the token still matches), so the lock the
      // concurrency check reads is still held well past the halfway point of the original TTL.
      expect(await engine.isSyncRunning('org1', IntegrationProvider.WORKDAY, SyncType.FULL)).toBe(true);

      push({}); // updateSyncLog
      resolveSync({ success: true, recordsProcessed: 1, recordsCreated: 1, recordsUpdated: 0, recordsFailed: 0, cursor: 'c', errors: [] });
      const result = await run;
      expect(result.success).toBe(true);
      expect(result.metadata?.leaseRenewalLost).toBeUndefined();
      expect(h.setCalls.at(-1)).toMatchObject({ status: SyncStatus.SUCCESS });
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops renewing and downgrades a successful result to PARTIAL when a renewal tick fails (lease lost)', async () => {
    push([{ id: 'log-lost' }]); // createSyncLog
    let resolveSync: (v: unknown) => void = () => {};
    const inFlight = new Promise((resolve) => { resolveSync = resolve; });
    h.factory.getIntegration.mockResolvedValue({ sync: () => inFlight });
    // Simulates either another holder having taken over after an expiry, or Redis being unreachable for the renewal.
    h.extendLock.mockResolvedValue(false);

    vi.useFakeTimers();
    try {
      const run = engine.executeSync('org1', IntegrationProvider.WORKDAY, { type: SyncType.FULL });
      await vi.advanceTimersByTimeAsync(0);

      await vi.advanceTimersByTimeAsync(300_000); // first renewal tick fails -> lease marked lost
      expect(h.extendLock).toHaveBeenCalledTimes(1);

      // A second full interval period must not retry: once the lease is lost, no further renewal is attempted.
      await vi.advanceTimersByTimeAsync(300_000);
      expect(h.extendLock).toHaveBeenCalledTimes(1);

      push({}); // updateSyncLog
      resolveSync({ success: true, recordsProcessed: 1, recordsCreated: 1, recordsUpdated: 0, recordsFailed: 0, cursor: 'c', errors: [] });
      const result = await run;

      // The sync itself still reports success (we cannot interrupt an in-flight third-party call), but a result whose
      // exclusivity could not be guaranteed for the full duration is never reported as a clean success.
      expect(result.success).toBe(true);
      expect(result.metadata).toMatchObject({ leaseRenewalLost: true });
      expect(h.setCalls.at(-1)).toMatchObject({ status: SyncStatus.PARTIAL });
      expect(String(h.setCalls.at(-1)?.error)).toMatch(/lease/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a sync that already failed stays FAILED (not masked as PARTIAL) even if the lease was also lost', async () => {
    push([{ id: 'log-failed-and-lost' }]); // createSyncLog
    let rejectSync: (e: unknown) => void = () => {};
    const inFlight = new Promise((_resolve, reject) => { rejectSync = reject; });
    h.factory.getIntegration.mockResolvedValue({ sync: () => inFlight });
    h.extendLock.mockResolvedValue(false);

    vi.useFakeTimers();
    try {
      const run = engine.executeSync('org1', IntegrationProvider.WORKDAY, { type: SyncType.FULL });
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(300_000);
      expect(h.extendLock).toHaveBeenCalledTimes(1);

      rejectSync(new Error('adapter boom'));
      await expect(run).rejects.toThrow('adapter boom');
      // executeSync rethrows before writing a sync-log update in this path (matches the pre-existing throw/catch
      // behaviour); the lease-lost renewal loop still must not keep running once the call has settled.
      await vi.advanceTimersByTimeAsync(300_000);
      expect(h.extendLock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
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
