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
  return { queue, db, execute, values, returning };
});

vi.mock('@/db', () => ({ db: h.db }));
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

import { getRecentRealtimeAlerts, runRealtimeObservabilitySweep } from '../realtime-alerting-service';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

beforeEach(() => {
  h.queue.length = 0;
  h.execute.mockReset();
  h.values.mockClear();
  h.returning.mockClear();
});

describe('observability/realtime-alerting-service', () => {
  describe('runRealtimeObservabilitySweep', () => {
    it('emits signals for each threshold breach and creates rules', async () => {
      // 3 execute calls: sla, ingestion, payment
      h.execute
        .mockResolvedValueOnce([{ organization_id: 'org-1', count: 6 }]) // sla critical (>=5)
        .mockResolvedValueOnce([{ organization_id: 'org-2', count: 1 }]) // ingestion high (<3)
        .mockResolvedValueOnce([{ organization_id: 'org-3', count: 2 }]); // payment critical (>=2)

      // For each of the 3 signals, emitSignal:
      // getOrCreateRealtimeRule: select existing → push [] (none) then insert returning [created]
      // signal 1: no existing rule
      pushSel([]); // select existing -> none
      pushSel([{ id: 'rule-1' }]); // insert rule returning
      pushSel([]); // insert execution without reading the insert-only table
      pushSel([]); // insert notificationTracking
      pushSel([]); // insert inAppNotifications
      // signal 2: existing rule found
      pushSel([{ id: 'rule-2' }]); // select existing -> found (skips insert)
      pushSel([]); // insert execution
      pushSel([]); // notificationTracking
      pushSel([]); // inAppNotifications
      // signal 3: no existing rule
      pushSel([]); // select existing
      pushSel([{ id: 'rule-3' }]); // insert rule returning
      pushSel([]); // insert execution
      pushSel([]); // notificationTracking
      pushSel([]); // inAppNotifications

      const result = await runRealtimeObservabilitySweep();
      expect(result.emitted).toBe(3);
      expect(result.byKind.sla_breach_imminent).toBe(1);
      expect(result.byKind.ingestion_failures).toBe(1);
      expect(result.byKind.payment_reconciliation_failures).toBe(1);
      expect(h.returning).toHaveBeenCalledTimes(2); // newly created rules only
      for (const offset of [1, 4, 8]) {
        const execution = h.values.mock.calls[offset][0];
        expect(execution.id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
        const tracking = h.values.mock.calls[offset + 1][0];
        const notification = h.values.mock.calls[offset + 2][0];
        expect(tracking.templateData.executionId).toBe(execution.id);
        expect(tracking.metadata.executionId).toBe(execution.id);
        expect(notification.data.executionId).toBe(execution.id);
      }
    });

    it('returns zero when there are no breaches', async () => {
      h.execute
        .mockResolvedValueOnce([{ organization_id: 'org-1', count: 0 }]) // filtered out
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await runRealtimeObservabilitySweep();
      expect(result.emitted).toBe(0);
      expect(result.byKind.sla_breach_imminent).toBe(0);
    });

    it('surfaces execution insertion failure before publishing notification metadata', async () => {
      h.execute
        .mockResolvedValueOnce([{ organization_id: 'org-1', count: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      pushSel([{ id: 'rule-1' }], new Error('synthetic insert permission denied'));
      await expect(runRealtimeObservabilitySweep()).rejects.toThrow('synthetic insert permission denied');
      expect(h.values).toHaveBeenCalledTimes(1);
      expect(h.returning).not.toHaveBeenCalled();
    });
  });

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
