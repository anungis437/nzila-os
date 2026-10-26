import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const makeError = (status: number, message: string) => Object.assign(new Error(message), { status });
  return {
    withApi: vi.fn(),
    // Route configs are captured once at module load, so they survive vi.clearAllMocks().
    configs: {} as Record<string, any>,
    ApiError: {
      badRequest: (msg: string) => makeError(400, msg),
      notFound: (msg: string) => makeError(404, msg),
      conflict: (msg: string) => makeError(409, msg),
      forbidden: (msg: string) => makeError(403, msg),
      internal: (msg: string) => makeError(500, msg),
    },
    db: {
      select: vi.fn(),
      insert: vi.fn(),
    },
    withRLSContext: vi.fn(),
    persistAtomicAudit: vi.fn(),
    requireEntitlement: vi.fn(),
    requireLiveFinancialMandate: vi.fn(),
    resolvePayrollRules: vi.fn(),
    calculatePayroll: vi.fn(),
    sha256: vi.fn(),
    selectResults: [] as any[],
    txInserts: [] as Array<{ table: unknown; values: any }>,
    lastTx: undefined as any,
    createdRun: {} as Record<string, unknown>,
  };
});

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: m.ApiError, z: require('zod') }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({
  requireLiveFinancialMandate: m.requireLiveFinancialMandate,
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
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

    m.txInserts = [];
    m.lastTx = undefined;
    m.createdRun = {
      id: 'run_1',
      runCode: 'pr-1',
      totalGross: '300',
      totalNet: '240',
      totalDues: '30',
      totalBenefits: '15',
      totalPension: '15',
    };
    m.persistAtomicAudit.mockResolvedValue(undefined);

    m.withApi.mockImplementation((cfg: any, handler: any) => {
      m.configs[cfg?.openapi?.summary ?? 'unknown'] = cfg;
      return (ctx: any = {}) => handler(ctx);
    });

    m.db.select.mockImplementation(() => ({
      from: vi.fn(() => makeQuery(m.selectResults.shift() ?? [])),
    }));

    m.withRLSContext.mockImplementation((_ctx: unknown, fn: any) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => makeQuery(m.selectResults.shift() ?? [])),
        })),
        insert: vi.fn((table: unknown) => ({
          values: vi.fn((values: any) => {
            m.txInserts.push({ table, values });
            const pending: any = Promise.resolve(undefined);
            pending.returning = async () => [m.createdRun];
            return pending;
          }),
        })),
      };
      m.lastTx = tx;
      return fn(tx);
    });

    m.resolvePayrollRules.mockReturnValue({});
    m.requireLiveFinancialMandate.mockResolvedValue(undefined);
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

  const validRequest = {
    timesheetBatchId: '00000000-0000-0000-0000-000000000001',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-15',
    runType: 'preview',
    engineVersion: 'employer-execution-v1',
  };

  const timesheetRows = [
    {
      rowNumber: 1,
      employeeExternalId: 'emp_1',
      shiftDate: '2026-01-10',
      regularHours: '8',
      overtimeHours: '0',
      doubletimeHours: '0',
      travelHours: '0',
      premiumCode: null,
      jobClassificationId: 'class_1',
      memberEmploymentId: 'employment_1',
    },
  ];

  const activeRuleVersion = {
    id: 'rule_version_1',
    ruleVersionCode: 'rv1',
    sourceHash: 'rule-source',
    rulesJson: { version: 1 },
    employerId: 'emp_1',
    worksiteId: 'site_1',
    bargainingUnitId: 'bu_1',
  };

  it('POST is restricted to the named financial roles', async () => {
    await loadRoute();
    const { FINANCIAL_MEMBER_DATA_ROLES } = await import('@/lib/finance/financial-authority');
    expect(m.configs['Create deterministic payroll run'].auth).toEqual({ roles: FINANCIAL_MEMBER_DATA_ROLES });
  });

  it('POST fails with 404 when timesheet batch is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST({
      organizationId: 'org_1',
      userId: 'u1',
      body: validRequest,
    })).rejects.toMatchObject({ status: 404 });
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST refuses a batch that has not been validated', async () => {
    const { POST } = await loadRoute();
    m.selectResults = [[{ id: 'batch_1', employerId: 'emp_1', status: 'uploaded' }]];

    await expect(POST({
      organizationId: 'org_1',
      userId: 'u1',
      body: validRequest,
    })).rejects.toMatchObject({ status: 400 });
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST refuses an official run when one is already approved for the batch', async () => {
    const { POST } = await loadRoute();
    m.selectResults = [
      [{ id: 'batch_1', employerId: 'emp_1', status: 'validated' }],
      [{ id: 'run_approved' }],
    ];

    await expect(POST({
      organizationId: 'org_1',
      userId: 'u1',
      body: { ...validRequest, runType: 'official' },
    })).rejects.toMatchObject({ status: 400 });
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('POST prepares a preview run, records the preparer and audits on the same transaction', async () => {
    const { POST } = await loadRoute();
    m.selectResults = [
      [{ id: 'batch_1', employerId: 'emp_1', status: 'validated', sourceFileHash: 'source-hash', worksiteId: 'site_1', bargainingUnitId: 'bu_1' }],
      timesheetRows,
      [activeRuleVersion],
      [{ id: 'rule_item_1', precedence: 1 }],
    ];

    const result = await POST({ organizationId: 'org_1', userId: 'preparer_1', body: validRequest });

    expect(result.data.run.id).toBe('run_1');
    expect(m.requireEntitlement).not.toHaveBeenCalled();

    const runInsert = m.txInserts[0]!.values;
    expect(runInsert).toMatchObject({
      organizationId: 'org_1',
      runType: 'preview',
      status: 'calculated',
      immutableSnapshotLocked: false,
      inputSnapshot: { creatorUserId: 'preparer_1' },
    });

    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
    const [auditTx, entry] = m.persistAtomicAudit.mock.calls[0]!;
    expect(auditTx).toBe(m.lastTx);
    expect(entry).toMatchObject({
      organizationId: 'org_1',
      userId: 'preparer_1',
      action: 'employer_execution.payroll_run.prepare',
      resourceType: 'employer_payroll_runs',
      resourceId: 'run_1',
      details: {
        runType: 'preview',
        preparedBy: 'preparer_1',
        itemCount: 2,
        amounts: { totalGross: '300', totalNet: '240', totalDues: '30', totalBenefits: '15', totalPension: '15' },
      },
    });
  });

  it('POST rolls back (rejects) when the atomic audit cannot be written', async () => {
    const { POST } = await loadRoute();
    m.selectResults = [
      [{ id: 'batch_1', employerId: 'emp_1', status: 'validated', worksiteId: null, bargainingUnitId: null }],
      timesheetRows,
      [activeRuleVersion],
      [],
    ];
    m.persistAtomicAudit.mockRejectedValue(new Error('audit unavailable'));

    await expect(POST({ organizationId: 'org_1', userId: 'u1', body: validRequest })).rejects.toThrow('audit unavailable');
  });

  it('POST creates an official payroll run, compliance events and audit on one transaction', async () => {
    const { POST } = await loadRoute();
    m.selectResults = [
      [{ id: 'batch_1', employerId: 'emp_1', status: 'validated', sourceFileHash: 'source-hash', worksiteId: 'site_1', bargainingUnitId: 'bu_1' }],
      [],
      [
        ...timesheetRows,
        {
          rowNumber: 2,
          employeeExternalId: 'emp_2',
          shiftDate: '2026-01-10',
          regularHours: '6',
          overtimeHours: '2',
          doubletimeHours: '0',
          travelHours: '1',
          premiumCode: 'night',
          jobClassificationId: null,
          memberEmploymentId: null,
        },
      ],
      [activeRuleVersion],
      [{ id: 'rule_item_1', precedence: 1 }],
    ];

    const result = await POST({
      organizationId: 'org_1',
      userId: 'u1',
      body: { ...validRequest, timesheetBatchId: 'batch_1', runType: 'official' },
    });

    expect(result.data.run.id).toBe('run_1');
    expect(m.requireEntitlement).toHaveBeenCalledWith('org_1', 'EMPLOYER_PAYROLL_OFFICIAL', 'u1');
    expect(m.resolvePayrollRules).toHaveBeenCalled();
    expect(m.calculatePayroll).toHaveBeenCalled();
    expect(m.sha256).toHaveBeenCalled();

    const eventCodes = m.txInserts
      .map((insert) => insert.values?.eventCode)
      .filter((code): code is string => typeof code === 'string');
    expect(eventCodes).toEqual(['missing_classification', 'missing_employment_mapping', 'official_run_pending_approval']);

    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
    expect(m.persistAtomicAudit.mock.calls[0]![0]).toBe(m.lastTx);
    expect(m.persistAtomicAudit.mock.calls[0]![1]).toMatchObject({
      action: 'employer_execution.payroll_run.prepare',
      details: { runType: 'official', preparedBy: 'u1', itemCount: 2 },
    });
  });
});
