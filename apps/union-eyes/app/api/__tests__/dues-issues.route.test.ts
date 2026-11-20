import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';

const REFUSAL = {
  status: 501,
  code: ErrorCode.NOT_IMPLEMENTED,
  message: 'Finance and dues persistence are not available in this release.',
};

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  badRequest: vi.fn(),
  notFound: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => ({
  z: (await import('zod')).z,
  withApi: m.withApi,
  ApiError: { badRequest: m.badRequest, notFound: m.notFound },
}));
const audit = vi.hoisted(() => ({ tx: vi.fn() }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...args: unknown[]) => (args[args.length - 1] as (tx: unknown) => Promise<unknown>)({ insert: m.insert, select: m.select }),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit.tx }));
vi.mock('@/db', () => ({ db: { insert: m.insert } }));
vi.mock('@/db/schema/dues-finance-schema', () => ({
  memberDuesIssues: { id: 'id' },
  payrollDeductions: { id: 'deductionId', organizationId: 'deductionOrganizationId', userId: 'deductionUserId' },
}));
vi.mock('next/server', () => ({
  NextResponse: { json: (body: unknown) => body },
}));

async function loadRoute() {
  return import('../dues/issues/route');
}

describe('/api/dues/issues route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => handler);
    audit.tx.mockResolvedValue(undefined);
    m.badRequest.mockImplementation((message: string) => Object.assign(new Error(message), { status: 400 }));
    m.notFound.mockImplementation((resource: string) => Object.assign(new Error(`${resource} not found`), { status: 404 }));
  });

  it('refuses a valid report with 501 and writes, reads and audits nothing', async () => {
    const { POST } = await loadRoute();
    await expect(
      POST({
        organizationId: 'org_1',
        userId: 'user_1',
        body: {
          issueType: 'missing_deduction',
          subject: 'Dues missing from March pay stub',
          description: 'No dues line item appears on my March 15 pay stub.',
        },
      }),
    ).rejects.toMatchObject(REFUSAL);

    expect(m.insert).not.toHaveBeenCalled();
    expect(m.select).not.toHaveBeenCalled();
    expect(audit.tx).not.toHaveBeenCalled();
  });

  it('rejects an invalid issueType before touching the database', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST({
        organizationId: 'org_1',
        userId: 'user_1',
        body: { issueType: 'not_a_real_type', subject: 'x', description: 'y' },
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(m.insert).not.toHaveBeenCalled();
  });

  it('rejects when organization/user context is missing', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST({ organizationId: null, userId: null, body: {} }),
    ).rejects.toMatchObject({ status: 400 });

    expect(m.insert).not.toHaveBeenCalled();
  });

  describe('what a report may carry', () => {
    const valid = { issueType: 'incorrect_amount', subject: 'Wrong amount', description: 'The March deduction is higher than my rate.' };
    const file = async (body: unknown) => {
      const { POST } = await loadRoute();
      return POST({ organizationId: 'org_1', userId: 'user_1', body });
    };

    it('answers a body that is not a JSON object as a 400, not a server fault', async () => {
      for (const body of [null, undefined, 'text', 42, ['issueType']]) {
        await expect(file(body), JSON.stringify(body)).rejects.toMatchObject({ status: 400 });
      }
      expect(m.insert).not.toHaveBeenCalled();
    });

    it('requires the three fields to be text, and not blank', async () => {
      for (const body of [
        { ...valid, subject: 12 }, { ...valid, description: { text: 'x' } }, { ...valid, issueType: ['other'] }, { ...valid, subject: '   ' }, { ...valid, description: '' },
      ]) {
        await expect(file(body), JSON.stringify(body)).rejects.toMatchObject({ status: 400 });
      }
      expect(m.insert).not.toHaveBeenCalled();
    });

    it('bounds the subject and the description', async () => {
      await expect(file({ ...valid, subject: 'x'.repeat(201) })).rejects.toMatchObject({ status: 400, message: 'subject must be at most 200 characters' });
      await expect(file({ ...valid, description: 'x'.repeat(5001) })).rejects.toMatchObject({ status: 400, message: 'description must be at most 5000 characters' });
      expect(m.insert).not.toHaveBeenCalled();
    });

    it('accepts an expected amount only as a finite, non-negative number that fits the column', async () => {
      for (const expectedAmount of ['12.50', -1, Number.POSITIVE_INFINITY, Number.NaN, 100_000_000, {}, [1]]) {
        await expect(file({ ...valid, expectedAmount }), String(expectedAmount)).rejects.toMatchObject({ status: 400, message: 'expectedAmount must be a non-negative amount' });
      }
      expect(m.insert).not.toHaveBeenCalled();
    });

    it('accepts a deduction id only as a uuid', async () => {
      for (const payrollDeductionId of ['123', 'not-a-uuid', 7, {}]) {
        await expect(file({ ...valid, payrollDeductionId }), String(payrollDeductionId)).rejects.toMatchObject({ status: 400, message: 'payrollDeductionId must be a UUID' });
      }
      expect(m.insert).not.toHaveBeenCalled();
    });

    it.each([
      ['one of the caller\'s own deductions', { payrollDeductionId: '0f8fad5b-d9cb-469f-a165-70867728950e', expectedAmount: 45.5 }],
      ['a deduction that is not the caller\'s or does not exist', { payrollDeductionId: '0f8fad5b-d9cb-469f-a165-70867728950e' }],
      ['no deduction', {}],
    ])('refuses a well-formed report about %s with 501 before any deduction is read or issue written', async (_label, extra) => {
      m.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ id: 'deduction-1' }] }) }) });
      await expect(file({ ...valid, ...extra })).rejects.toMatchObject(REFUSAL);
      expect(m.select).not.toHaveBeenCalled();
      expect(m.insert).not.toHaveBeenCalled();
      expect(audit.tx).not.toHaveBeenCalled();
    });
  });
});
