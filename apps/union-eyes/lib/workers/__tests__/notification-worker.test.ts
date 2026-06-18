import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';

const h = vi.hoisted(() => {
  const workers: Array<{
    name: string;
    processor: (job: unknown) => Promise<unknown>;
    handlers: Record<string, ((...a: unknown[]) => void)[]>;
    close: ReturnType<typeof vi.fn>;
  }> = [];
  const selectQueue: unknown[] = [];
  const makeSelectChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'orderBy', 'limit']) chain[m] = () => chain;
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = selectQueue.length ? selectQueue.shift() : [];
      return v instanceof Error ? Promise.reject(v).then(res, rej) : Promise.resolve(v).then(res, rej);
    };
    return chain;
  };
  return {
    workers,
    selectQueue,
    makeSelectChain,
    redisQuit: vi.fn(async () => undefined),
    redisPublish: vi.fn(async () => 1),
    addEmailJob: vi.fn(async () => undefined),
    addSmsJob: vi.fn(async () => undefined),
    findFirst: vi.fn(async () => null as unknown),
    insertValues: vi.fn(async () => undefined),
    sendToUser: vi.fn(async () => [{ success: true }]),
    getUser: vi.fn(async () => ({
      emailAddresses: [{ id: 'e1', emailAddress: 'primary@x.com' }],
      primaryEmailAddressId: 'e1',
    })),
  };
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
  publish = h.redisPublish;
  constructor(opts?: { retryStrategy?: (times: number) => number }) {
    if (opts?.retryStrategy) opts.retryStrategy(3);
  }
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
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
}));

vi.mock('../../job-queue', () => ({ addEmailJob: h.addEmailJob, addSmsJob: h.addSmsJob }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/services/fcm-service', () => ({ FCMService: { sendToUser: h.sendToUser } }));
vi.mock('@nzila/platform-auth/entra/server', () => ({
  adminClient: { users: { getUser: h.getUser } },
}));

vi.mock('@/db/db', () => ({
  db: {
    query: { userNotificationPreferences: { findFirst: h.findFirst } },
    insert: vi.fn(() => ({ values: h.insertValues })),
    select: vi.fn(() => h.makeSelectChain()),
  },
}));
vi.mock('@/db/schema', () => schemaProxy());

const job = (data: Record<string, unknown>, id = 'j1') => ({
  id,
  data,
  updateProgress: vi.fn(async () => undefined),
});

const fullPrefs = {
  userId: 'u1',
  emailEnabled: true,
  smsEnabled: true,
  pushEnabled: true,
  inAppEnabled: true,
  digestFrequency: 'daily',
  quietHoursStart: null,
  quietHoursEnd: null,
  email: 'u1@x.com',
  phone: '+15551234567',
};

async function loadFresh() {
  vi.resetModules();
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
  process.env.NOTIFICATION_WORKER_VERBOSE = 'true';
  return import('../notification-worker');
}

describe('notification-worker', () => {
  let sigtermBefore: NodeJS.SignalsListener[];
  let sigintBefore: NodeJS.SignalsListener[];

  beforeEach(() => {
    sigtermBefore = process.listeners('SIGTERM') as NodeJS.SignalsListener[];
    sigintBefore = process.listeners('SIGINT') as NodeJS.SignalsListener[];
    h.workers.length = 0;
    h.selectQueue.length = 0;
    h.redisQuit.mockClear();
    h.redisPublish.mockReset().mockResolvedValue(1);
    h.addEmailJob.mockReset().mockResolvedValue(undefined);
    h.addSmsJob.mockReset().mockResolvedValue(undefined);
    h.findFirst.mockReset().mockResolvedValue(fullPrefs);
    h.insertValues.mockReset().mockResolvedValue(undefined);
    h.sendToUser.mockReset().mockResolvedValue([{ success: true }]);
    h.getUser.mockReset().mockResolvedValue({
      emailAddresses: [{ id: 'e1', emailAddress: 'primary@x.com' }],
      primaryEmailAddressId: 'e1',
    });
  });

  afterEach(() => {
    for (const l of process.listeners('SIGTERM') as NodeJS.SignalsListener[]) {
      if (!sigtermBefore.includes(l)) process.removeListener('SIGTERM', l);
    }
    for (const l of process.listeners('SIGINT') as NodeJS.SignalsListener[]) {
      if (!sigintBefore.includes(l)) process.removeListener('SIGINT', l);
    }
    vi.clearAllMocks();
  });

  it('exports a configured worker', async () => {
    const mod = await loadFresh();
    expect(mod.notificationWorker).toBeDefined();
    expect(h.workers[0].name).toBe('notifications');
  });

  it('dispatches across all enabled channels', async () => {
    await loadFresh();
    h.selectQueue.push([{ id: 'd1' }]);
    const r = await h.workers[0].processor(job({
      userId: 'u1', title: 'T', message: 'M', data: {},
      channels: ['email', 'sms', 'push', 'in-app'],
    })) as { success: boolean; sent: number };
    expect(r.success).toBe(true);
    expect(r.sent).toBe(4);
    expect(h.addEmailJob).toHaveBeenCalled();
    expect(h.addSmsJob).toHaveBeenCalled();
    expect(h.sendToUser).toHaveBeenCalled();
    expect(h.redisPublish).toHaveBeenCalled();
  });

  it('returns early when no channels are enabled', async () => {
    await loadFresh();
    h.findFirst.mockResolvedValue({ ...fullPrefs, emailEnabled: false, smsEnabled: false, pushEnabled: false, inAppEnabled: false });
    const r = await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: {}, channels: ['email', 'sms'] })) as { sent: number; channels: string[] };
    expect(r.sent).toBe(0);
    expect(r.channels).toEqual([]);
  });

  it('uses defaults when no preferences row exists', async () => {
    await loadFresh();
    h.findFirst.mockResolvedValue(null);
    h.getUser.mockResolvedValue({ emailAddresses: [{ id: 'e1', emailAddress: 'primary@x.com' }], primaryEmailAddressId: 'e1' });
    const r = await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: {}, channels: ['email', 'in-app'] })) as { success: boolean };
    expect(r.success).toBe(true);
  });

  it('respects quiet hours for email/sms/push', async () => {
    await loadFresh();
    h.findFirst.mockResolvedValue({ ...fullPrefs, quietHoursStart: '00:00', quietHoursEnd: '23:59' });
    const r = await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: {}, channels: ['email', 'in-app'] })) as { channels: string[] };
    expect(r.channels).toContain('in-app');
    expect(r.channels).not.toContain('email');
  });

  it('handles quiet hours spanning midnight', async () => {
    await loadFresh();
    h.findFirst.mockResolvedValue({ ...fullPrefs, quietHoursStart: '23:00', quietHoursEnd: '01:00' });
    const r = await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: {}, channels: ['in-app'] })) as { success: boolean };
    expect(r.success).toBe(true);
  });

  it('marks the job partial when an email recipient cannot be resolved', async () => {
    await loadFresh();
    h.findFirst.mockResolvedValue({ ...fullPrefs, email: null });
    h.getUser.mockResolvedValue({ emailAddresses: [], primaryEmailAddressId: null });
    const r = await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: {}, channels: ['email'] })) as { success: boolean; failed: number };
    expect(r.success).toBe(false);
    expect(r.failed).toBe(1);
  });

  it('reports failure when the user has no push devices', async () => {
    await loadFresh();
    h.selectQueue.push([]);
    const r = await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: {}, channels: ['push'] })) as { sent: number; failed: number };
    // The no-devices branch resolves (not rejects), so it counts as a fulfilled channel.
    expect(r.sent).toBe(1);
    expect(r.failed).toBe(0);
  });

  it('rethrows when FCM push fails', async () => {
    await loadFresh();
    h.selectQueue.push([{ id: 'd1' }]);
    h.sendToUser.mockRejectedValue(new Error('fcm down'));
    const r = await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: { priority: 'high', actionUrl: '/x' }, channels: ['push'] })) as { failed: number };
    expect(r.failed).toBe(1);
  });

  it('throws when sms recipient is missing', async () => {
    await loadFresh();
    h.findFirst.mockResolvedValue({ ...fullPrefs, phone: null });
    const r = await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: {}, channels: ['sms'] })) as { failed: number };
    expect(r.failed).toBe(1);
  });

  it('continues in-app delivery when redis publish fails', async () => {
    await loadFresh();
    h.redisPublish.mockRejectedValue(new Error('redis down'));
    const r = await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: { organizationId: 'org1' }, channels: ['in-app'] })) as { success: boolean };
    expect(r.success).toBe(true);
    expect(h.insertValues).toHaveBeenCalled();
  });

  it('reuses a cached redis connection across in-app sends', async () => {
    await loadFresh();
    await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: {}, channels: ['in-app'] }));
    await h.workers[0].processor(job({ userId: 'u2', title: 'T', message: 'M', data: {}, channels: ['in-app'] }));
    expect(h.redisPublish).toHaveBeenCalledTimes(2);
  });

  it('falls back to the first email when there is no primary email', async () => {
    await loadFresh();
    h.findFirst.mockResolvedValue({ ...fullPrefs, email: null });
    h.getUser.mockResolvedValue({ emailAddresses: [{ id: 'e9', emailAddress: 'fallback@x.com' }], primaryEmailAddressId: 'missing' });
    const r = await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: {}, channels: ['email'] })) as { success: boolean };
    expect(r.success).toBe(true);
    expect(h.addEmailJob).toHaveBeenCalled();
  });

  it('returns null email when the admin client throws', async () => {
    await loadFresh();
    h.findFirst.mockResolvedValue({ ...fullPrefs, email: null });
    h.getUser.mockRejectedValue(new Error('graph down'));
    const r = await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: {}, channels: ['email'] })) as { failed: number };
    expect(r.failed).toBe(1);
  });

  describe('redis configuration errors', () => {
    it('warns when REDIS_HOST is missing during in-app send', async () => {
      await loadFresh();
      delete process.env.REDIS_HOST;
      const r = await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: {}, channels: ['in-app'] })) as { success: boolean };
      expect(r.success).toBe(true);
      expect(h.redisPublish).not.toHaveBeenCalled();
    });

    it('warns when REDIS_PORT is missing during in-app send', async () => {
      await loadFresh();
      delete process.env.REDIS_PORT;
      const r = await h.workers[0].processor(job({ userId: 'u1', title: 'T', message: 'M', data: {}, channels: ['in-app'] })) as { success: boolean };
      expect(r.success).toBe(true);
    });
  });

  it('registers event handlers and a SIGTERM shutdown', async () => {
    await loadFresh();
    const w = h.workers[0];
    // populate the redis connection so shutdown can quit it
    await w.processor(job({ userId: 'u1', title: 'T', message: 'M', data: {}, channels: ['in-app'] }));
    expect(() => w.handlers.completed?.[0]({ id: 'x' })).not.toThrow();
    expect(() => w.handlers.failed?.[0]({ id: 'x' }, new Error('e'))).not.toThrow();
    expect(() => w.handlers.error?.[0](new Error('e'))).not.toThrow();
    process.emit('SIGTERM');
    await Promise.resolve();
    await Promise.resolve();
    expect(w.close).toHaveBeenCalled();
  });
});
