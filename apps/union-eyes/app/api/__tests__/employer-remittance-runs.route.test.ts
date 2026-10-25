import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const makeError = (status: number, message: string) => Object.assign(new Error(message), { status });
  return {
    selectQueue: [] as unknown[][],
    locks: [] as unknown[],
    inserts: [] as Array<{ values: any }>,
    lastTx: undefined as any,
    configs: {} as Record<string, any>,
    withRLSContext: vi.fn(),
    persistAtomicAudit: vi.fn(),
    createEvidencePack: vi.fn(),
    sha256: vi.fn(),
    ApiError: {
      badRequest: (message: string) => makeError(400, message),
      forbidden: (message: string) => makeError(403, message),
      notFound: (message: string) => makeError(404, message),
      conflict: (message: string) => makeError(409, message),
      internal: (message: string) => makeError(500, message),
    },
  };
});

function makeSelectChain() {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    for: vi.fn((strength: unknown) => {
      m.locks.push(strength);
      return chain;
    }),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve((m.selectQueue.shift() ?? []) as unknown[]).then(resolve, reject),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
};

vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  return {
    z,
    withApi: vi.fn((cfg: any, handler: (...args: any[]) => unknown) => {
      m.configs[cfg?.openapi?.summary ?? 'unknown'] = cfg;
      return handler;
    }),
    ApiError: m.ApiError,
  };
});
// The real run-duties rules and the real _guard run; only the error type is swapped for one that carries a status.
vi.mock('@/lib/api/errors', () => ({ ApiError: m.ApiError }));
vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('../employer-execution/_lib', () => ({
  createEvidencePack: m.createEvidencePack,
  sha256: m.sha256,
}));

async function loadRoute() {
  return import('../employer-execution/remittance-runs/route');
}

const approvedRun = {
  id: 'run_1',
  runCode: 'pr-1',
  status: 'approved',
  periodEnd: '2026-01-31',
  periodStart: '2026-01-01',
  engineVersion: '1',
  cbaRuleVersionId: null,
  sourceBatchId: null,
  calcTraceHash: null,
  approvedBy: 'approver_1',
  approvedAt: '2026-02-01T00:00:00.000Z',
  inputSnapshot: { creatorUserId: 'preparer_1' },
  totalGross: '100',
  totalNet: '85',
  totalDues: '10.1',
  totalBenefits: '2.2',
  totalPension: '3.3',
};

const payrollItems = [
  { employeeExternalId: 'e1', duesAmount: '10.10', benefitAmount: '2.20', pensionAmount: '3.30', grossPay: '100', netPay: '85' },
];

const postCtx = (userId: string, payrollRunId = 'run_1') => ({ organizationId: 'org_1', userId, body: { payrollRunId } }) as any;

describe('employer-execution/remittance-runs route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.locks = [];
    m.inserts = [];
    m.lastTx = undefined;
    m.sha256.mockReturnValue('hash_1');
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.createEvidencePack.mockReturnValue({
      manifestHash: 'manifest_1',
      seal: 'seal_1',
      chainLink: { parentLinkId: null, parentSealHash: null, chainDepth: 1 },
      manifest: { ok: true },
    });

    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => makeSelectChain()),
        insert: vi.fn(() => ({
          values: vi.fn((values: any) => {
            m.inserts.push({ values });
            const pending: any = Promise.resolve([]);
            pending.returning = vi.fn(async () => [{
              id: 'rr_1',
              runCode: 'rr-1',
              status: 'generated',
              generatedAt: '2026-02-02T00:00:00.000Z',
            }]);
            return pending;
          }),
        })),
      };
      m.lastTx = tx;
      return fn(tx);
    });
  });

  it('GET returns remittance runs for organization', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: 'rr_1', runCode: 'rr-1' }]);

    const result = await GET({ organizationId: 'org_1' } as any);
    expect(result.data).toHaveLength(1);
  });

  it('POST is restricted to the named financial roles', async () => {
    await loadRoute();
    const { FINANCIAL_MEMBER_DATA_ROLES } = await import('@/lib/finance/financial-authority');
    expect(m.configs['Generate remittance package from approved run'].auth).toEqual({ roles: FINANCIAL_MEMBER_DATA_ROLES });
  });

  it('POST throws when organization is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ organizationId: '', body: { payrollRunId: 'x' } } as any)).rejects.toMatchObject({ status: 400 });
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('POST throws 404 when payroll run does not exist', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    await expect(POST(postCtx('u1'))).rejects.toMatchObject({ status: 404 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST throws when payroll run is not approved', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ ...approvedRun, status: 'draft' }]);

    await expect(POST(postCtx('u1'))).rejects.toMatchObject({ status: 400 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it.each([
    ['the preparer', 'preparer_1'],
    ['the approver', 'approver_1'],
  ])('POST refuses generation by %s with 403', async (_label, actor) => {
    const { POST } = await loadRoute();
    m.selectQueue.push([approvedRun]);

    await expect(POST(postCtx(actor))).rejects.toMatchObject({ status: 403 });
    expect(m.inserts).toHaveLength(0);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST fails closed with 403 when the run records no approver', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ ...approvedRun, approvedBy: null }]);

    await expect(POST(postCtx('executor_1'))).rejects.toMatchObject({ status: 403 });
    expect(m.inserts).toHaveLength(0);
  });

  it('POST returns 409 when a remittance already exists for the payroll run (one per run)', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([approvedRun], [{ id: 'rr_existing' }]);

    await expect(POST(postCtx('executor_1'))).rejects.toMatchObject({ status: 409 });
    expect(m.inserts).toHaveLength(0);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST generates a remittance under a run lock and audits on the same transaction', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([approvedRun], [], [], payrollItems);

    const result = await POST(postCtx('executor_1'));

    expect(result.data.remittanceRun.id).toBe('rr_1');
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.locks).toEqual(['update']);
    expect(m.createEvidencePack).toHaveBeenCalled();

    expect(m.inserts[0]!.values).toMatchObject({
      payrollRunId: 'run_1',
      totalDue: '15.6',
      generatedBy: 'executor_1',
    });

    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
    expect(m.persistAtomicAudit.mock.calls[0]![0]).toBe(m.lastTx);
    expect(m.persistAtomicAudit.mock.calls[0]![1]).toMatchObject({
      organizationId: 'org_1',
      userId: 'executor_1',
      action: 'employer_execution.remittance_run.generate',
      resourceType: 'employer_remittance_runs',
      resourceId: 'rr_1',
      details: {
        payrollRunId: 'run_1',
        preparedBy: 'preparer_1',
        approvers: ['approver_1'],
        executedBy: 'executor_1',
        totals: { dues: 10.1, benefits: 2.2, pension: 3.3 },
        totalDue: 15.6,
        payrollRunAmounts: { totalGross: '100', totalNet: '85', totalDues: '10.1' },
      },
    });
  });

  it('POST chains the evidence from the payroll run seal and ignores replay manifests', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push(
      [approvedRun],
      [],
      [
        { manifestJson: { chainLink: { linkId: 'replay_link', sealHash: 'replay_seal', chainDepth: 2, entityType: 'replay' } } },
        { manifestJson: { chainLink: { linkId: 'run_link', sealHash: 'run_seal', chainDepth: 1, entityType: 'payroll_run' } } },
      ],
      payrollItems,
    );

    await POST(postCtx('executor_1'));

    expect(m.createEvidencePack.mock.calls[0]![0].metadata.parentLink).toEqual({
      linkId: 'run_link',
      sealHash: 'run_seal',
      chainDepth: 1,
    });
  });

  it('POST does not commit when the atomic audit cannot be written', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([approvedRun], [], [], payrollItems);
    m.persistAtomicAudit.mockRejectedValue(new Error('audit unavailable'));

    await expect(POST(postCtx('executor_1'))).rejects.toThrow('audit unavailable');
  });
});
