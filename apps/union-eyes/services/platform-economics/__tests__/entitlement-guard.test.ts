import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const execute = vi.fn();
  const db = { select: () => makeChain(), execute };
  const auditLog = vi.fn();
  const jsonMock = vi.fn((body: unknown, init?: { status?: number }) => ({ body, status: init?.status }));
  return { queue, db, execute, auditLog, jsonMock };
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
  sql: vi.fn(() => ({})),
}));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: h.auditLog,
  AuditEventType: { SYSTEM_SECURITY_ALERT: 'system_security_alert' },
  AuditSeverity: { HIGH: 'high' },
}));
vi.mock('next/server', () => ({ NextResponse: { json: h.jsonMock } }));

import {
  checkCoveredOrg,
  checkModuleEntitlement,
  EntitlementError,
  getModuleDisplay,
  listOrgEntitlements,
  requireEntitlement,
  withEntitlement,
} from '../entitlement-guard';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

beforeEach(() => {
  h.queue.length = 0;
  h.execute.mockReset();
  h.auditLog.mockReset();
  h.jsonMock.mockClear();
});

describe('platform-economics/entitlement-guard', () => {
  describe('getModuleDisplay', () => {
    it('returns a known module display', () => {
      const d = getModuleDisplay('governance_suite');
      expect(d.displayName).toBe('Governance of Record');
    });

    it('humanises an unknown feature key', () => {
      const d = getModuleDisplay('some_new_module');
      expect(d.displayName).toBe('Some New Module');
      expect(d.narrativeTagline).toContain('Some New Module');
    });
  });

  describe('checkModuleEntitlement', () => {
    it('denies when there is no active entitlement', async () => {
      pushSel([]);
      const r = await checkModuleEntitlement('o1', 'governance_suite');
      expect(r.allowed).toBe(false);
      expect(r.reason).toContain('No active entitlement');
    });

    it('denies when the entitlement has expired', async () => {
      pushSel([{ id: 'e1', expiresAt: past }]);
      const r = await checkModuleEntitlement('o1', 'governance_suite');
      expect(r.allowed).toBe(false);
      expect(r.reason).toContain('expired');
    });

    it('denies when the usage limit is reached', async () => {
      pushSel([{ id: 'e1', expiresAt: null, usageLimit: 5, currentUsage: 5 }]);
      const r = await checkModuleEntitlement('o1', 'governance_suite');
      expect(r.allowed).toBe(false);
      expect(r.reason).toContain('Usage limit reached');
    });

    it('denies when the backing contract is invalid', async () => {
      pushSel([{ id: 'e1', expiresAt: null, usageLimit: null, currentUsage: 0, contractLineItemId: 'cli-1' }]);
      h.execute.mockResolvedValueOnce([]); // contract not found
      const r = await checkModuleEntitlement('o1', 'governance_suite');
      expect(r.allowed).toBe(false);
      expect(r.reason).toContain('Backing contract not found');
    });

    it('allows when active with a valid backing contract', async () => {
      pushSel([{ id: 'e1', expiresAt: future, usageLimit: 10, currentUsage: 1, contractLineItemId: 'cli-1' }]);
      h.execute.mockResolvedValueOnce([{ status: 'active', expiration_date: null }]);
      const r = await checkModuleEntitlement('o1', 'governance_suite');
      expect(r.allowed).toBe(true);
      expect(r.entitlementId).toBe('e1');
    });

    it('allows when active with no backing contract', async () => {
      pushSel([{ id: 'e1', expiresAt: null, usageLimit: null, currentUsage: null, contractLineItemId: null }]);
      const r = await checkModuleEntitlement('o1', 'governance_suite');
      expect(r.allowed).toBe(true);
    });

    it('detects a terminated backing contract', async () => {
      pushSel([{ id: 'e1', expiresAt: null, usageLimit: null, currentUsage: 0, contractLineItemId: 'cli-1' }]);
      h.execute.mockResolvedValueOnce([{ status: 'terminated', expiration_date: null }]);
      const r = await checkModuleEntitlement('o1', 'governance_suite');
      expect(r.allowed).toBe(false);
      expect(r.reason).toContain('terminated');
    });

    it('detects an expired backing contract', async () => {
      pushSel([{ id: 'e1', expiresAt: null, usageLimit: null, currentUsage: 0, contractLineItemId: 'cli-1' }]);
      h.execute.mockResolvedValueOnce([{ status: 'active', expiration_date: past.toISOString() }]);
      const r = await checkModuleEntitlement('o1', 'governance_suite');
      expect(r.allowed).toBe(false);
      expect(r.reason).toContain('expired');
    });
  });

  describe('checkCoveredOrg', () => {
    it('returns true when covered and active', async () => {
      pushSel([{ deactivatedAt: null }]);
      expect(await checkCoveredOrg('o1', 'ctr-1')).toBe(true);
    });

    it('returns false when not covered', async () => {
      pushSel([]);
      expect(await checkCoveredOrg('o1', 'ctr-1')).toBe(false);
    });

    it('returns false when deactivated', async () => {
      pushSel([{ deactivatedAt: past }]);
      expect(await checkCoveredOrg('o1', 'ctr-1')).toBe(false);
    });
  });

  describe('listOrgEntitlements', () => {
    it('maps active and expired entitlements', async () => {
      pushSel([
        { id: 'e1', featureKey: 'f1', expiresAt: future, currentUsage: 1, usageLimit: 10 },
        { id: 'e2', featureKey: 'f2', expiresAt: past, currentUsage: null, usageLimit: null },
      ]);
      const list = await listOrgEntitlements('o1');
      expect(list).toHaveLength(2);
      expect(list[0]!.reason).toBe('Active');
      expect(list[1]!.reason).toBe('Expired');
    });
  });

  describe('requireEntitlement', () => {
    it('returns the result when allowed', async () => {
      pushSel([{ id: 'e1', expiresAt: null, usageLimit: null, currentUsage: null, contractLineItemId: null }]);
      const r = await requireEntitlement('o1', 'governance_suite', 'user-1');
      expect(r.allowed).toBe(true);
    });

    it('throws EntitlementError and audits when denied', async () => {
      pushSel([]); // no entitlement
      await expect(requireEntitlement('o1', 'governance_suite', 'user-1')).rejects.toBeInstanceOf(
        EntitlementError,
      );
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('withEntitlement', () => {
    it('returns 400 when there is no organization context', async () => {
      const handler = vi.fn();
      const wrapped = withEntitlement('governance_suite', handler);
      const req = new Request('https://x.test', { headers: {} });
      await wrapped(req, {});
      expect(h.jsonMock).toHaveBeenCalledWith(expect.anything(), { status: 400 });
      expect(handler).not.toHaveBeenCalled();
    });

    it('returns 403 when access is denied', async () => {
      pushSel([]); // no entitlement
      const handler = vi.fn();
      const wrapped = withEntitlement('governance_suite', handler);
      const req = new Request('https://x.test', { headers: { 'x-organization-id': 'o1', 'x-user-id': 'u1' } });
      await wrapped(req, {});
      expect(h.jsonMock).toHaveBeenCalledWith(expect.anything(), { status: 403 });
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('delegates to the handler when allowed', async () => {
      pushSel([{ id: 'e1', expiresAt: null, usageLimit: null, currentUsage: null, contractLineItemId: null }]);
      const handler = vi.fn(async () => new Response('ok'));
      const wrapped = withEntitlement('governance_suite', handler);
      await wrapped(new Request('https://x.test'), { organizationId: 'o1' });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('EntitlementError', () => {
    it('carries the code and feature key', () => {
      const err = new EntitlementError('f1', 'denied');
      expect(err.code).toBe('ENTITLEMENT_REQUIRED');
      expect(err.featureKey).toBe('f1');
      expect(err.name).toBe('EntitlementError');
    });
  });
});
