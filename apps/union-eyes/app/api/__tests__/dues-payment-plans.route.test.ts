import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  audit: vi.fn(),
  tx: { insert: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  z: require('zod'),
  RATE_LIMITS: { FINANCIAL_WRITE: {} },
  ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) },
}));
vi.mock('@/lib/finance/financial-authority', () => ({ FINANCIAL_MEMBER_DATA_ROLES: ['admin'] }));
vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (fn: (tx: unknown) => Promise<unknown>) => fn(m.tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/db/schema/dues-finance-schema', () => ({ paymentPlans: { organizationId: 'o', createdAt: 'c' } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), desc: vi.fn() }));

const body = {
  userId: 'm1',
  planName: 'Plan',
  totalOwed: '100.00',
  installmentAmount: '25.00',
  installmentCount: 4,
  frequency: 'monthly',
  startDate: new Date('2026-01-01'),
  nextPaymentDue: new Date('2026-02-01'),
};

describe('dues/payment-plans POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.tx.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'plan_1' }]) })) });
    m.audit.mockResolvedValue(undefined);
  });

  it('creates the plan and its audit record on the same transaction', async () => {
    const { POST } = await import('../dues/payment-plans/route');
    await expect((POST as any)({ body, organizationId: 'org_1', userId: 'u1' })).resolves.toEqual({ id: 'plan_1' });
    expect(m.audit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ organizationId: 'org_1', userId: 'u1', action: 'dues.payment_plan.create', resourceId: 'plan_1' }),
    );
  });

  it('does not succeed when the audit write fails', async () => {
    m.audit.mockRejectedValue(new Error('audit down'));
    const { POST } = await import('../dues/payment-plans/route');
    await expect((POST as any)({ body, organizationId: 'org_1', userId: 'u1' })).rejects.toThrow('audit down');
  });
});
