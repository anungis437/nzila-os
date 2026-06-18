import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of [
      'select',
      'from',
      'where',
      'limit',
      'orderBy',
      'insert',
      'update',
      'set',
      'values',
      'returning',
      'delete',
    ]) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
  const auditLog = vi.fn();
  return { queue, db, auditLog };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () =>
  new Proxy(
    {},
    {
      has: () => true,
      get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
    },
  ),
);
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  asc: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
}));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: h.auditLog,
  AuditEventType: { DATA_CREATE: 'data_create', BILLING_UPDATE: 'billing_update' },
  AuditSeverity: { HIGH: 'high', MEDIUM: 'medium' },
}));

import {
  advanceDunningStep,
  getDefaultPolicy,
  openDunningCase,
  processDueDunningCases,
  resolveDunningCase,
} from '../dunning-service';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

beforeEach(() => {
  h.queue.length = 0;
  h.auditLog.mockReset();
});

describe('platform-economics/dunning-service', () => {
  describe('getDefaultPolicy', () => {
    it('returns null when there is no default policy', async () => {
      pushSel([]); // policy lookup
      expect(await getDefaultPolicy()).toBeNull();
    });

    it('returns the policy with its ordered steps', async () => {
      pushSel([{ id: 'pol-1' }]); // policy
      pushSel([{ id: 'step-1', stepOrder: 1 }]); // steps
      const result = await getDefaultPolicy();
      expect(result?.policy.id).toBe('pol-1');
      expect(result?.steps).toHaveLength(1);
    });
  });

  describe('openDunningCase', () => {
    it('throws when no default policy is configured', async () => {
      pushSel([]); // policy lookup empty
      await expect(openDunningCase({ organizationId: 'o1', subscriptionId: 's1' })).rejects.toThrow(
        'No default dunning policy configured',
      );
    });

    it('returns the existing open case id when one is present', async () => {
      pushSel([{ id: 'pol-1' }]); // policy
      pushSel([{ id: 'step-1', stepOrder: 1, delayDays: 1 }]); // steps
      pushSel([{ id: 'existing-case' }]); // existing open case
      const caseId = await openDunningCase({ organizationId: 'o1', subscriptionId: 's1' });
      expect(caseId).toBe('existing-case');
    });

    it('opens a new case and logs the events', async () => {
      pushSel([{ id: 'pol-1' }]); // policy
      pushSel([{ id: 'step-1', stepOrder: 1, delayDays: 2 }]); // steps
      pushSel([]); // no existing case
      pushSel([{ id: 'new-case' }]); // insert returning
      pushSel([]); // subscription event log insert
      const caseId = await openDunningCase({
        organizationId: 'o1',
        subscriptionId: 's1',
        externalPaymentId: 'pay-1',
      });
      expect(caseId).toBe('new-case');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('opens a new case with no steps (null next retry)', async () => {
      pushSel([{ id: 'pol-1' }]); // policy
      pushSel([]); // steps empty
      pushSel([]); // no existing case
      pushSel([{ id: 'new-case' }]); // insert returning
      pushSel([]); // event log
      const caseId = await openDunningCase({ organizationId: 'o1', subscriptionId: 's1' });
      expect(caseId).toBe('new-case');
    });
  });

  describe('advanceDunningStep', () => {
    it('throws when the case is missing', async () => {
      pushSel([]); // case lookup empty
      await expect(advanceDunningStep('c1')).rejects.toThrow('not found');
    });

    it('returns a no-op for resolved cases', async () => {
      pushSel([{ id: 'c1', status: 'resolved', currentStepOrder: 0 }]);
      const result = await advanceDunningStep('c1');
      expect(result.action).toBe('none');
      expect(result.isTerminal).toBe(true);
    });

    it('marks terminal and pauses the subscription when no next step exists', async () => {
      pushSel([{ id: 'c1', status: 'retrying', currentStepOrder: 2, policyId: 'pol-1', subscriptionId: 's1', organizationId: 'o1' }]); // case
      pushSel([]); // next step lookup empty
      pushSel([]); // update dunning case
      pushSel([]); // update subscription
      pushSel([]); // event log
      const result = await advanceDunningStep('c1');
      expect(result.action).toBe('subscription_paused');
      expect(result.isTerminal).toBe(true);
    });

    it('advances a retry_payment step', async () => {
      pushSel([{ id: 'c1', status: 'open', currentStepOrder: 0, policyId: 'pol-1', subscriptionId: 's1', organizationId: 'o1', retryCount: 0, lastRetryAt: null }]); // case
      pushSel([{ stepOrder: 1, delayDays: 1, action: 'retry_payment' }]); // step
      pushSel([]); // update case
      pushSel([]); // event log (payment_retried)
      const result = await advanceDunningStep('c1');
      expect(result.action).toBe('retry_payment');
      expect(result.isTerminal).toBe(false);
    });

    it('advances an escalation step', async () => {
      pushSel([{ id: 'c1', status: 'retrying', currentStepOrder: 1, policyId: 'pol-1', subscriptionId: 's1', organizationId: 'o1', retryCount: 1, lastRetryAt: new Date() }]); // case
      pushSel([{ stepOrder: 2, delayDays: 3, action: 'send_email' }]); // step
      pushSel([]); // update case
      pushSel([]); // event log (dunning_escalated)
      const result = await advanceDunningStep('c1');
      expect(result.action).toBe('send_email');
      expect(result.isTerminal).toBe(false);
    });
  });

  describe('resolveDunningCase', () => {
    it('throws when the case is missing', async () => {
      pushSel([]); // update returning empty
      await expect(resolveDunningCase('c1')).rejects.toThrow('not found');
    });

    it('resolves and reactivates the subscription', async () => {
      pushSel([{ id: 'c1', subscriptionId: 's1', organizationId: 'o1' }]); // update returning
      pushSel([]); // update subscription
      pushSel([]); // event log payment_recovered
      pushSel([]); // event log dunning_resolved
      const result = await resolveDunningCase('c1', 'user-1');
      expect(result.id).toBe('c1');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('processDueDunningCases', () => {
    it('advances each due case', async () => {
      pushSel([{ id: 'c1' }]); // due cases
      // advanceDunningStep('c1'): case lookup + resolved no-op short-circuit
      pushSel([{ id: 'c1', status: 'resolved', currentStepOrder: 0 }]);
      const results = await processDueDunningCases();
      expect(results).toHaveLength(1);
      expect(results[0]!.action).toBe('none');
    });
  });
});
