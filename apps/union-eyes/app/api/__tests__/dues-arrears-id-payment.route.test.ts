import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';

const REFUSAL = {
  status: 501,
  code: ErrorCode.NOT_IMPLEMENTED,
  message: 'Finance and dues persistence are not available in this release.',
};

// The route's own contract: body validation, the kernel refusal answers, and the success shape. The kernel decision,
// the ledger and the audit are proven against PostgreSQL in lib/finance/finance-duties.pglite.test.ts.
const m = vi.hoisted(() => ({ record: vi.fn(), tx: { marker: 'tx' } }));

vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  const fail = (status: number) => (message: string) => Object.assign(new Error(message), { status });
  return {
    withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => handler,
    ApiError: { badRequest: fail(400), notFound: fail(404) },
    z,
  };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_context: unknown, fn: (tx: unknown) => unknown) => fn(m.tx),
}));
vi.mock('@/lib/dues/arrears-payment', () => ({ recordArrearsPayment: m.record }));
vi.mock('@/lib/audit-logger', () => ({ auditLog: vi.fn(), AuditEventType: {}, AuditSeverity: {} }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { FinancialDutyError } from '@/lib/authority/store/finance-route-adapter';

const PAYMENT = '00000000-0000-4000-8000-0000000000aa';
const call = async (body: unknown, over: Record<string, unknown> = {}) => {
  const { POST } = await import('../dues/arrears/[id]/payment/route');
  return (POST as unknown as (ctx: unknown) => Promise<unknown>)({
    request: { json: vi.fn().mockResolvedValue(body) },
    params: { id: 'member_1' },
    organizationId: 'org_1',
    userId: 'u1',
    ...over,
  });
};

describe('POST dues/arrears/[id]/payment (kernel execute duty)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a missing organization or user, and a body without a payment transaction', async () => {
    await expect(call({ paymentId: PAYMENT, amount: 5 }, { userId: null })).rejects.toMatchObject({ status: 400 });
    await expect(call({ amount: 5 })).rejects.toMatchObject({ status: 400 });
    await expect(call({ paymentId: 'not-a-uuid', amount: 5 })).rejects.toMatchObject({ status: 400 });
    await expect(call({ paymentId: PAYMENT, amount: 0 })).rejects.toMatchObject({ status: 400 });
    expect(m.record).not.toHaveBeenCalled();
  });

  it.each([
    ['a valid payment', { paymentId: PAYMENT, amount: 60, notes: 'cheque 114' }],
    ['a valid payment without notes', { paymentId: PAYMENT, amount: 60 }],
  ])('refuses %s with 501 before any ledger, kernel decision or arrears update', async (_label, body) => {
    await expect(call(body)).rejects.toMatchObject(REFUSAL);
    expect(m.record).not.toHaveBeenCalled();
  });

  it('refuses before the former duty refusals could be reached, so none of them is answered', async () => {
    m.record.mockRejectedValue(new FinancialDutyError('DUTY_NOT_HELD', 'refused'));
    await expect(call({ paymentId: PAYMENT, amount: 60 })).rejects.toMatchObject(REFUSAL);
    expect(m.record).not.toHaveBeenCalled();
  });
});
