import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    rlsUpdateResult: [] as unknown[],
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (value: unknown[]) => unknown) => nextSelect().then(resolve),
    };
    return chain;
  };

  return {
    state,
    requireEntitlement: vi.fn(),
    verifyEvidenceChainFromLinks: vi.fn(),
    enforcePayrollLifecycleTransition: vi.fn(),
    createEvidencePack: vi.fn(),
    sha256: vi.fn(),
    resetQueues: () => {
      state.selectQueue = [];
      state.rlsUpdateResult = [];
    },
    queueSelect: (...rows: unknown[][]) => state.selectQueue.push(...rows),
    createSelectChain,
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (fn: (tx: any) => Promise<unknown>) => {
    const tx = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => m.state.rlsUpdateResult),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async () => undefined),
      })),
    };
    return fn(tx);
  }),
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  PLATFORM_MODULES: { EMPLOYER_PAYROLL_OFFICIAL: 'employer_payroll_official' },
  requireEntitlement: m.requireEntitlement,
}));
vi.mock('../employer-execution/_lib', () => ({
  createEvidencePack: m.createEvidencePack,
  enforcePayrollLifecycleTransition: m.enforcePayrollLifecycleTransition,
  sha256: m.sha256,
  verifyEvidenceChainFromLinks: m.verifyEvidenceChainFromLinks,
}));
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

async function loadRoute() {
  return import('../employer-execution/payroll-runs/[id]/route');
}

describe('employer-execution/payroll-runs/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.verifyEvidenceChainFromLinks.mockReturnValue({ valid: true });
    m.enforcePayrollLifecycleTransition.mockImplementation(() => undefined);
    m.createEvidencePack.mockReturnValue({
      manifestHash: 'manifest_hash',
      seal: 'seal_hash',
      chainLink: { linkId: 'link_1', sealHash: 'seal_hash', chainDepth: 1 },
      manifest: { a: 1 },
    });
    m.sha256.mockReturnValue('snapshot_hash');
  });

  it('GET returns run details with chain verification', async () => {
    const { GET } = await loadRoute();

    m.queueSelect(
      [{ id: 'run_1', runType: 'official', organizationId: 'org_1', status: 'calculated' }],
      [{ id: 'item_1', payrollRunId: 'run_1' }],
      [{
        id: 'artifact_1',
        manifestJson: {
          chainLink: {
            linkId: 'l1',
            organizationId: 'org_1',
            entityType: 'payroll_run',
            targetEntityId: 'run_1',
            manifestHash: 'mh',
            sealHash: 'sh',
            chainDepth: 1,
            createdAt: new Date().toISOString(),
          },
        },
      }],
    );

    const result = await GET({ organizationId: 'org_1', params: { id: 'run_1' } } as any);

    expect(result.data.run.id).toBe('run_1');
    expect(result.data.items.length).toBe(1);
    expect(result.data.chainVerification).toMatchObject({ valid: true });
  });

  it('PATCH approve captures first approver when dual-approval is required', async () => {
    const { PATCH } = await loadRoute();
    m.queueSelect(
      [{
        id: 'run_2',
        organizationId: 'org_1',
        runType: 'official',
        status: 'calculated',
        immutableSnapshotLocked: false,
        cbaRuleVersionId: 'rv_1',
        inputSnapshot: {},
      }],
      [],
      [],
      [{ id: 'rv_1', profileId: 'profile_1' }],
      [{ id: 'profile_1', configJson: { require_dual_approval: true } }],
    );

    const result = await PATCH({
      organizationId: 'org_1',
      params: { id: 'run_2' },
      userId: 'approver_1',
      body: { action: 'approve', acknowledgedEventIds: [] },
    } as any);

    expect(result.data).toMatchObject({
      runId: 'run_2',
      approvalPending: true,
      status: 'calculated',
    });
  });

  it('PATCH approve rejects non-official runs', async () => {
    const { PATCH } = await loadRoute();
    m.queueSelect([
      {
        id: 'run_3',
        organizationId: 'org_1',
        runType: 'preview',
        status: 'calculated',
        immutableSnapshotLocked: false,
      },
    ]);

    await expect(
      PATCH({
        organizationId: 'org_1',
        params: { id: 'run_3' },
        userId: 'approver_1',
        body: { action: 'approve', acknowledgedEventIds: [] },
      } as any),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('PATCH seal updates run to posted', async () => {
    const { PATCH } = await loadRoute();
    m.queueSelect([
      {
        id: 'run_4',
        organizationId: 'org_1',
        runType: 'official',
        status: 'approved',
        immutableSnapshotLocked: true,
      },
    ]);
    m.state.rlsUpdateResult = [{ id: 'run_4', status: 'posted' }];

    const result = await PATCH({
      organizationId: 'org_1',
      params: { id: 'run_4' },
      userId: 'approver_2',
      body: { action: 'seal', acknowledgedEventIds: [] },
    } as any);

    expect(result.data.run).toMatchObject({ id: 'run_4', status: 'posted' });
  });
});
