import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const syncQueueMock = vi.hoisted(() => ({
  add: vi.fn(async () => 1),
  getPending: vi.fn(async () => [] as unknown[]),
  complete: vi.fn(async () => undefined),
  fail: vi.fn(async () => undefined),
}));
vi.mock('../offline-storage', () => ({ syncQueue: syncQueueMock }));

import {
  BackgroundSyncManager,
  createBackgroundSyncManager,
  backgroundSync,
} from '../background-sync';

const op = (over: Record<string, unknown> = {}) => ({
  id: 1,
  type: 'create',
  entity: 'claim',
  data: { x: 1 },
  orgId: 'o1',
  status: 'pending',
  retryCount: 0,
  createdAt: 't',
  lastAttemptAt: null,
  ...over,
});

let registerMock: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

function setSupported(supported: boolean, readyImpl?: () => Promise<unknown>) {
  registerMock = vi.fn(async () => undefined);
  const registration = { sync: { register: registerMock } };
  const serviceWorker = supported
    ? { registration, ready: (readyImpl ?? (async () => registration))() }
    : {};
  vi.stubGlobal('navigator', { serviceWorker });
}

describe('background-sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setSupported(true);
    syncQueueMock.add.mockClear();
    syncQueueMock.getPending.mockReset().mockResolvedValue([]);
    syncQueueMock.complete.mockClear();
    syncQueueMock.fail.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('isSupported', () => {
    it('is true when serviceWorker registration exposes sync', () => {
      setSupported(true);
      expect(new BackgroundSyncManager().isSupported()).toBe(true);
    });

    it('is false without serviceWorker', () => {
      vi.stubGlobal('navigator', {});
      expect(new BackgroundSyncManager().isSupported()).toBe(false);
    });
  });

  describe('init', () => {
    it('registers background sync when supported', async () => {
      const mgr = new BackgroundSyncManager();
      await mgr.init();
      expect(registerMock).toHaveBeenCalledWith('sync-all');
    });

    it('falls back to periodic sync when unsupported', async () => {
      setSupported(false);
      const mgr = new BackgroundSyncManager();
      await mgr.init();
      await vi.runOnlyPendingTimersAsync();
      // initial periodic sync calls getPending
      expect(syncQueueMock.getPending).toHaveBeenCalled();
      mgr.stop();
    });

    it('falls back to periodic sync when registration fails', async () => {
      setSupported(true, async () => { throw new Error('no sw'); });
      const mgr = new BackgroundSyncManager();
      await mgr.init();
      await vi.runOnlyPendingTimersAsync();
      expect(syncQueueMock.getPending).toHaveBeenCalled();
      mgr.stop();
    });
  });

  describe('queueForSync', () => {
    it('adds the operation and triggers an entity sync', async () => {
      const mgr = new BackgroundSyncManager();
      await mgr.queueForSync({ type: 'create', entity: 'claim', data: {}, orgId: 'o1' });
      expect(syncQueueMock.add).toHaveBeenCalled();
      expect(registerMock).toHaveBeenCalledWith('sync-claim');
    });

    it('warns but does not throw when triggering sync fails', async () => {
      setSupported(true, async () => { throw new Error('boom'); });
      const mgr = new BackgroundSyncManager();
      await expect(
        mgr.queueForSync({ type: 'update', entity: 'member', data: {}, orgId: 'o1' })
      ).resolves.toBeUndefined();
      expect(syncQueueMock.add).toHaveBeenCalled();
    });

    it('skips trigger when unsupported', async () => {
      setSupported(false);
      const mgr = new BackgroundSyncManager();
      await mgr.queueForSync({ type: 'delete', entity: 'document', data: {}, orgId: 'o1' });
      expect(syncQueueMock.add).toHaveBeenCalled();
    });
  });

  describe('processPendingSync', () => {
    it('returns early when already processing', async () => {
      const mgr = new BackgroundSyncManager();
      (mgr as unknown as { isProcessing: boolean }).isProcessing = true;
      const r = await mgr.processPendingSync();
      expect(r).toEqual({ success: false, processed: 0, failed: 0 });
    });

    it('processes pending operations and completes them', async () => {
      syncQueueMock.getPending.mockResolvedValueOnce([op(), op({ id: 2, entity: 'member', type: 'update' })]);
      const mgr = new BackgroundSyncManager();
      const r = await mgr.processPendingSync();
      expect(r.processed).toBe(2);
      expect(r.failed).toBe(0);
      expect(syncQueueMock.complete).toHaveBeenCalledTimes(2);
    });

    it('handles operation failures for both retry branches', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      syncQueueMock.getPending.mockResolvedValueOnce([
        op({ id: 1, retryCount: 0 }),
        op({ id: 2, retryCount: 5, entity: 'unknownEntity', type: 'weird' }),
      ]);
      const mgr = new BackgroundSyncManager({ maxRetries: 3 });
      const r = await mgr.processPendingSync();
      expect(r.failed).toBe(2);
      expect(syncQueueMock.fail).toHaveBeenCalledTimes(2);
    });

    it('marks the run unsuccessful when fetching the queue throws', async () => {
      syncQueueMock.getPending.mockRejectedValueOnce(new Error('db down'));
      const mgr = new BackgroundSyncManager();
      const r = await mgr.processPendingSync();
      expect(r.success).toBe(false);
    });

    it('omits the body for delete operations', async () => {
      syncQueueMock.getPending.mockResolvedValueOnce([op({ type: 'delete' })]);
      const mgr = new BackgroundSyncManager();
      await mgr.processPendingSync();
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('DELETE');
      expect(init.body).toBeUndefined();
    });
  });

  describe('periodic sync lifecycle', () => {
    it('runs sync on the configured interval and can be stopped', async () => {
      setSupported(false);
      const mgr = new BackgroundSyncManager({ syncInterval: 1000 });
      await mgr.init();
      await vi.runOnlyPendingTimersAsync();
      syncQueueMock.getPending.mockClear();
      await vi.advanceTimersByTimeAsync(1000);
      expect(syncQueueMock.getPending).toHaveBeenCalled();
      mgr.stop();
      syncQueueMock.getPending.mockClear();
      await vi.advanceTimersByTimeAsync(2000);
      expect(syncQueueMock.getPending).not.toHaveBeenCalled();
    });

    it('stop is safe when no interval is running', () => {
      const mgr = new BackgroundSyncManager();
      expect(() => mgr.stop()).not.toThrow();
    });
  });

  describe('getStatus', () => {
    it('reports support, processing flag and pending count', async () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('localStorage', { getItem: vi.fn(() => '2024-01-01') });
      setSupported(true);
      syncQueueMock.getPending.mockResolvedValueOnce([op(), op({ id: 2 })]);
      const mgr = new BackgroundSyncManager();
      const status = await mgr.getStatus();
      expect(status.pendingCount).toBe(2);
      expect(status.isSupported).toBe(true);
      expect(status.lastSync).toBe('2024-01-01');
    });

    it('returns null lastSync when window is undefined', async () => {
      vi.stubGlobal('window', undefined);
      const mgr = new BackgroundSyncManager();
      const status = await mgr.getStatus();
      expect(status.lastSync).toBeNull();
    });
  });

  describe('factory and singleton', () => {
    it('createBackgroundSyncManager builds a manager', () => {
      expect(createBackgroundSyncManager()).toBeInstanceOf(BackgroundSyncManager);
    });
    it('exports a singleton', () => {
      expect(backgroundSync).toBeInstanceOf(BackgroundSyncManager);
    });
  });
});
