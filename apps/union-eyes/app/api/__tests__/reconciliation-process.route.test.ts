import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  runReconciliation: vi.fn(),
  getReconciliationRun: vi.fn(),
  withRLSContext: vi.fn(),
  requireLiveFinancialMandate: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }), notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }) }, RATE_LIMITS: { FINANCIAL_WRITE: 'FINANCIAL_WRITE' }, z: require('zod') }));
vi.mock('@/services/platform-economics', () => ({ runReconciliation: m.runReconciliation, getReconciliationRun: m.getReconciliationRun }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({ requireLiveFinancialMandate: m.requireLiveFinancialMandate }));

async function loadRoute() {
  return import('../reconciliation/process/route');
}

describe('reconciliation/process route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.requireLiveFinancialMandate.mockResolvedValue({ mandateId: 'synthetic', ledgerWide: true, resourceIds: [], accountIds: [] });
    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: () => Promise<unknown>) => fn());
    m.runReconciliation.mockResolvedValue({ runId: 'r1', matched: 10 });
    m.getReconciliationRun.mockResolvedValue({ runId: 'r1', matched: 10 });
  });

  it('runs reconciliation', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ body: { periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31') }, organizationId: 'org_1', userId: 'u1' });

    expect(result).toEqual({ runId: 'r1', matched: 10 });
  });

  it('fetches a reconciliation run', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: { url: 'http://localhost/api/reconciliation/process?runId=r1' }, organizationId: 'org_1', userId: 'u1' });

    expect(result).toEqual({ runId: 'r1', matched: 10 });
  });
});