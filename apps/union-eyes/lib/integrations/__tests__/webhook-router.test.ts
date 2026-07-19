import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntegrationProvider, WebhookStatus } from '../types';

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
  return { q, db, factory };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db', () => ({ db: h.db }));
vi.mock('../factory', () => ({ IntegrationFactory: { getInstance: () => h.factory } }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { WebhookRouter, processWebhook } from '../webhook-router';

const push = (...rows: unknown[]) => h.q.push(...rows);

const okIntegration = () => ({
  verifyWebhook: vi.fn().mockResolvedValue(true),
  processWebhook: vi.fn().mockResolvedValue(undefined),
});

describe('WebhookRouter', () => {
  let router: WebhookRouter;
  let n = 0;
  const uniquePayload = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({ type: 'event.test', nonce: `${Date.now()}-${n++}`, ...extra });

  beforeEach(() => {
    h.q.length = 0;
    vi.clearAllMocks();
    h.factory.getIntegration.mockResolvedValue(okIntegration());
    router = WebhookRouter.getInstance();
  });

  it('getInstance returns a singleton', () => {
    expect(WebhookRouter.getInstance()).toBe(router);
  });

  it('processWebhook verifies, stores and processes an event', async () => {
    push([]); // isProcessed -> no existing row
    push({}); // storeEvent RECEIVED
    push({}); // updateEventStatus PROCESSING
    push({}); // updateEventStatus PROCESSED
    const res = await router.processWebhook(
      'org1',
      IntegrationProvider.SLACK,
      uniquePayload(),
      'sig',
      {}
    );
    expect(res.success).toBe(true);
    expect(res.eventId).toBeTruthy();
  });

  it('processWebhook is idempotent when the event is already processed in DB', async () => {
    push([{ id: 'x', status: WebhookStatus.PROCESSED }]); // isProcessed -> processed row
    const res = await router.processWebhook(
      'org1',
      IntegrationProvider.SLACK,
      uniquePayload(),
      'sig',
      {}
    );
    expect(res.success).toBe(true);
  });

  it('processWebhook fails and stores a failed event on invalid signature', async () => {
    push([]); // isProcessed
    push({}); // storeEvent FAILED
    h.factory.getIntegration.mockResolvedValue({
      verifyWebhook: vi.fn().mockResolvedValue(false),
      processWebhook: vi.fn(),
    });
    const res = await router.processWebhook(
      'org1',
      IntegrationProvider.SLACK,
      uniquePayload(),
      'sig',
      {}
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/signature/i);
  });

  it('processEvent retries with delay then fails after maxRetries', async () => {
    vi.useFakeTimers();
    push([]); // isProcessed
    push({}); // storeEvent RECEIVED
    push({}); // updateEventStatus PROCESSING attempt 1
    push({}); // updateEventStatus PROCESSING attempt 2
    push({}); // updateEventStatus PROCESSING attempt 3
    push({}); // storeEvent FAILED
    h.factory.getIntegration.mockResolvedValue({
      verifyWebhook: vi.fn().mockResolvedValue(true),
      processWebhook: () => Promise.reject(new Error('process boom')),
    });
    const p = router.processWebhook(
      'org1',
      IntegrationProvider.WORKDAY,
      uniquePayload({ eventType: 'hire' }),
      'sig',
      {}
    );
    await vi.runAllTimersAsync();
    const res = await p;
    expect(res.success).toBe(false);
    vi.useRealTimers();
  });

  it('cleanupOldEvents deletes processed events and returns the count', async () => {
    push({ rowCount: 7 });
    const count = await router.cleanupOldEvents(30);
    expect(count).toBe(7);
  });

  it('convenience processWebhook works', async () => {
    push([]); // isProcessed
    push({}); // storeEvent RECEIVED
    push({}); // updateEventStatus PROCESSING
    push({}); // updateEventStatus PROCESSED
    const res = await processWebhook(
      'org1',
      IntegrationProvider.QUICKBOOKS,
      uniquePayload({ eventNotifications: [{ name: 'invoice.created' }] }),
      'sig'
    );
    expect(res.success).toBe(true);
  });
});
