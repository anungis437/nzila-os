import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';

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

const REFUSAL = { status: 501, code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' };

describe('dues/payment-plans POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.tx.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'plan_1' }]) })) });
    m.audit.mockResolvedValue(undefined);
  });

  it('POST is refused with 501: no plan is inserted and no audit record is written', async () => {
    const { POST } = await import('../dues/payment-plans/route');
    await expect((POST as any)({ body, organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject(REFUSAL);
    expect(m.tx.insert).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('POST refusal does not depend on the audit write: the 501 is raised before audit is reached', async () => {
    m.audit.mockRejectedValue(new Error('audit down'));
    const { POST } = await import('../dues/payment-plans/route');
    await expect((POST as any)({ body, organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject(REFUSAL);
    expect(m.audit).not.toHaveBeenCalled();
  });
});
