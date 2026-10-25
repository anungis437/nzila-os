import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('executes the named payment for the named member on the caller transaction and returns the new balance', async () => {
    m.record.mockResolvedValue({ balanceAfter: 40, arrears: { id: 'ar_1', totalOwed: '40.00' } });
    const result = await call({ paymentId: PAYMENT, amount: 60, notes: 'cheque 114' });
    expect(result).toEqual({ success: true, newBalance: 40, arrears: { id: 'ar_1', totalOwed: '40.00' } });
    expect(m.record).toHaveBeenCalledWith(m.tx, {
      userId: 'u1',
      organizationId: 'org_1',
      memberId: 'member_1',
      paymentId: PAYMENT,
      amount: 60,
      notes: 'cheque 114',
    });
  });

  it.each([
    ['FINANCE_SOURCE_UNAVAILABLE', 501],
    ['FINANCIAL_MANDATES_NOT_ISSUED', 403],
    ['NOT_FOUND', 404],
    ['DUTY_NOT_HELD', 403],
    ['STEP_REFUSED', 409],
    ['FACT_MISMATCH', 409],
    ['INVALID_REQUEST', 422],
  ] as const)('answers a refused %s as HTTP %i, never a 2xx', async (code, status) => {
    m.record.mockRejectedValue(new FinancialDutyError(code, 'refused', ['SEGREGATION_OF_DUTIES'], code === 'FINANCE_SOURCE_UNAVAILABLE' ? ['amount'] : []));
    const response = (await call({ paymentId: PAYMENT, amount: 60 })) as Response;
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, error: { code } });
    if (code === 'FINANCE_SOURCE_UNAVAILABLE') expect(body).toMatchObject({ capabilityState: 'UNAVAILABLE', missingColumns: ['amount'] });
  });

  it('lets any other failure propagate (an arrears 404 from the framework, a database error)', async () => {
    m.record.mockRejectedValue(Object.assign(new Error('Arrears record not found'), { status: 404 }));
    await expect(call({ paymentId: PAYMENT, amount: 60 })).rejects.toMatchObject({ status: 404 });
  });
});
