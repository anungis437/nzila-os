import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  configs: {} as Record<string, any>,
  withRLSContext: vi.fn(),
  requireLiveFinancialMandate: vi.fn(),
  rowsVisibleToGrant: vi.fn(),
  normalizeCsv: vi.fn(),
  sha256: vi.fn(),
  persistAtomicAudit: vi.fn(),
  queryResults: [] as unknown[][],
  select: vi.fn(),
  insert: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  tx: null as any,
}));
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  const error = (status: number, message: string) => Object.assign(new Error(message), { status });
  return {
    z,
    withApi: (cfg: any, handler: (...args: any[]) => unknown) => {
      h.configs[cfg.openapi.summary] = cfg;
      return handler;
    },
    ApiError: {
      badRequest: (message: string) => error(400, message),
      notFound: (message: string) => error(404, message),
      conflict: (message: string) => error(409, message),
      internal: (message: string) => error(500, message),
    },
  };
});
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: h.withRLSContext }));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({ requireLiveFinancialMandate: h.requireLiveFinancialMandate }));
vi.mock('@/lib/finance/principal-financial-authority', () => ({ rowsVisibleToGrant: h.rowsVisibleToGrant }));
vi.mock('@/lib/finance/financial-authority', () => ({ FINANCIAL_MEMBER_DATA_ROLES: ['secretary_treasurer'] }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.persistAtomicAudit }));
vi.mock('../employer-execution/_lib', () => ({ normalizeCsv: h.normalizeCsv, sha256: h.sha256 }));
vi.mock('@/db/schema', () => {
  const table = () => new Proxy({}, { get: (_target, key) => String(key) });
  return {
    employerTimesheetBatches: table(),
    employerTimesheetEntries: table(),
    employers: table(),
    worksites: table(),
    bargainingUnits: table(),
  };
});
vi.mock('drizzle-orm', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  ne: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((...args: unknown[]) => args),
}));

const ORG = '11111111-1111-4111-8111-111111111111';
const EMPLOYER = '22222222-2222-4222-8222-222222222222';
const USER = 'treasurer-1';
const BODY = {
  employerId: EMPLOYER,
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  sourceFileName: 'hours.csv',
  csvContent: 'employee,date,hours\na,2026-10-01,8',
};

function setupTransaction() {
  const chain: any = {
    from: vi.fn(() => chain),
    where: h.where.mockImplementation(() => chain),
    orderBy: vi.fn(() => chain),
    limit: h.limit.mockImplementation(async () => h.queryResults.shift() ?? []),
  };
  h.tx = {
    select: h.select.mockImplementation(() => chain),
    insert: h.insert.mockImplementation(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: 'batch-1', batchCode: 'ts-1', status: 'validated' }]),
      })),
    })),
  };
  h.withRLSContext.mockImplementation(async (_context: unknown, operation: (tx: any) => Promise<unknown>) => operation(h.tx));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.queryResults = [];
  h.normalizeCsv.mockReturnValue({ summary: { invalid: 0 }, entries: [] });
  h.sha256.mockReturnValue('file-sha256');
  h.requireLiveFinancialMandate.mockResolvedValue({ ledgerWide: false, resourceIds: [EMPLOYER] });
  h.rowsVisibleToGrant.mockReturnValue('mandate-scoped-employer-filter');
  h.persistAtomicAudit.mockResolvedValue(undefined);
  setupTransaction();
});

describe('employer timesheets: financial mandate and tenant boundaries', () => {
  it('requires the explicit financial-member roles for both operations', async () => {
    await import('../employer-execution/timesheets/route');
    expect(h.configs['List timesheet batches'].auth).toEqual({ roles: ['secretary_treasurer'] });
    expect(h.configs['Upload and normalize timesheet CSV'].auth).toEqual({ roles: ['secretary_treasurer'] });
  });

  it('rejects missing authenticated organization or user before opening a transaction', async () => {
    const { GET, POST } = await import('../employer-execution/timesheets/route');
    await expect(GET({ organizationId: ORG } as any)).rejects.toMatchObject({ status: 400 });
    await expect(POST({ organizationId: ORG, body: BODY } as any)).rejects.toMatchObject({ status: 400 });
    expect(h.withRLSContext).not.toHaveBeenCalled();
  });

  it('refuses GET without a live view mandate before reading any batch', async () => {
    const { GET } = await import('../employer-execution/timesheets/route');
    h.requireLiveFinancialMandate.mockRejectedValueOnce(Object.assign(new Error('no financial mandate'), { status: 403 }));
    await expect(GET({ organizationId: ORG, userId: USER } as any)).rejects.toMatchObject({ status: 403 });
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: ORG, userId: USER }, expect.any(Function));
    expect(h.requireLiveFinancialMandate).toHaveBeenCalledWith(h.tx, { organizationId: ORG, userId: USER, action: 'finance:view' });
    expect(h.select).not.toHaveBeenCalled();
  });

  it('lists only employer-scoped records covered by the financial grant and caps results', async () => {
    const { GET } = await import('../employer-execution/timesheets/route');
    h.queryResults.push([{ id: 'batch-1', employerId: EMPLOYER }]);
    const result = await GET({ organizationId: ORG, userId: USER } as any);
    expect(result).toEqual({ data: [{ id: 'batch-1', employerId: EMPLOYER }] });
    expect(h.rowsVisibleToGrant).toHaveBeenCalledWith(
      { ledgerWide: false, resourceIds: [EMPLOYER] }, ORG, 'organizationId', 'employerId',
    );
    expect(h.where).toHaveBeenCalledWith('mandate-scoped-employer-filter');
    expect(h.limit).toHaveBeenCalledWith(200);
  });

  it('refuses POST without an employer-specific prepare mandate, before any registry read or write', async () => {
    const { POST } = await import('../employer-execution/timesheets/route');
    h.requireLiveFinancialMandate.mockRejectedValueOnce(Object.assign(new Error('prepare duty not held'), { status: 403 }));
    await expect(POST({ organizationId: ORG, userId: USER, body: BODY } as any)).rejects.toMatchObject({ status: 403 });
    expect(h.requireLiveFinancialMandate).toHaveBeenCalledWith(h.tx, {
      organizationId: ORG, userId: USER, action: 'finance:prepare', employerId: EMPLOYER,
    });
    expect(h.select).not.toHaveBeenCalled();
    expect(h.insert).not.toHaveBeenCalled();
    expect(h.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('persists a validated batch and its audit in the same tenant transaction when mandated', async () => {
    const { POST } = await import('../employer-execution/timesheets/route');
    h.queryResults.push([{ id: EMPLOYER, status: 'active' }], []);
    const result = await POST({ organizationId: ORG, userId: USER, body: BODY } as any);
    expect(result.data.batch.id).toBe('batch-1');
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: ORG, userId: USER }, expect.any(Function));
    expect(h.insert).toHaveBeenCalledTimes(1);
    expect(h.persistAtomicAudit).toHaveBeenCalledWith(h.tx, expect.objectContaining({
      organizationId: ORG, userId: USER, action: 'employer_execution.timesheet_batch.ingest',
    }));
  });

  it('propagates audit persistence failure rather than returning false success', async () => {
    const { POST } = await import('../employer-execution/timesheets/route');
    h.queryResults.push([{ id: EMPLOYER, status: 'active' }], []);
    h.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(POST({ organizationId: ORG, userId: USER, body: BODY } as any)).rejects.toThrow('audit unavailable');
  });
});
