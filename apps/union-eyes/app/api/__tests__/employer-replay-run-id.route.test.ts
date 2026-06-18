import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  withRLSContext: vi.fn(),
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
    withApi: vi.fn((_: unknown, handler: (...args: any[]) => unknown) => handler),
    ApiError: {
      badRequest: (message: string) => makeError(400, message),
      notFound: (message: string) => makeError(404, message),
    },
  };
});

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
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

    m.withRLSContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(async () => [{ id: 'replay_1' }]),
          })),
        })),
      };
      return fn(tx);
    });
  });

  it('throws when organization context is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ organizationId: '', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any)).rejects.toMatchObject({ status: 400 });
  });

  it('throws when runId param is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ organizationId: 'org_1', params: {}, body: { mode: 'exact' } } as any)).rejects.toMatchObject({ status: 400 });
  });

  it('throws not found when source run is absent', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    await expect(POST({ organizationId: 'org_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any)).rejects.toMatchObject({ status: 404 });
  });

  it('throws when source run is missing source batch reference', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'run_1', sourceBatchId: null, cbaRuleVersionId: 'rv1', status: 'approved' }]);

    await expect(POST({ organizationId: 'org_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any)).rejects.toMatchObject({ status: 400 });
  });

  it('creates replay and returns diff payload on success', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push(
      [{ id: 'run_1', sourceBatchId: 'batch_1', cbaRuleVersionId: 'rv1', status: 'approved', periodEnd: '2026-01-31', periodStart: '2026-01-01', engineVersion: '1', totalGross: '100', totalNet: '80', totalDues: '10', totalBenefits: '5', totalPension: '5', calcTraceHash: 'orig', sourceRunCode: 'pr-1' }],
      [{ id: 'it_1', employeeExternalId: 'e1', grossPay: '100', netPay: '80', duesAmount: '10', benefitAmount: '5', pensionAmount: '5', traceHash: 'th1', traceJson: {} }],
      [],
      [{ id: 'ts_1', rowNumber: 1, employeeExternalId: 'e1', shiftDate: '2026-01-01', regularHours: '8', overtimeHours: '0', doubletimeHours: '0', travelHours: '0', premiumCode: null, status: 'valid' }],
      [{ id: 'rv1', ruleVersionCode: 'r1', sourceHash: 'h1', rulesJson: {} }],
      [],
    );

    const result = await POST({ organizationId: 'org_1', userId: 'user_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any);
    expect(result.data.replay.id).toBe('replay_1');
    expect(result.data.diff.summary).toBeTruthy();
  });
});
