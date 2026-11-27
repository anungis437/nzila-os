import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';

const REFUSAL = {
  status: 501,
  code: ErrorCode.NOT_IMPLEMENTED,
  message: 'Finance and dues persistence are not available in this release.',
};

// The route's own contract. The kernel decisions and the atomic ledger are proven against PostgreSQL in
// lib/finance/finance-duties.pglite.test.ts.
const m = vi.hoisted(() => ({ perform: vi.fn(), read: vi.fn(), tx: { marker: 'tx' } }));

vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  return {
    withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => handler,
    ApiError: { badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }) },
    RATE_LIMITS: { FINANCIAL_WRITE: {} },
    z,
  };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_context: unknown, fn: (tx: unknown) => unknown) => fn(m.tx),
}));
vi.mock('@/lib/audit-logger', () => ({ auditLog: vi.fn(), AuditEventType: {}, AuditSeverity: {} }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/authority/store/finance-route-adapter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/authority/store/finance-route-adapter')>()),
  performFinancialDuty: m.perform,
  readFinancialTransaction: m.read,
}));


const PAYMENT = '00000000-0000-4000-8000-0000000000aa';
const ACCOUNT = '00000000-0000-4000-8000-0000000000bb';
const ctx = (body?: unknown, over: Record<string, unknown> = {}) => ({
  request: { json: vi.fn().mockResolvedValue(body) },
  params: { id: PAYMENT },
  organizationId: 'org_1',
  userId: 'u1',
  ...over,
});
type Reply = { status: number; json: () => Promise<{ error: { code: string } }> } & Record<string, unknown>;
const route = async () => (await import('../payments/[id]/duties/route')) as unknown as Record<'GET' | 'POST', (c: unknown) => Promise<Reply>>;

describe('payments/[id]/duties', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['registered', { step: 'registered', accountId: ACCOUNT, requiredApprovals: 2 }],
    ['prepared', { step: 'prepared' }],
    ['approved', { step: 'approved' }],
    ['reconciled', { step: 'reconciled' }],
  ] as const)('refuses a well-formed %s step with 501 before any kernel decision, database or audit work', async (_step, body) => {
    const { POST } = await route();
    await expect(POST(ctx(body))).rejects.toMatchObject(REFUSAL);
    expect(m.perform).not.toHaveBeenCalled();
    expect(m.read).not.toHaveBeenCalled();
  });

  it('never executes a payment: executing is the money movement and lives only in the route that moves the money', async () => {
    const { POST } = await route();
    const response = await POST(ctx({ step: 'executed' }));
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('STEP_NOT_AVAILABLE');
    expect(m.perform).not.toHaveBeenCalled();
  });

  it('rejects malformed requests before any decision', async () => {
    const { POST } = await route();
    for (const body of [
      { step: 'registered' },
      { step: 'registered', accountId: ACCOUNT },
      { step: 'prepared', accountId: ACCOUNT, requiredApprovals: 1 },
      { step: 'voided' },
      { step: 'prepared', extra: true },
      { step: 'registered', accountId: 'nope', requiredApprovals: 1 },
    ]) {
      await expect(POST(ctx(body)), JSON.stringify(body)).rejects.toMatchObject({ status: 400 });
    }
    await expect(POST(ctx({ step: 'prepared' }, { userId: null }))).rejects.toMatchObject({ status: 400 });
    expect(m.perform).not.toHaveBeenCalled();
  });

  it('refuses the read with 501 before the kernel view duty is consulted', async () => {
    const { GET } = await route();
    await expect(GET(ctx())).rejects.toMatchObject(REFUSAL);
    expect(m.read).not.toHaveBeenCalled();
    expect(m.perform).not.toHaveBeenCalled();
  });

  it('still rejects a read without organization context as a 400 before the refusal', async () => {
    const { GET } = await route();
    await expect(GET(ctx(undefined, { organizationId: null }))).rejects.toMatchObject({ status: 400 });
    expect(m.read).not.toHaveBeenCalled();
  });
});
