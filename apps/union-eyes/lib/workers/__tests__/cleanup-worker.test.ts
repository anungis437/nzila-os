import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';

const h = vi.hoisted(() => {
  const workers: Array<{
    name: string;
    processor: (job: unknown) => Promise<unknown>;
    handlers: Record<string, ((...a: unknown[]) => void)[]>;
    close: ReturnType<typeof vi.fn>;
  }> = [];
  const dbQueue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['update', 'set', 'where', 'delete', 'from', 'returning', 'limit']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = dbQueue.shift();
      return v instanceof Error ? Promise.reject(v).then(res, rej) : Promise.resolve(v).then(res, rej);
    };
    return chain;
  };
  const redisQuit = vi.fn(async () => undefined);
  const readdir = vi.fn(async () => [] as string[]);
  const stat = vi.fn(async () => ({ mtimeMs: 0 }));
  const unlink = vi.fn(async () => undefined);
  return { workers, dbQueue, makeChain, redisQuit, readdir, stat, unlink };
});

class MockWorker {
  name: string;
  processor: (job: unknown) => Promise<unknown>;
  handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
  close = vi.fn(async () => undefined);
  constructor(name: string, processor: (job: unknown) => Promise<unknown>) {
    this.name = name;
    this.processor = processor;
    h.workers.push(this as unknown as (typeof h.workers)[number]);
  }
  on(event: string, cb: (...a: unknown[]) => void) {
    (this.handlers[event] ||= []).push(cb);
    return this;
  }
}
class MockIORedis {
  quit = h.redisQuit;
}

const nodeRequire = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Module: any = nodeRequire('node:module');
const originalLoad = Module._load;
Module._load = function (request: string, ...args: unknown[]) {
  if (request === 'bullmq') return { Worker: MockWorker, Job: class {} };
  if (request === 'ioredis') return MockIORedis;
  return originalLoad.call(this, request, ...args);
};

afterAll(() => {
  Module._load = originalLoad;
});

const schemaProxy = () => new Proxy({}, {
  has: () => true,
  get: (_t, name) => {
    if (name === '__esModule') return false;
    return new Proxy({}, { get: (_o, col) => ({ __col: col }) });
  },
});

vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  lt: vi.fn(() => ({})),
}));

vi.mock('../../../db/db', () => ({
  db: {
    update: vi.fn(() => h.makeChain()),
    delete: vi.fn(() => h.makeChain()),
  },
}));

vi.mock('../../../db/schema/audit-security-schema', () => schemaProxy());
vi.mock('../../../db/schema/notifications-schema', () => schemaProxy());
vi.mock('../../../db/schema/user-management-schema', () => schemaProxy());

vi.mock('fs/promises', () => ({
  default: { readdir: h.readdir, stat: h.stat, unlink: h.unlink },
  readdir: h.readdir,
  stat: h.stat,
  unlink: h.unlink,
}));

const job = (data: Record<string, unknown>) => ({ data, updateProgress: vi.fn(async () => undefined) });

async function loadFresh() {
  vi.resetModules();
  return import('../cleanup-worker');
}

describe('cleanup-worker', () => {
  beforeEach(() => {
    h.workers.length = 0;
    h.dbQueue.length = 0;
    h.redisQuit.mockClear();
    h.readdir.mockReset().mockResolvedValue([]);
    h.stat.mockReset().mockResolvedValue({ mtimeMs: 0 });
    h.unlink.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exports a configured worker', async () => {
    const mod = await loadFresh();
    expect(mod.cleanupWorker).toBeDefined();
    expect(h.workers[0].name).toBe('cleanup');
  });

  it('archives old audit logs (target=logs)', async () => {
    await loadFresh();
    h.dbQueue.push({ rowCount: 7 });
    const r = await h.workers[0].processor(job({ target: 'logs', olderThanDays: 30 })) as { success: boolean; archived: number };
    expect(r.success).toBe(true);
    expect(r.archived).toBe(7);
  });

  it('defaults archived count to 0 when rowCount is missing', async () => {
    await loadFresh();
    h.dbQueue.push({});
    const r = await h.workers[0].processor(job({ target: 'logs', olderThanDays: 30 })) as { archived: number };
    expect(r.archived).toBe(0);
  });

  it('cleans up sessions (target=sessions) summing expired + inactive', async () => {
    await loadFresh();
    h.dbQueue.push({ rowCount: 3 }, { rowCount: 2 });
    const r = await h.workers[0].processor(job({ target: 'sessions' })) as { success: boolean; deleted: number };
    expect(r.success).toBe(true);
    expect(r.deleted).toBe(5);
  });

  it('returns 0 deleted sessions when the delete throws', async () => {
    await loadFresh();
    h.dbQueue.push(new Error('db down'));
    const r = await h.workers[0].processor(job({ target: 'sessions' })) as { deleted: number };
    expect(r.deleted).toBe(0);
  });

  it('cleans up temp files older than cutoff (target=temp-files)', async () => {
    await loadFresh();
    h.readdir.mockResolvedValueOnce(['old.tmp', 'new.tmp']);
    h.stat.mockResolvedValueOnce({ mtimeMs: 0 }).mockResolvedValueOnce({ mtimeMs: Date.now() + 1e12 });
    const r = await h.workers[0].processor(job({ target: 'temp-files', olderThanDays: 7 })) as { deleted: number };
    expect(r.deleted).toBe(1);
    expect(h.unlink).toHaveBeenCalledTimes(1);
  });

  it('swallows errors while cleaning temp files', async () => {
    await loadFresh();
    h.readdir.mockRejectedValueOnce(new Error('no dir'));
    const r = await h.workers[0].processor(job({ target: 'temp-files', olderThanDays: 7 })) as { deleted: number };
    expect(r.deleted).toBe(0);
  });

  it('cleans up old exports (target=exports)', async () => {
    await loadFresh();
    h.readdir.mockResolvedValueOnce(['report.csv']);
    h.stat.mockResolvedValueOnce({ mtimeMs: 0 });
    const r = await h.workers[0].processor(job({ target: 'exports', olderThanDays: 30 })) as { deleted: number };
    expect(r.deleted).toBe(1);
  });

  it('swallows errors while cleaning exports', async () => {
    await loadFresh();
    h.readdir.mockRejectedValueOnce(new Error('no dir'));
    const r = await h.workers[0].processor(job({ target: 'exports', olderThanDays: 30 })) as { deleted: number };
    expect(r.deleted).toBe(0);
  });

  it('throws on an unknown cleanup target', async () => {
    await loadFresh();
    await expect(h.workers[0].processor(job({ target: 'bogus' })))
      .rejects.toThrow('Unknown cleanup target: bogus');
  });

  it('registers event handlers and a SIGTERM shutdown', async () => {
    await loadFresh();
    const w = h.workers[0];
    expect(() => w.handlers.completed?.[0]({})).not.toThrow();
    expect(() => w.handlers.failed?.[0]({}, new Error('x'))).not.toThrow();
    expect(() => w.handlers.error?.[0](new Error('x'))).not.toThrow();
    process.emit('SIGTERM');
    await Promise.resolve();
    await Promise.resolve();
    expect(w.close).toHaveBeenCalled();
  });
});
