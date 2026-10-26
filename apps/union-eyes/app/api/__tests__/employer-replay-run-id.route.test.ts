import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  inserts: [] as Array<{ values: any }>,
  lastTx: undefined as any,
  configs: {} as Record<string, any>,
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  createEvidencePack: vi.fn(),
  sha256: vi.fn(),
  resolvePayrollRules: vi.fn(),
  calculatePayroll: vi.fn(),
  buildReplayDiff: vi.fn(),
  buildEvaluationGraphDiff: vi.fn(),
}));

function makeSelectChain() {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve((m.selectQueue.shift() ?? []) as unknown[]).then(resolve),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
};

vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  const makeError = (status: number, message: string) => Object.assign(new Error(message), { status });
  return {
    z,
    withApi: vi.fn((cfg: any, handler: (...args: any[]) => unknown) => {
      m.configs[cfg?.openapi?.summary ?? 'unknown'] = cfg;
      return handler;
    }),
    ApiError: {
      badRequest: (message: string) => makeError(400, message),
      notFound: (message: string) => makeError(404, message),
    },
  };
});

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('../employer-execution/_lib', () => ({
  buildEvaluationGraphDiff: m.buildEvaluationGraphDiff,
  buildReplayDiff: m.buildReplayDiff,
  calculatePayroll: m.calculatePayroll,
  createEvidencePack: m.createEvidencePack,
  resolvePayrollRules: m.resolvePayrollRules,
  sha256: m.sha256,
}));

async function loadRoute() {
  return import('../employer-execution/replay/[runId]/route');
}

describe('employer-execution/replay/[runId] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.inserts = [];
    m.lastTx = undefined;
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.sha256.mockReturnValue('hash_1');
    m.resolvePayrollRules.mockReturnValue({});
    m.calculatePayroll.mockReturnValue({
      totals: { gross: 100, net: 80, dues: 10, benefits: 5, pension: 5 },
      calcTraceHash: 'replay_hash',
      items: [{ employeeExternalId: 'e1', grossPay: 100, netPay: 80, duesAmount: 10, benefitAmount: 5, pensionAmount: 5, traceHash: 'th1', trace: {} }],
    });
    m.buildReplayDiff.mockReturnValue({ changed: false, summary: 'Replay matched original run', differences: [] });
    m.buildEvaluationGraphDiff.mockReturnValue([]);
    m.createEvidencePack.mockReturnValue({
      manifestHash: 'manifest_1',
      seal: 'seal_1',
      chainLink: { parentLinkId: null, parentSealHash: null, chainDepth: 1 },
      manifest: { ok: true },
    });

    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn((values: any) => {
            m.inserts.push({ values });
            const pending: any = Promise.resolve(undefined);
            pending.returning = vi.fn(async () => [{ id: 'replay_1', diffHash: 'hash_1' }]);
            return pending;
          }),
        })),
      };
      m.lastTx = tx;
      return fn(tx);
    });
  });

  const sourceRun = {
    id: 'run_1',
    sourceBatchId: 'batch_1',
    cbaRuleVersionId: 'rv1',
    status: 'approved',
    periodEnd: '2026-01-31',
    periodStart: '2026-01-01',
    engineVersion: '1',
    totalGross: '100',
    totalNet: '80',
    totalDues: '10',
    totalBenefits: '5',
    totalPension: '5',
    calcTraceHash: 'orig',
  };

  const queueReplayInputs = () =>
    m.selectQueue.push(
      [sourceRun],
      [{ id: 'it_1', employeeExternalId: 'e1', grossPay: '100', netPay: '80', duesAmount: '10', benefitAmount: '5', pensionAmount: '5', traceHash: 'th1', traceJson: {} }],
      [],
      [{ id: 'ts_1', rowNumber: 1, employeeExternalId: 'e1', shiftDate: '2026-01-01', regularHours: '8', overtimeHours: '0', doubletimeHours: '0', travelHours: '0', premiumCode: null, status: 'valid' }],
      [{ id: 'rv1', ruleVersionCode: 'r1', sourceHash: 'h1', rulesJson: {} }],
      [],
    );

  it('is restricted to the named financial roles', async () => {
    await loadRoute();
    const { FINANCIAL_MEMBER_DATA_ROLES } = await import('@/lib/finance/financial-authority');
    expect(m.configs['Replay payroll run and diff results'].auth).toEqual({ roles: FINANCIAL_MEMBER_DATA_ROLES });
  });

  it('throws when organization context is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ organizationId: '', userId: 'user_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any)).rejects.toMatchObject({ status: 400 });
  });

  it('throws when the actor is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ organizationId: 'org_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any)).rejects.toMatchObject({ status: 400 });
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('throws when runId param is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ organizationId: 'org_1', userId: 'user_1', params: {}, body: { mode: 'exact' } } as any)).rejects.toMatchObject({ status: 400 });
  });

  it('throws not found when source run is absent', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    await expect(POST({ organizationId: 'org_1', userId: 'user_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any)).rejects.toMatchObject({ status: 404 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('throws when source run is missing source batch reference', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ ...sourceRun, sourceBatchId: null }]);

    await expect(POST({ organizationId: 'org_1', userId: 'user_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any)).rejects.toMatchObject({ status: 400 });
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('throws when source run is missing CBA rule version reference', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ ...sourceRun, cbaRuleVersionId: null }]);

    await expect(POST({ organizationId: 'org_1', userId: 'user_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any)).rejects.toMatchObject({ status: 400 });
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('creates replay, returns diff payload and audits on the same transaction', async () => {
    const { POST } = await loadRoute();
    queueReplayInputs();

    const result = await POST({ organizationId: 'org_1', userId: 'user_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any);

    expect(result.data.replay.id).toBe('replay_1');
    expect(result.data.diff.summary).toBeTruthy();
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));

    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
    expect(m.persistAtomicAudit.mock.calls[0]![0]).toBe(m.lastTx);
    expect(m.persistAtomicAudit.mock.calls[0]![1]).toMatchObject({
      organizationId: 'org_1',
      userId: 'user_1',
      action: 'employer_execution.replay.create',
      resourceType: 'employer_execution_replays',
      resourceId: 'replay_1',
      details: {
        sourcePayrollRunId: 'run_1',
        sourceRunStatus: 'approved',
        mode: 'exact',
        changed: false,
        sourceAmounts: { totalGross: '100', totalNet: '80', totalDues: '10', totalBenefits: '5', totalPension: '5' },
      },
    });
  });

  it('only adds records beside the source run and never writes to the run itself', async () => {
    const { POST } = await loadRoute();
    queueReplayInputs();

    await POST({ organizationId: 'org_1', userId: 'user_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any);

    // The transaction exposes insert only; any update/delete of the run would have thrown.
    expect(m.lastTx.update).toBeUndefined();
    expect(m.lastTx.delete).toBeUndefined();
    expect(m.inserts.some((insert) => insert.values?.eventCode)).toBe(false);
  });

  it('opens a compliance event when the replay diverges from the source run', async () => {
    const { POST } = await loadRoute();
    queueReplayInputs();
    m.buildReplayDiff.mockReturnValue({
      changed: true,
      summary: 'changed',
      differences: [{ scope: 'run', field: 'totalGross', originalValue: 100, replayValue: 110 }],
    });

    const result = await POST({ organizationId: 'org_1', userId: 'user_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any);

    expect(result.data.diff.changed).toBe(true);
    expect(m.inserts.map((insert) => insert.values?.eventCode).filter(Boolean)).toEqual(['inconsistent_replay_results']);
    expect(m.persistAtomicAudit.mock.calls[0]![1]).toMatchObject({ details: { changed: true } });
  });

  it('does not commit when the atomic audit cannot be written', async () => {
    const { POST } = await loadRoute();
    queueReplayInputs();
    m.persistAtomicAudit.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      POST({ organizationId: 'org_1', userId: 'user_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any),
    ).rejects.toThrow('audit unavailable');
  });
});
