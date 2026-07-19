import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Minimal in-memory IndexedDB fake (only what offline-storage.ts uses)
// ---------------------------------------------------------------------------
function makeFakeIndexedDB() {
  let mode: 'ok' | 'error' = 'ok';
  const setMode = (m: 'ok' | 'error') => { mode = m; };
  let putError = false;
  const setPutError = (v: boolean) => { putError = v; };

  const fire = <T>(resultFn: () => T, forceErr = false) => {
    const req: Record<string, unknown> = { onsuccess: null, onerror: null, result: undefined, error: null };
    queueMicrotask(() => {
      if (mode === 'error' || forceErr) {
        req.error = new Error('idb fail');
        (req.onerror as (() => void) | null)?.();
        return;
      }
      try {
        req.result = resultFn();
        (req.onsuccess as ((e: unknown) => void) | null)?.({ target: req });
      } catch (e) {
        req.error = e;
        (req.onerror as (() => void) | null)?.();
      }
    });
    return req;
  };

  const storesMap = new Map<string, ReturnType<typeof createStore>>();

  function createStore(def: { keyPath: string; autoIncrement?: boolean }) {
    const records = new Map<unknown, Record<string, unknown>>();
    const indexes = new Map<string, string>();
    let autoKey = 0;
    const store = {
      createIndex(name: string, keyPath: string) { indexes.set(name, keyPath); return {}; },
      get: (key: unknown) => fire(() => records.get(key)),
      getAll: () => fire(() => [...records.values()]),
      put: (item: Record<string, unknown>) => fire(() => { const k = item[def.keyPath]; records.set(k, item); return k; }, putError),
      add: (item: Record<string, unknown>) => fire(() => {
        if (def.autoIncrement) { const k = ++autoKey; records.set(k, { ...item, [def.keyPath]: k }); return k; }
        const k = item[def.keyPath]; records.set(k, item); return k;
      }),
      delete: (key: unknown) => fire(() => { records.delete(key); return undefined; }),
      clear: () => fire(() => { records.clear(); return undefined; }),
      index: (name: string) => {
        const keyPath = indexes.get(name)!;
        return {
          getAll: (value: unknown) => fire(() => [...records.values()].filter(r => r[keyPath] === value)),
          getAllKeys: (value: unknown) => fire(() => [...records.entries()].filter(([, r]) => r[keyPath] === value).map(([k]) => k)),
          openCursor: (range?: { upper: number }) => {
            const req: Record<string, unknown> = { onsuccess: null, onerror: null };
            const matching = [...records.entries()].filter(([, r]) => (range ? (r[keyPath] as number) <= range.upper : true));
            let i = 0;
            const step = () => queueMicrotask(() => {
              if (mode === 'error') { req.error = new Error('idb fail'); (req.onerror as (() => void) | null)?.(); return; }
              if (i < matching.length) {
                const [key] = matching[i];
                const cursor = { delete: () => records.delete(key), continue: () => { i++; step(); } };
                (req.onsuccess as ((e: unknown) => void) | null)?.({ target: { result: cursor } });
              } else {
                (req.onsuccess as ((e: unknown) => void) | null)?.({ target: { result: null } });
              }
            });
            step();
            return req;
          },
        };
      },
    };
    return store;
  }

  const database = {
    objectStoreNames: { _names: new Set<string>(), contains(n: string) { return this._names.has(n); } },
    createObjectStore(name: string, opts: { keyPath: string; autoIncrement?: boolean }) {
      const s = createStore(opts);
      storesMap.set(name, s);
      database.objectStoreNames._names.add(name);
      return s;
    },
    transaction(_storeName: string, _mode: string) {
      return { objectStore: (n: string) => storesMap.get(n)! };
    },
  };

  const indexedDB = {
    open: () => {
      const req: Record<string, unknown> = { onsuccess: null, onerror: null, onupgradeneeded: null, result: null, error: null };
      queueMicrotask(() => {
        if (mode === 'error') { req.error = new Error('open fail'); (req.onerror as (() => void) | null)?.(); return; }
        req.result = database;
        (req.onupgradeneeded as ((e: unknown) => void) | null)?.({ target: { result: database } });
        (req.onsuccess as (() => void) | null)?.();
      });
      return req;
    },
  };

  const IDBKeyRange = { upperBound: (upper: number) => ({ upper }) };

  return { indexedDB, IDBKeyRange, setMode, setPutError };
}

type OfflineStorageModule = typeof import('../offline-storage');

let idb: ReturnType<typeof makeFakeIndexedDB>;
let OS: OfflineStorageModule;

describe('offline-storage', () => {
  beforeEach(async () => {
    vi.resetModules();
    idb = makeFakeIndexedDB();
    vi.stubGlobal('indexedDB', idb.indexedDB);
    vi.stubGlobal('IDBKeyRange', idb.IDBKeyRange);
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: 100, quota: 1000 }) } });
    OS = await import('../offline-storage');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('initOfflineDB', () => {
    it('initializes and caches the database', async () => {
      const db1 = await OS.initOfflineDB();
      const db2 = await OS.initOfflineDB();
      expect(db1).toBe(db2);
    });

    it('rejects when the database fails to open', async () => {
      idb.setMode('error');
      await expect(OS.initOfflineDB()).rejects.toBeTruthy();
    });
  });

  describe('offlineStorage CRUD', () => {
    it('put then get returns the stored item', async () => {
      await OS.offlineStorage.put(OS.STORES.CLAIMS, { id: 'c1', status: 'open', synced: 0, updatedAt: 1 });
      const item = await OS.offlineStorage.get<{ id: string }>(OS.STORES.CLAIMS, 'c1');
      expect(item?.id).toBe('c1');
    });

    it('get returns null for a missing key', async () => {
      const item = await OS.offlineStorage.get(OS.STORES.CLAIMS, 'missing');
      expect(item).toBeNull();
    });

    it('getAll returns all items', async () => {
      await OS.offlineStorage.put(OS.STORES.MEMBERS, { id: 'm1', organizationId: 'o1', synced: 1 });
      await OS.offlineStorage.put(OS.STORES.MEMBERS, { id: 'm2', organizationId: 'o1', synced: 0 });
      const all = await OS.offlineStorage.getAll(OS.STORES.MEMBERS);
      expect(all).toHaveLength(2);
    });

    it('getByIndex filters by an index value', async () => {
      await OS.offlineStorage.put(OS.STORES.MEMBERS, { id: 'm1', organizationId: 'o1', synced: 1 });
      await OS.offlineStorage.put(OS.STORES.MEMBERS, { id: 'm2', organizationId: 'o2', synced: 0 });
      const byOrg = await OS.offlineStorage.getByIndex(OS.STORES.MEMBERS, 'organizationId', 'o1');
      expect(byOrg).toHaveLength(1);
    });

    it('delete removes an item', async () => {
      await OS.offlineStorage.put(OS.STORES.CLAIMS, { id: 'c1', synced: 1 });
      await OS.offlineStorage.delete(OS.STORES.CLAIMS, 'c1');
      expect(await OS.offlineStorage.get(OS.STORES.CLAIMS, 'c1')).toBeNull();
    });

    it('clear empties a store', async () => {
      await OS.offlineStorage.put(OS.STORES.CLAIMS, { id: 'c1', synced: 1 });
      await OS.offlineStorage.clear(OS.STORES.CLAIMS);
      expect(await OS.offlineStorage.getAll(OS.STORES.CLAIMS)).toHaveLength(0);
    });

    it('hasUnsyncedItems and getUnsyncedCount reflect the synced index', async () => {
      await OS.offlineStorage.put(OS.STORES.CLAIMS, { id: 'c1', synced: 0 });
      await OS.offlineStorage.put(OS.STORES.CLAIMS, { id: 'c2', synced: 1 });
      expect(await OS.offlineStorage.hasUnsyncedItems(OS.STORES.CLAIMS)).toBe(true);
      expect(await OS.offlineStorage.getUnsyncedCount(OS.STORES.CLAIMS)).toBe(1);
    });

    it('hasUnsyncedItems is false when everything is synced', async () => {
      await OS.offlineStorage.put(OS.STORES.CLAIMS, { id: 'c1', synced: 1 });
      expect(await OS.offlineStorage.hasUnsyncedItems(OS.STORES.CLAIMS)).toBe(false);
    });

    it('rejects every CRUD operation when IndexedDB errors', async () => {
      await OS.initOfflineDB();
      idb.setMode('error');
      await expect(OS.offlineStorage.get(OS.STORES.CLAIMS, 'x')).rejects.toBeTruthy();
      await expect(OS.offlineStorage.getAll(OS.STORES.CLAIMS)).rejects.toBeTruthy();
      await expect(OS.offlineStorage.getByIndex(OS.STORES.MEMBERS, 'organizationId', 'o1')).rejects.toBeTruthy();
      await expect(OS.offlineStorage.put(OS.STORES.CLAIMS, { id: 'c9' })).rejects.toBeTruthy();
      await expect(OS.offlineStorage.delete(OS.STORES.CLAIMS, 'c9')).rejects.toBeTruthy();
      await expect(OS.offlineStorage.clear(OS.STORES.CLAIMS)).rejects.toBeTruthy();
      await expect(OS.offlineStorage.hasUnsyncedItems(OS.STORES.CLAIMS)).rejects.toBeTruthy();
      await expect(OS.offlineStorage.getUnsyncedCount(OS.STORES.CLAIMS)).rejects.toBeTruthy();
    });
  });

  describe('syncQueue', () => {
    it('adds, lists, completes and fails operations', async () => {
      const id = await OS.syncQueue.add({ type: 'create', entity: 'claim', data: { x: 1 }, orgId: 'o1' });
      expect(typeof id).toBe('number');
      const pending = await OS.syncQueue.getPending();
      expect(pending).toHaveLength(1);
      await OS.syncQueue.fail(id, 'network error');
      const stillPending = await OS.syncQueue.getPending();
      expect(stillPending).toHaveLength(0);
      await OS.syncQueue.complete(id);
      expect(await OS.offlineStorage.getAll(OS.STORES.SYNC_QUEUE)).toHaveLength(0);
    });

    it('fail resolves quietly when the operation no longer exists', async () => {
      await expect(OS.syncQueue.fail(9999, 'gone')).resolves.toBeUndefined();
    });

    it('fail rejects when persisting the failed operation errors', async () => {
      const id = await OS.syncQueue.add({ type: 'create', entity: 'claim', data: {}, orgId: 'o1' });
      idb.setPutError(true);
      await expect(OS.syncQueue.fail(id, 'boom')).rejects.toBeTruthy();
      idb.setPutError(false);
    });

    it('rejects queue operations when IndexedDB errors', async () => {
      await OS.initOfflineDB();
      idb.setMode('error');
      await expect(OS.syncQueue.add({ type: 'create', entity: 'claim', data: {}, orgId: 'o1' })).rejects.toBeTruthy();
      await expect(OS.syncQueue.getPending()).rejects.toBeTruthy();
      await expect(OS.syncQueue.complete(1)).rejects.toBeTruthy();
      await expect(OS.syncQueue.fail(1, 'e')).rejects.toBeTruthy();
    });
  });

  describe('offlineCache', () => {
    it('set then get returns the cached value', async () => {
      await OS.offlineCache.set('k1', { v: 42 }, 60);
      expect(await OS.offlineCache.get('k1')).toEqual({ v: 42 });
    });

    it('get returns null for a missing key', async () => {
      expect(await OS.offlineCache.get('nope')).toBeNull();
    });

    it('get returns null and removes expired entries', async () => {
      await OS.offlineCache.set('expired', { v: 1 }, -1);
      expect(await OS.offlineCache.get('expired')).toBeNull();
    });

    it('clearExpired drops only stale entries', async () => {
      await OS.offlineCache.set('fresh', { v: 1 }, 60);
      await OS.offlineCache.set('stale', { v: 2 }, -1);
      await OS.offlineCache.clearExpired();
      expect(await OS.offlineCache.get('fresh')).toEqual({ v: 1 });
    });

    it('rejects cache operations when IndexedDB errors', async () => {
      await OS.initOfflineDB();
      idb.setMode('error');
      await expect(OS.offlineCache.set('k', 1)).rejects.toBeTruthy();
      await expect(OS.offlineCache.get('k')).rejects.toBeTruthy();
      await expect(OS.offlineCache.clearExpired()).rejects.toBeTruthy();
    });
  });

  describe('storage quota and clearing', () => {
    it('getStorageQuota reports usage when the API is available', async () => {
      const quota = await OS.getStorageQuota();
      expect(quota.used).toBe(100);
      expect(quota.percentage).toBeGreaterThan(0);
    });

    it('getStorageQuota returns zeros when the API is unavailable', async () => {
      vi.stubGlobal('navigator', {});
      const quota = await OS.getStorageQuota();
      expect(quota).toEqual({ used: 0, available: 0, percentage: 0 });
    });

    it('clearAllOfflineData clears every store', async () => {
      await OS.offlineStorage.put(OS.STORES.CLAIMS, { id: 'c1', synced: 1 });
      await OS.offlineStorage.put(OS.STORES.MEMBERS, { id: 'm1', synced: 1 });
      await OS.clearAllOfflineData();
      expect(await OS.offlineStorage.getAll(OS.STORES.CLAIMS)).toHaveLength(0);
      expect(await OS.offlineStorage.getAll(OS.STORES.MEMBERS)).toHaveLength(0);
    });

    it('clearAllOfflineData rejects when IndexedDB errors', async () => {
      await OS.initOfflineDB();
      idb.setMode('error');
      await expect(OS.clearAllOfflineData()).rejects.toBeTruthy();
    });
  });
});
