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
    for (const m of ['from', 'where', 'orderBy', 'limit', 'select']) chain[m] = () => chain;
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
    render: vi.fn(async () => '<html>'),
    sendEmail: vi.fn(async () => undefined),
    findFirst: vi.fn(async () => ({ emailEnabled: true })),
    findMany: vi.fn(async () => [] as unknown[]),
    insertValues: vi.fn(async () => undefined),
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
  desc: vi.fn(() => ({})),
}));

vi.mock('@react-email/render', () => ({ render: h.render }));
vi.mock('../../email-service', () => ({ sendEmail: h.sendEmail }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const templateMock = () => ({ default: vi.fn(() => ({})) });
vi.mock('../../../emails/WelcomeEmail', () => templateMock());
vi.mock('../../../emails/PasswordResetEmail', () => templateMock());
vi.mock('../../../emails/DigestEmail', () => templateMock());
vi.mock('../../../emails/ReportReadyEmail', () => templateMock());
vi.mock('../../../emails/DeadlineAlertEmail', () => templateMock());
vi.mock('../../../emails/NotificationEmail', () => templateMock());

vi.mock('../../../db/db', () => ({
  db: {
    query: {
      userNotificationPreferences: { findFirst: h.findFirst, findMany: h.findMany },
    },
    insert: vi.fn(() => ({ values: h.insertValues })),
    select: vi.fn(() => h.makeSelectChain()),
  },
}));

vi.mock('../../../db/schema', () => schemaProxy());

const job = (data: Record<string, unknown>, name = 'send-email', id = 'j1') => ({
  id,
  name,
  data,
  updateProgress: vi.fn(async () => undefined),
});

async function loadFresh() {
  vi.resetModules();
  return import('../email-worker');
}

describe('email-worker', () => {
  beforeEach(() => {
    h.workers.length = 0;
    h.selectQueue.length = 0;
    h.redisQuit.mockClear();
    h.render.mockReset().mockResolvedValue('<html>');
    h.sendEmail.mockReset().mockResolvedValue(undefined);
    h.findFirst.mockReset().mockResolvedValue({ emailEnabled: true });
    h.findMany.mockReset().mockResolvedValue([]);
    h.insertValues.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exports a configured worker', async () => {
    const mod = await loadFresh();
    expect(mod.emailWorker).toBeDefined();
    expect(h.workers[0].name).toBe('email');
  });

  it('sends an email to a single recipient', async () => {
    await loadFresh();
    const r = await h.workers[0].processor(job({ to: 'a@x.com', subject: 'Hi', template: 'welcome', data: {}, priority: 2 })) as { success: boolean; sent: number; total: number };
    expect(r.success).toBe(true);
    expect(r.sent).toBe(1);
    expect(r.total).toBe(1);
    expect(h.sendEmail).toHaveBeenCalled();
  });

  it('skips non-critical email when the user has disabled email', async () => {
    await loadFresh();
    h.findFirst.mockResolvedValue({ emailEnabled: false });
    const r = await h.workers[0].processor(job({ to: 'a@x.com', subject: 'Hi', template: 'welcome', data: {}, priority: 2 })) as { success: boolean };
    expect(r.success).toBe(true);
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it('still sends a critical (priority 1) email even when disabled', async () => {
    await loadFresh();
    h.findFirst.mockResolvedValue({ emailEnabled: false });
    await h.workers[0].processor(job({ to: 'a@x.com', subject: 'Hi', template: 'welcome', data: {}, priority: 1 }));
    expect(h.sendEmail).toHaveBeenCalled();
  });

  it('defaults preferences to enabled when the lookup throws', async () => {
    await loadFresh();
    h.findFirst.mockRejectedValue(new Error('db error'));
    await h.workers[0].processor(job({ to: 'a@x.com', subject: 'Hi', template: 'welcome', data: {}, priority: 2 }));
    expect(h.sendEmail).toHaveBeenCalled();
  });

  it('handles an array of recipients', async () => {
    await loadFresh();
    const r = await h.workers[0].processor(job({ to: ['a@x.com', 'b@x.com'], subject: 'Hi', template: 'welcome', data: {}, priority: 2 })) as { total: number };
    expect(r.total).toBe(2);
  });

  it('throws when the template is unknown', async () => {
    await loadFresh();
    await expect(h.workers[0].processor(job({ to: 'a@x.com', subject: 'Hi', template: 'nope', data: {}, priority: 2 })))
      .rejects.toThrow(/Failed to send 1\/1/);
  });

  it('throws when sending fails and logs a failed notification', async () => {
    await loadFresh();
    h.sendEmail.mockRejectedValueOnce(new Error('smtp down'));
    await expect(h.workers[0].processor(job({ to: 'a@x.com', subject: 'Hi', template: 'welcome', data: {}, priority: 2 })))
      .rejects.toThrow(/Failed to send/);
    expect(h.insertValues).toHaveBeenCalled();
  });

  it('swallows errors while logging a notification', async () => {
    await loadFresh();
    h.insertValues.mockRejectedValue(new Error('log fail'));
    const r = await h.workers[0].processor(job({ to: 'a@x.com', subject: 'Hi', template: 'welcome', data: {}, priority: 2 })) as { success: boolean };
    expect(r.success).toBe(true);
  });

  it('renders raw-html with text and processes attachments', async () => {
    await loadFresh();
    const data = {
      html: '<b>hi</b>',
      text: 'hi',
      attachments: [
        { filename: 'a.txt', content: 'aGVsbG8=', encoding: 'base64' },
        { filename: 'b.txt', content: Buffer.from('x') },
        { content: 'no-filename' },
      ],
    };
    const r = await h.workers[0].processor(job({ to: 'a@x.com', subject: 'Hi', template: 'raw-html', data, priority: 2 })) as { success: boolean };
    expect(r.success).toBe(true);
    expect(h.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      attachments: expect.arrayContaining([expect.objectContaining({ filename: 'a.txt' })]),
    }));
  });

  it('exercises every template renderer', async () => {
    await loadFresh();
    const templates = [
      'welcome', 'password-reset', 'digest', 'report-ready', 'deadline-alert',
      'notification', 'claims-report', 'members-report', 'grievances-report', 'usage-report',
    ];
    for (const template of templates) {
      await h.workers[0].processor(job({
        to: 'a@x.com', subject: 'S', template,
        data: { reportUrl: 'u', expiresAt: 'e' }, priority: 2,
      }));
    }
    expect(h.render).toHaveBeenCalledTimes(templates.length);
  });

  describe('digest jobs', () => {
    it('returns zero when no users want digests', async () => {
      await loadFresh();
      h.findMany.mockResolvedValue([]);
      const r = await h.workers[0].processor(job({ data: { frequency: 'daily' } }, 'email-digest')) as { sent: number; total: number };
      expect(r.sent).toBe(0);
      expect(r.total).toBe(0);
    });

    it('sends a digest to each opted-in user', async () => {
      await loadFresh();
      h.findMany.mockResolvedValue([{ userId: 'u1', email: 'u1@x.com' }]);
      h.selectQueue.push([{ id: 'n1', title: 't', message: 'm', type: 'info', actionUrl: null, createdAt: new Date() }]);
      const r = await h.workers[0].processor(job({ data: { frequency: 'weekly' } }, 'email-digest')) as { sent: number; total: number };
      expect(r.sent).toBe(1);
      expect(r.total).toBe(1);
    });

    it('continues past a user whose digest send fails', async () => {
      await loadFresh();
      h.findMany.mockResolvedValue([{ userId: 'u1', email: 'u1@x.com' }]);
      h.sendEmail.mockRejectedValue(new Error('smtp'));
      const r = await h.workers[0].processor(job({ data: { frequency: 'daily' } }, 'email-digest')) as { sent: number; total: number };
      expect(r.sent).toBe(0);
      expect(r.total).toBe(1);
    });
  });

  it('registers event handlers and a SIGTERM shutdown', async () => {
    await loadFresh();
    const w = h.workers[0];
    expect(() => w.handlers.completed?.[0]({ id: 'x' })).not.toThrow();
    expect(() => w.handlers.failed?.[0]({ id: 'x' }, new Error('e'))).not.toThrow();
    expect(() => w.handlers.error?.[0](new Error('e'))).not.toThrow();
    process.emit('SIGTERM');
    await Promise.resolve();
    await Promise.resolve();
    expect(w.close).toHaveBeenCalled();
  });
});
