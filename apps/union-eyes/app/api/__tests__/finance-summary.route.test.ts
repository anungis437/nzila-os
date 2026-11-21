import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ErrorCode } from '@/lib/api/errors';

const REFUSAL = 'Finance and dues persistence are not available in this release.';
const refused = { status: 501, code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL };

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

  const nothingRan = () => {
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.requireLiveFinancialMandate).not.toHaveBeenCalled();
    expect(m.execute).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  };

  it('refuses the summary with 501 NOT_IMPLEMENTED before any transaction, mandate check, financial read or audit', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: 'org_1', userId: 'u1' } as any)).rejects.toMatchObject(refused);
    nothingRan();
  });

  it('refuses with 501 even when a live mandate would verify and every read would succeed', async () => {
    m.requireLiveFinancialMandate.mockResolvedValue({ mandateId: 'live', ledgerWide: true, resourceIds: [], accountIds: [] });
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: 'org_1', userId: 'u1' } as any)).rejects.toMatchObject(refused);
    nothingRan();
  });

  it('refuses with 501, not a mandate error, when the live mandate cannot be verified: the mandate is never consulted', async () => {
    m.requireLiveFinancialMandate.mockRejectedValue(new Error('MANDATE_NOT_ISSUED'));
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: 'org_1', userId: 'u1' } as any)).rejects.toMatchObject(refused);
    nothingRan();
  });

  it('refuses with 501 when the audit store is unavailable: no audit is attempted', async () => {
    m.persistAtomicAudit.mockRejectedValue(new Error('AUDIT_UNAVAILABLE'));
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: 'org_1', userId: 'u1' } as any)).rejects.toMatchObject(refused);
    nothingRan();
  });

  it('refuses with 501 for an organization with no dues charges, instead of reporting an empty summary', async () => {
    m.execute.mockReset().mockResolvedValue([]);
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: 'org_1', userId: 'u1' } as any)).rejects.toMatchObject(refused);
    nothingRan();
  });

  it('keeps the summary source on the explicit tenant transaction and the UI from showing a manufactured 100% collection rate', async () => {
    const source = readFileSync(resolve(__dirname, '../finance/summary/route.ts'), 'utf8');
    expect(source).not.toContain('db.execute(');
    expect(source).not.toContain('withRLSContext(async');
    const uiSource = readFileSync(resolve(__dirname, '../../../components/financial/FinancialOverview.tsx'), 'utf8');
    expect(uiSource).toContain("value={executive?.collectionRate == null ? '—'");
    expect(uiSource).toContain("No dues charges recorded");
  });

  it('Round 58 Phase 0: strike fund query filters directly on organization_id, not a user_id join (multi-org fan-out fix)', async () => {
    const src = readFileSync(resolve(__dirname, '../finance/summary/route.ts'), 'utf8');
    expect(src).toMatch(/FROM strike_fund_disbursements sfd\s*\n\s*WHERE sfd\.organization_id = \$\{orgIdCast\}/);
    expect(src).not.toMatch(/JOIN organization_members om ON om\.user_id = sfd\.user_id/);
  });
});
