import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => {
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
  const makeUpdateChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['update', 'set', 'where']) chain[m] = () => chain;
    chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ rowCount: 1 }).then(res);
    return chain;
  };
  return {
    selectQueue,
    makeSelectChain,
    makeUpdateChain,
    emailSend: vi.fn(async () => 'ext-email'),
    smsSend: vi.fn(async () => 'ext-sms'),
  };
});

vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: vi.fn(() => h.makeSelectChain()),
    update: vi.fn(() => h.makeUpdateChain()),
  },
}));
vi.mock('@/db/schema/phase-4-messaging-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, name) => {
    if (name === '__esModule') return false;
    return new Proxy({}, { get: (_o, col) => ({ __col: col }) });
  },
}));
vi.mock('@/lib/services/messaging/email-service', () => ({ getEmailService: () => ({ send: h.emailSend }) }));
vi.mock('@/lib/services/messaging/sms-service', () => ({ getSMSService: () => ({ send: h.smsSend }) }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { processMessageQueue, processCampaignMessages, getQueueStatus } from '../message-queue-processor';

const emailMsg = (over: Record<string, unknown> = {}) => ({
  id: 'm1', campaignId: 'c1', recipientId: null, recipientEmail: 'a@x.com',
  recipientPhone: null, channel: 'email', subject: 's', body: 'b',
  variables: null, retryCount: 0, scheduledAt: new Date(), ...over,
});

describe('message-queue-processor', () => {
  beforeEach(() => {
    h.selectQueue.length = 0;
    h.emailSend.mockReset().mockResolvedValue('ext-email');
    h.smsSend.mockReset().mockResolvedValue('ext-sms');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processMessageQueue', () => {
    it('returns empty stats when the queue is empty', async () => {
      h.selectQueue.push([]);
      const stats = await processMessageQueue();
      expect(stats.processed).toBe(0);
      expect(stats.sent).toBe(0);
    });

    it('sends a queued email message', async () => {
      h.selectQueue.push([emailMsg()]);
      const stats = await processMessageQueue();
      expect(stats.sent).toBe(1);
      expect(h.emailSend).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@x.com' }));
    });

    it('sends a queued sms message with variable substitution', async () => {
      h.selectQueue.push([emailMsg({
        channel: 'sms', recipientPhone: '+15551234567',
        body: 'Hi {{name}} and {name}', variables: { name: 'Bob' },
      })]);
      const stats = await processMessageQueue();
      expect(stats.sent).toBe(1);
      expect(h.smsSend).toHaveBeenCalledWith(expect.objectContaining({ body: 'Hi Bob and Bob' }));
    });

    it('schedules a retry when sending fails under the retry limit', async () => {
      h.selectQueue.push([emailMsg({ channel: 'push', retryCount: 0 })]);
      const stats = await processMessageQueue();
      expect(stats.failed).toBe(0);
      expect(stats.errors.length).toBe(1);
    });

    it('marks a message failed once max retries are exhausted', async () => {
      h.selectQueue.push([emailMsg({ channel: 'push', retryCount: 3 })]);
      const stats = await processMessageQueue();
      expect(stats.failed).toBe(1);
    });

    it('skips a message when the recipient opted out', async () => {
      h.selectQueue.push([emailMsg({ recipientId: 'u1' })], [{ emailOptIn: 'false' }]);
      const stats = await processMessageQueue();
      expect(stats.skipped).toBe(1);
    });

    it('reschedules and skips a message during quiet hours', async () => {
      h.selectQueue.push(
        [emailMsg({ recipientId: 'u1' })],
        [{ emailOptIn: 'true', quietHoursStart: '00:00', quietHoursEnd: '23:59' }],
      );
      const stats = await processMessageQueue();
      expect(stats.skipped).toBe(1);
    });

    it('does not skip when the preference lookup throws', async () => {
      h.selectQueue.push([emailMsg({ recipientId: 'u1' })], new Error('prefs down'));
      const stats = await processMessageQueue();
      expect(stats.sent).toBe(1);
    });

    it('captures a fatal error when the fetch fails', async () => {
      h.selectQueue.push(new Error('db down'));
      const stats = await processMessageQueue();
      expect(stats.errors.some((e) => e.startsWith('Fatal error'))).toBe(true);
    });
  });

  describe('processCampaignMessages', () => {
    it('processes queued messages for a campaign and marks it sent', async () => {
      h.selectQueue.push([emailMsg()], [{ count: 0 }]);
      const stats = await processCampaignMessages('c1');
      expect(stats.sent).toBe(1);
    });

    it('returns early when the campaign has no queued messages', async () => {
      h.selectQueue.push([]);
      const stats = await processCampaignMessages('c1');
      expect(stats.processed).toBe(0);
    });

    it('captures an error when campaign processing fails', async () => {
      h.selectQueue.push(new Error('db down'));
      const stats = await processCampaignMessages('c1');
      expect(stats.errors.some((e) => e.startsWith('Campaign error'))).toBe(true);
    });
  });

  describe('getQueueStatus', () => {
    it('reports queued, ready and failed counts', async () => {
      h.selectQueue.push([{ count: 5 }], [{ count: 3 }], [{ count: 2 }]);
      const status = await getQueueStatus();
      expect(status).toMatchObject({ queued: 5, ready: 3, failed: 2 });
      expect(status.timestamp).toBeInstanceOf(Date);
    });
  });
});
