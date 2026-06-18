import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';

const h = vi.hoisted(() => {
  const workers: Array<{
    name: string;
    processor: (job: unknown) => Promise<unknown>;
    handlers: Record<string, ((...a: unknown[]) => void)[]>;
    close: ReturnType<typeof vi.fn>;
  }> = [];
  const redisQuit = vi.fn(async () => undefined);
  const messagesCreate = vi.fn(async () => ({ sid: 'SM123', status: 'queued' }));
  const findFirst = vi.fn(async () => ({ smsEnabled: true }));
  const insertValues = vi.fn(async () => undefined);
  return { workers, redisQuit, messagesCreate, findFirst, insertValues };
});

// bullmq + ioredis are loaded via require() of externalized node_modules, which
// vi.mock cannot intercept. Patch Node's CJS loader instead.
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

vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
}));

vi.mock('twilio', () => ({
  default: vi.fn(() => ({ messages: { create: h.messagesCreate } })),
}));

vi.mock('../../../db/db', () => ({
  db: {
    query: { userNotificationPreferences: { findFirst: h.findFirst } },
    insert: vi.fn(() => ({ values: h.insertValues })),
  },
}));

vi.mock('../../../db/schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, name) => {
    if (name === '__esModule') return false;
    return new Proxy({}, { get: (_o, col) => ({ __col: col }) });
  },
}));

const job = (data: Record<string, unknown>) => ({ data, updateProgress: vi.fn(async () => undefined) });

async function loadFresh(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import('../sms-worker');
}

const FULL_TWILIO = {
  TWILIO_ACCOUNT_SID: 'AC',
  TWILIO_AUTH_TOKEN: 'tok',
  TWILIO_PHONE_NUMBER: '+15550001111',
};

describe('sms-worker', () => {
  beforeEach(() => {
    h.workers.length = 0;
    h.redisQuit.mockClear();
    h.messagesCreate.mockClear().mockResolvedValue({ sid: 'SM123', status: 'queued' });
    h.findFirst.mockClear().mockResolvedValue({ smsEnabled: true });
    h.insertValues.mockClear().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exports a configured worker when Twilio env is present', async () => {
    const mod = await loadFresh(FULL_TWILIO);
    expect(mod.smsWorker).toBeDefined();
    expect(h.workers[0].name).toBe('sms');
  });

  describe('processSmsJob (via worker processor)', () => {
    it('sends an SMS for a non-critical job when the user opts in', async () => {
      await loadFresh(FULL_TWILIO);
      h.findFirst.mockResolvedValueOnce({ smsEnabled: true });
      const r = await h.workers[0].processor(job({ to: '5551234567', message: 'hi', priority: 2 })) as { success: boolean; sid: string };
      expect(r.success).toBe(true);
      expect(r.sid).toBe('SM123');
      expect(h.messagesCreate).toHaveBeenCalledWith(expect.objectContaining({ to: '+15551234567' }));
    });

    it('skips sending when the user has opted out', async () => {
      await loadFresh(FULL_TWILIO);
      h.findFirst.mockResolvedValueOnce({ smsEnabled: false });
      const r = await h.workers[0].processor(job({ to: '5551234567', message: 'hi', priority: 2 })) as { skipped: boolean };
      expect(r.skipped).toBe(true);
      expect(h.messagesCreate).not.toHaveBeenCalled();
    });

    it('bypasses preference check for critical (priority 1) jobs', async () => {
      await loadFresh(FULL_TWILIO);
      const r = await h.workers[0].processor(job({ to: '15551234567', message: 'urgent', priority: 1 })) as { success: boolean };
      expect(r.success).toBe(true);
      expect(h.findFirst).not.toHaveBeenCalled();
      expect(h.messagesCreate).toHaveBeenCalledWith(expect.objectContaining({ to: '+15551234567' }));
    });

    it('formats a bare international number with a leading plus', async () => {
      await loadFresh(FULL_TWILIO);
      await h.workers[0].processor(job({ to: '447911123456', message: 'hi', priority: 1 }));
      expect(h.messagesCreate).toHaveBeenCalledWith(expect.objectContaining({ to: '+447911123456' }));
    });

    it('logs and rethrows when Twilio send fails', async () => {
      await loadFresh(FULL_TWILIO);
      h.messagesCreate.mockRejectedValueOnce(new Error('twilio down'));
      await expect(h.workers[0].processor(job({ to: '5551234567', message: 'hi', priority: 1 })))
        .rejects.toThrow('twilio down');
      expect(h.insertValues).toHaveBeenCalled();
    });

    it('handles a non-Error throw from Twilio', async () => {
      await loadFresh(FULL_TWILIO);
      h.messagesCreate.mockRejectedValueOnce('boom');
      await expect(h.workers[0].processor(job({ to: '5551234567', message: 'hi', priority: 1 })))
        .rejects.toBe('boom');
    });

    it('returns failure when Twilio is not configured', async () => {
      await loadFresh({ TWILIO_ACCOUNT_SID: undefined, TWILIO_AUTH_TOKEN: undefined, TWILIO_PHONE_NUMBER: undefined });
      const r = await h.workers[0].processor(job({ to: '5551234567', message: 'hi', priority: 2 })) as { success: boolean; error: string };
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/not configured/);
    });

    it('falls back to opted-out when the preference lookup throws', async () => {
      await loadFresh(FULL_TWILIO);
      h.findFirst.mockRejectedValueOnce(new Error('db error'));
      const r = await h.workers[0].processor(job({ to: '5551234567', message: 'hi', priority: 2 })) as { skipped: boolean };
      expect(r.skipped).toBe(true);
    });

    it('swallows errors when writing to the SMS history log', async () => {
      await loadFresh(FULL_TWILIO);
      h.insertValues.mockRejectedValue(new Error('insert failed'));
      const r = await h.workers[0].processor(job({ to: '5551234567', message: 'hi', priority: 1 })) as { success: boolean };
      expect(r.success).toBe(true);
    });
  });

  describe('config validation branches', () => {
    it('reports missing auth token', async () => {
      await loadFresh({ ...FULL_TWILIO, TWILIO_AUTH_TOKEN: undefined });
      const r = await h.workers[0].processor(job({ to: '5551234567', message: 'hi', priority: 2 })) as { success: boolean };
      expect(r.success).toBe(false);
    });

    it('reports missing phone number', async () => {
      await loadFresh({ ...FULL_TWILIO, TWILIO_PHONE_NUMBER: undefined });
      const r = await h.workers[0].processor(job({ to: '5551234567', message: 'hi', priority: 2 })) as { success: boolean };
      expect(r.success).toBe(false);
    });
  });

  describe('worker event handlers and shutdown', () => {
    it('registers completed/failed/error handlers that run without error', async () => {
      await loadFresh(FULL_TWILIO);
      const w = h.workers[0];
      expect(() => w.handlers.completed?.[0]({})).not.toThrow();
      expect(() => w.handlers.failed?.[0]({}, new Error('x'))).not.toThrow();
      expect(() => w.handlers.error?.[0](new Error('x'))).not.toThrow();
    });

    it('shutdown closes the worker on SIGTERM', async () => {
      await loadFresh(FULL_TWILIO);
      const w = h.workers[0];
      process.emit('SIGTERM');
      await Promise.resolve();
      await Promise.resolve();
      expect(w.close).toHaveBeenCalled();
    });
  });
});
