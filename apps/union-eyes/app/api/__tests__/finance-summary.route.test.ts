import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const m = vi.hoisted(() => ({
  execute: vi.fn(),
  withRLSContext: vi.fn(),
  requireLiveFinancialMandate: vi.fn(),
  persistAtomicAudit: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => {
  const makeError = (status: number, message: string) => Object.assign(new Error(message), { status });
  return {
    withApi: vi.fn((_: unknown, handler: (...args: any[]) => unknown) => handler),
    ApiError: {
      badRequest: (message: string) => makeError(400, message),
    },
  };
});

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
}));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({
  requireLiveFinancialMandate: m.requireLiveFinancialMandate,
}));
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: m.persistAtomicAudit,
}));

async function loadRoute() {
  return import('../finance/summary/route');
}

describe('finance/summary route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireLiveFinancialMandate.mockResolvedValue({ mandateId: 'synthetic', ledgerWide: true, resourceIds: [], accountIds: [] });
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (a: unknown, b?: unknown) => {
      const fn = typeof a === 'function' ? a : b;
      return (fn as (tx: { execute: typeof m.execute }) => Promise<unknown>)({ execute: m.execute });
    });
    m.execute
      .mockResolvedValueOnce([{ year: 2026, month: 1, amount: '100', memberCount: 10, expected: '110', variance: '-10', reconciled: true, status: 'ok' }])
      .mockResolvedValueOnce([{ totalPaid: '200', totalCharged: '400', uniqueMembers: 5 }])
      .mockResolvedValueOnce([{ totalMembers: 20, currentMembers: 15, warningMembers: 3, suspendedMembers: 2, onPaymentPlan: 1 }])
      .mockResolvedValueOnce([{ activePlans: 2, totalRemaining: '300', totalRecovered: '50' }])
      .mockResolvedValueOnce([{ year: 2026, month: 1, status: 'open', revenue: '1000', arrears: '200', memberCount: 20 }])
      .mockResolvedValueOnce([{ reconciled: 3, unreconciled: 1, unreconciledAmount: '20' }])
      .mockResolvedValueOnce([{ totalOrgMembers: 20 }])
      .mockResolvedValueOnce([{ totalDisbursements: 1, totalDisbursed: '50', craThresholdBreaches: 0, requiresT4a: 0, t4aGenerated: 0 }])
      .mockResolvedValueOnce([{ year: 2026, month: 1, amount: '40', members: 8, rate: '5', status: 'pending', dueDate: '2026-01-31' }])
      .mockResolvedValueOnce([{ orgId: 'child_1', orgName: 'Child Org', totalDue: '70', totalPaid: '10', totalOverdue: '5', pendingCount: 1, overdueCount: 1 }])
      .mockResolvedValueOnce([{ totalClaims: 7, openClaims: 2, totalLegalCosts: '500' }])
      .mockResolvedValueOnce([{ totalArbitrations: 2, estimatedCost: '100', actualCost: '80', unionShare: '40' }])
      .mockResolvedValueOnce([{ totalSettlements: 1, totalSettled: '25', accepted: 1 }])
      .mockResolvedValueOnce([{ totalMembers: 10, activeMembers: 8, totalYearsService: '60' }])
      .mockResolvedValueOnce([{ totalContributions: 3, received: 2, pending: 1, totalFunded: '90', totalPending: '10' }])
      .mockResolvedValueOnce([{ accountType: 'asset', balance: '1000' }, { accountType: 'liability', balance: '300' }])
      .mockResolvedValueOnce([{ name: 'Ops', totalBudget: '1000', allocated: '700', spent: '500', status: 'active' }]);
  });

  it('throws bad request when organization context is missing', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: '' } as any)).rejects.toMatchObject({ status: 400 });
  });

  it('returns normalized finance summary payload', async () => {
    const { GET } = await loadRoute();
    const payload = await GET({ organizationId: 'org_1', userId: 'u1' } as any);

    expect(payload).toMatchObject({
      collectionRate: 50,
      totalPaid: 200,
      totalCharged: 400,
      memberStanding: { total: 20 },
      strikeFund: { totalDisbursements: 1 },
      grievanceCosts: { totalClaims: 7 },
      pensionHealth: { totalMembers: 10 },
    });
    expect(payload.budgets).toHaveLength(1);
    expect(payload.perCapitaInbound.childCount).toBe(1);
  });

  it('runs mandate verification, all 17 financial reads and the access audit in one explicit tenant transaction', async () => {
    const { GET } = await loadRoute();
    await GET({ organizationId: 'org_1', userId: 'u1' } as any);
    expect(m.withRLSContext).toHaveBeenCalledTimes(1);
    expect(m.withRLSContext.mock.calls[0][0]).toEqual({ organizationId: 'org_1', userId: 'u1' });
    expect(m.requireLiveFinancialMandate).toHaveBeenCalledWith(
      expect.objectContaining({ execute: m.execute }),
      { organizationId: 'org_1', userId: 'u1', action: 'finance:view', requiresLedger: true },
    );
    expect(m.execute).toHaveBeenCalledTimes(17);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      expect.objectContaining({ execute: m.execute }),
      expect.objectContaining({ organizationId: 'org_1', userId: 'u1', action: 'finance.summary.read' }),
    );
    const source = readFileSync(resolve(__dirname, '../finance/summary/route.ts'), 'utf8');
    expect(source).not.toContain('db.execute(');
    expect(source).not.toContain('withRLSContext(async');
  });

  it('refuses every financial query when the live mandate cannot be verified', async () => {
    m.requireLiveFinancialMandate.mockRejectedValueOnce(new Error('MANDATE_NOT_ISSUED'));
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: 'org_1', userId: 'u1' } as any)).rejects.toThrow('MANDATE_NOT_ISSUED');
    expect(m.execute).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('refuses the response if the mandatory financial read audit fails', async () => {
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('AUDIT_UNAVAILABLE'));
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: 'org_1', userId: 'u1' } as any)).rejects.toThrow('AUDIT_UNAVAILABLE');
    expect(m.execute).toHaveBeenCalledTimes(17);
  });

  it('does not manufacture a 100% collection rate when no dues charges exist', async () => {
    m.execute.mockReset().mockResolvedValue([]);
    m.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ totalPaid: '0', totalCharged: '0', uniqueMembers: 0 }]);
    const { GET } = await loadRoute();
    const payload = await GET({ organizationId: 'org_1', userId: 'u1' } as any);
    expect(payload.collectionRate).toBeNull();
    expect(payload.totalCharged).toBe(0);
    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
    const uiSource = readFileSync(resolve(__dirname, '../../../components/financial/FinancialOverview.tsx'), 'utf8');
    expect(uiSource).toContain("value={executive?.collectionRate == null ? 'N/A'");
    expect(uiSource).toContain("No dues charges recorded");
  });

  it('Round 58 Phase 0: strike fund query filters directly on organization_id, not a user_id join (multi-org fan-out fix)', async () => {
    const src = readFileSync(resolve(__dirname, '../finance/summary/route.ts'), 'utf8');
    expect(src).toMatch(/FROM strike_fund_disbursements sfd\s*\n\s*WHERE sfd\.organization_id = \$\{orgIdCast\}/);
    expect(src).not.toMatch(/JOIN organization_members om ON om\.user_id = sfd\.user_id/);
  });
});
