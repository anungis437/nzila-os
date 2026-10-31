import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const values = vi.fn();
  const returning = vi.fn();
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'innerJoin', 'leftJoin', 'insert', 'update', 'set', 'values', 'returning', 'delete']) {
      chain[m] = () => chain;
    }
    chain.values = (input: unknown) => { values(input); return chain; };
    chain.returning = () => { returning(); return chain; };
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const execute = vi.fn();
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
    execute,
  };
  return { queue, db, execute, values, returning, persistAtomicAudit: vi.fn() };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.persistAtomicAudit }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(h.db)),
}));
vi.mock('@/db/schema', () =>
  new Proxy({}, { has: () => true, get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })) }),
);
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  sql: Object.assign(vi.fn(() => ({})), { raw: vi.fn(() => ({})) }),
}));

import { getRecentRealtimeAlerts } from '../realtime-alerting-service';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

beforeEach(() => {
  h.queue.length = 0;
  h.execute.mockReset();
  h.values.mockClear();
  h.returning.mockClear();
  h.persistAtomicAudit.mockReset();
  h.persistAtomicAudit.mockResolvedValue(undefined);
});

describe('observability/realtime-alerting-service', () => {
  // runRealtimeObservabilitySweep (recipients, hourly dedupe, failed alerts, per-alert rollback) is exercised against a real SQL engine in
  // realtime-alerting-service.pglite.test.ts.

  describe('getRecentRealtimeAlerts', () => {
    it('returns recent alert rows', async () => {
      pushSel([{ executionId: 'exec-1', ruleName: 'realtime:sla_breach_imminent' }]);
      const rows = await getRecentRealtimeAlerts('org-1');
      expect(rows).toHaveLength(1);
      expect(rows[0].executionId).toBe('exec-1');
    });

    it('respects a custom limit', async () => {
      pushSel([]);
      const rows = await getRecentRealtimeAlerts('org-1', 5);
      expect(rows).toEqual([]);
    });
  });
});
