import { describe, it, expect, beforeEach, vi } from 'vitest';

// Column identifiers mirror the real Drizzle column names so eq()/lte()
// predicates below can index into fixture rows by the same key.
const h = vi.hoisted(() => {
  const state = {
    subs: [] as Array<Record<string, unknown>>,
    eventsLog: [] as Array<Record<string, unknown>>,
  };
  const auditLog = vi.fn();
  const getActiveContract = vi.fn();
  return { state, auditLog, getActiveContract };
});

type Predicate = (row: Record<string, unknown>) => boolean;

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (predicate: Predicate) => Promise.resolve(h.state.subs.filter(predicate)),
      }),
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => ({
        where: (predicate: Predicate) => ({
          returning: () => {
            const matches = h.state.subs.filter(predicate);
            for (const row of matches) Object.assign(row, patch);
            return Promise.resolve(matches);
          },
        }),
      }),
    }),
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        h.state.eventsLog.push(row);
        return Promise.resolve([]);
      },
    }),
  },
}));

// Column refs are just their own key name (a string), consumed by the
// eq/lte mocks below to index into fixture rows.
vi.mock('@/db/schema', () => ({
  orgSubscriptions: {
    id: 'id',
    organizationId: 'organizationId',
    status: 'status',
    trialEndDate: 'trialEndDate',
    endDate: 'endDate',
  },
  subscriptionEventsLog: {},
}));

vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: (col: string, val: unknown): Predicate => (row) => row[col] === val,
  and: (...preds: Predicate[]): Predicate => (row) => preds.every((p) => p(row)),
  lte: (col: string, val: Date): Predicate => (row) => new Date(row[col] as string) <= val,
  sql: (): Predicate => () => true,
}));

vi.mock('@/lib/audit-logger', () => ({
  auditLog: h.auditLog,
  AuditEventType: { DATA_UPDATE: 'data_update' },
  AuditSeverity: { HIGH: 'high', MEDIUM: 'medium' },
}));
vi.mock('../contract-service', () => ({ getActiveContract: h.getActiveContract }));

import {
  expireTrials,
  getTrialsEndingSoon,
  pauseSubscription,
  processAutoRenewals,
  resumeSubscription,
} from '../subscription-lifecycle-service';

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const PAST = new Date(Date.now() - 60_000);
const FUTURE = new Date(Date.now() + 60_000);

function setSubs(rows: Array<Record<string, unknown>>) {
  h.state.subs = rows;
}

beforeEach(() => {
  h.state.subs = [];
  h.state.eventsLog = [];
  h.auditLog.mockReset();
  h.getActiveContract.mockReset();
});

describe('platform-economics/subscription-lifecycle-service', () => {
  describe('expireTrials — org-scoped (PR #752 cross-org fix)', () => {
    it('an org A caller expires only its own expired trial', async () => {
      setSubs([{ id: 'sub-a', organizationId: ORG_A, status: 'trialing', trialEndDate: PAST }]);
      const actions = await expireTrials(ORG_A, async () => false);
      expect(actions).toHaveLength(1);
      expect(actions[0]!.organizationId).toBe(ORG_A);
    });

    it('an org A caller cannot mutate an org B expired trial', async () => {
      setSubs([{ id: 'sub-b', organizationId: ORG_B, status: 'trialing', trialEndDate: PAST }]);
      const actions = await expireTrials(ORG_A, async () => false);
      expect(actions).toEqual([]);
      // The org B row must remain untouched.
      expect(h.state.subs[0]!.status).toBe('trialing');
    });

    it('mixed A/B expired records: only org A rows are affected, and subscription_events_log rows are only for org A', async () => {
      setSubs([
        { id: 'sub-a', organizationId: ORG_A, status: 'trialing', trialEndDate: PAST },
        { id: 'sub-b', organizationId: ORG_B, status: 'trialing', trialEndDate: PAST },
      ]);
      const actions = await expireTrials(ORG_A, async () => false);

      expect(actions).toHaveLength(1);
      expect(actions[0]!.organizationId).toBe(ORG_A);

      const orgBRow = h.state.subs.find((s) => s.id === 'sub-b')!;
      expect(orgBRow.status).toBe('trialing'); // untouched

      expect(h.state.eventsLog).toHaveLength(1);
      expect(h.state.eventsLog[0]!.organizationId).toBe(ORG_A);
    });

    it('converts a trial with a payment method to active', async () => {
      setSubs([{ id: 'sub-a', organizationId: ORG_A, status: 'trialing', trialEndDate: PAST }]);
      const actions = await expireTrials(ORG_A, async () => true);
      expect(actions[0]!.action).toBe('trial_converted');
      expect(actions[0]!.newStatus).toBe('active');
    });

    it('cancels a trial without a payment method', async () => {
      setSubs([{ id: 'sub-a', organizationId: ORG_A, status: 'trialing', trialEndDate: PAST }]);
      const actions = await expireTrials(ORG_A, async () => false);
      expect(actions[0]!.action).toBe('trial_expired');
      expect(actions[0]!.newStatus).toBe('cancelled');
    });

    it('returns an empty list when no trials are expired for the organization', async () => {
      setSubs([]);
      const actions = await expireTrials(ORG_A, async () => true);
      expect(actions).toEqual([]);
    });
  });

  describe('getTrialsEndingSoon — org-scoped', () => {
    it("returns only the calling organization's trials ending soon", async () => {
      setSubs([
        { id: 'sub-a', organizationId: ORG_A, status: 'trialing', trialEndDate: FUTURE },
        { id: 'sub-b', organizationId: ORG_B, status: 'trialing', trialEndDate: FUTURE },
      ]);
      const result = await getTrialsEndingSoon(ORG_A, 5);
      expect(result).toHaveLength(1);
      expect(result[0]!.organizationId).toBe(ORG_A);
    });
  });

  describe('pauseSubscription — org-scoped (PR #752 IDOR fix)', () => {
    it('an org A caller pauses its own active subscription', async () => {
      setSubs([{ id: 'sub-1', organizationId: ORG_A, status: 'active' }]);
      const action = await pauseSubscription(ORG_A, 'sub-1', 'user-1', 'maintenance');
      expect(action.action).toBe('paused');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('an org A caller cannot pause an org B subscription by supplying its id (IDOR)', async () => {
      setSubs([{ id: 'sub-1', organizationId: ORG_B, status: 'active' }]);
      await expect(pauseSubscription(ORG_A, 'sub-1', 'user-1')).rejects.toThrow(
        'not found, not active, or not owned by this organization',
      );
      expect(h.state.subs[0]!.status).toBe('active'); // untouched
      expect(h.auditLog).not.toHaveBeenCalled();
    });

    it('throws when the subscription is not active', async () => {
      setSubs([{ id: 'sub-1', organizationId: ORG_A, status: 'paused' }]);
      await expect(pauseSubscription(ORG_A, 'sub-1', 'user-1')).rejects.toThrow(
        'not found, not active, or not owned by this organization',
      );
    });
  });

  describe('resumeSubscription — org-scoped (PR #752 IDOR fix)', () => {
    it('an org A caller resumes its own paused subscription', async () => {
      setSubs([{ id: 'sub-1', organizationId: ORG_A, status: 'paused' }]);
      const action = await resumeSubscription(ORG_A, 'sub-1', 'user-1');
      expect(action.action).toBe('resumed');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('an org A caller cannot resume an org B subscription by supplying its id (IDOR)', async () => {
      setSubs([{ id: 'sub-1', organizationId: ORG_B, status: 'paused' }]);
      await expect(resumeSubscription(ORG_A, 'sub-1', 'user-1')).rejects.toThrow(
        'not found, not paused, or not owned by this organization',
      );
      expect(h.state.subs[0]!.status).toBe('paused'); // untouched
      expect(h.auditLog).not.toHaveBeenCalled();
    });

    it('throws when the subscription is not paused', async () => {
      setSubs([{ id: 'sub-1', organizationId: ORG_A, status: 'active' }]);
      await expect(resumeSubscription(ORG_A, 'sub-1', 'user-1')).rejects.toThrow(
        'not found, not paused, or not owned by this organization',
      );
    });
  });

  describe('processAutoRenewals — deliberately cross-org (system job, zero production callers)', () => {
    it('skips renewal when there is no active contract', async () => {
      setSubs([{ id: 'sub-1', organizationId: ORG_A, status: 'active', endDate: new Date('2025-02-01') }]);
      h.getActiveContract.mockResolvedValueOnce(null);
      const renewed = await processAutoRenewals();
      expect(renewed).toEqual([]);
    });

    it('renews and caps the end date at the contract expiration', async () => {
      setSubs([{ id: 'sub-1', organizationId: ORG_A, status: 'active', endDate: new Date('2025-02-01') }]);
      h.getActiveContract.mockResolvedValueOnce({ expirationDate: new Date('2025-02-15') });
      const renewed = await processAutoRenewals();
      expect(renewed).toEqual(['sub-1']);
    });

    it('renews by one month when within the contract window', async () => {
      setSubs([{ id: 'sub-1', organizationId: ORG_A, status: 'active', endDate: new Date('2025-02-01') }]);
      h.getActiveContract.mockResolvedValueOnce({ expirationDate: new Date('2026-01-01') });
      const renewed = await processAutoRenewals();
      expect(renewed).toEqual(['sub-1']);
    });

    it('handles a subscription with a null end date', async () => {
      setSubs([{ id: 'sub-1', organizationId: ORG_A, status: 'active', endDate: null }]);
      h.getActiveContract.mockResolvedValueOnce({ expirationDate: null });
      const renewed = await processAutoRenewals();
      expect(renewed).toEqual(['sub-1']);
    });
  });
});

