import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  ApiError: {
    badRequest: vi.fn((msg: string) => { throw new Error(msg); }),
    notFound: vi.fn((msg: string) => { throw new Error(msg); }),
    internal: vi.fn((msg: string) => { throw new Error(msg); }),
  },
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  withRLSContext: vi.fn(),
  requireEntitlement: vi.fn(),
  resolvePayrollRules: vi.fn(),
  calculatePayroll: vi.fn(),
  sha256: vi.fn(),
  selectResults: [] as any[],
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: m.ApiError, z: require('zod') }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: m.requireEntitlement,
  PLATFORM_MODULES: { EMPLOYER_PAYROLL_OFFICIAL: 'EMPLOYER_PAYROLL_OFFICIAL' },
}));
vi.mock('../employer-execution/_lib', () => ({
  resolvePayrollRules: m.resolvePayrollRules,
  calculatePayroll: m.calculatePayroll,
  sha256: m.sha256,
}));

async function loadRoute() {
  return import('../employer-execution/payroll-runs/route');
}

describe('employer-execution/payroll-runs route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectResults = [];

    const makeQuery = (rows: any[]) => {
      const chain: any = {
        where: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        then: (onFulfilled: any, onRejected: any) => Promise.resolve(rows).then(onFulfilled, onRejected),
      };

      return chain;
    };

    m.withApi.mockImplementation((_cfg: unknown, handler: any) => {
      return (ctx: any = {}) => handler(ctx);
    });

    m.db.select.mockImplementation(() => ({
      from: vi.fn(() => makeQuery(m.selectResults.shift() ?? [])),
    }));

    m.withRLSContext.mockImplementation((fn: any) => fn({
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'run_1' }]) })),
      })),
    }));

    m.resolvePayrollRules.mockReturnValue({});
    m.calculatePayroll.mockReturnValue({
      items: [
        {
          employeeExternalId: 'emp_1',
          grossPay: 100,
          netPay: 80,
          duesAmount: 10,
          benefitAmount: 5,
          pensionAmount: 5,
          remittanceGroupKey: 'default',
          trace: { ok: true },
          traceHash: 'trace-item-1',
        },
        {
          employeeExternalId: 'emp_2',
          grossPay: 200,
          netPay: 160,
          duesAmount: 20,
          benefitAmount: 10,
          pensionAmount: 10,
          remittanceGroupKey: 'default',
          trace: { ok: true },
          traceHash: 'trace-item-2',
        },
      ],
      totals: { gross: 0, net: 0, dues: 0, benefits: 0, pension: 0 },
      snapshotHash: 'snap',
      calcTrace: {},
      calcTraceHash: 'trace',
    });
    m.sha256.mockReturnValue('hash');
  });

  it('GET returns bad request without organization context', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: undefined })).rejects.toThrow();
  }, 60000);

  it('GET returns payroll runs for organization', async () => {
    const { GET } = await loadRoute();
    m.selectResults = [[{ id: 'run_1', organizationId: 'org_1' }]];
    const result = await GET({ organizationId: 'org_1' });
    expect(result.data).toEqual([{ id: 'run_1', organizationId: 'org_1' }]);
  });

  it('POST fails when timesheet batch is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST({
      organizationId: 'org_1',
      userId: 'u1',
      body: {
        timesheetBatchId: '00000000-0000-0000-0000-000000000001',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-15',
        runType: 'preview',
        engineVersion: 'employer-execution-v1',
      },
    })).rejects.toThrow();
  });

  it('POST creates an official payroll run and compliance events', async () => {
    const { POST } = await loadRoute();
    m.selectResults = [
      [{ id: 'batch_1', employerId: 'emp_1', sourceFileHash: 'source-hash', worksiteId: 'site_1', bargainingUnitId: 'bu_1' }],
      [],
      [
        {
          rowNumber: 1,
          employeeExternalId: 'emp_1',
          shiftDate: '2026-01-10',
          regularHours: '8',
          overtimeHours: '0',
          doubletimeHours: '0',
          travelHours: '0',
          premiumCode: null,
          jobClassificationId: null,
          memberEmploymentId: null,
        },
        {
          rowNumber: 2,
          employeeExternalId: 'emp_2',
          shiftDate: '2026-01-10',
          regularHours: '6',
          overtimeHours: '2',
          doubletimeHours: '0',
          travelHours: '1',
          premiumCode: 'night',
          jobClassificationId: 'class_1',
          memberEmploymentId: 'employment_1',
        },
      ],
      [
        {
          id: 'rule_version_1',
          ruleVersionCode: 'rv1',
          sourceHash: 'rule-source',
          rulesJson: { version: 1 },
          employerId: 'emp_1',
          worksiteId: 'site_1',
          bargainingUnitId: 'bu_1',
        },
      ],
      [{ id: 'rule_item_1', precedence: 1 }],
    ];

    const result = await POST({
      organizationId: 'org_1',
      userId: 'u1',
      body: {
        timesheetBatchId: 'batch_1',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-15',
        runType: 'official',
        engineVersion: 'employer-execution-v1',
      },
    });

    expect(result.data.run.id).toBe('run_1');
    expect(m.requireEntitlement).toHaveBeenCalledWith('org_1', 'EMPLOYER_PAYROLL_OFFICIAL', 'u1');
    expect(m.resolvePayrollRules).toHaveBeenCalled();
    expect(m.calculatePayroll).toHaveBeenCalled();
    expect(m.sha256).toHaveBeenCalled();
  });
});
