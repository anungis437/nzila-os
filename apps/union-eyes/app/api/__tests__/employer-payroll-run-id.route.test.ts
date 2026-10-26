import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    updateQueue: [] as unknown[][],
    locks: [] as unknown[],
    updates: [] as Array<{ values: any }>,
    inserts: [] as Array<{ values: any }>,
    lastTx: undefined as any,
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain: any = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      for: vi.fn((strength: unknown) => {
        state.locks.push(strength);
        return chain;
      }),
      then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
        nextSelect().then(resolve, reject),
    };
    return chain;
  };

  const makeError = (status: number, message: string) => Object.assign(new Error(message), { status });

  return {
    state,
    configs: {} as Record<string, any>,
    requireEntitlement: vi.fn(),
    persistAtomicAudit: vi.fn(),
    verifyEvidenceChainFromLinks: vi.fn(),
    enforcePayrollLifecycleTransition: vi.fn(),
    createEvidencePack: vi.fn(),
    sha256: vi.fn(),
    withRLSContext: vi.fn(),
    ApiError: {
      badRequest: (message: string) => makeError(400, message),
      forbidden: (message: string) => makeError(403, message),
      notFound: (message: string) => makeError(404, message),
      conflict: (message: string) => makeError(409, message),
    },
    resetQueues: () => {
      state.selectQueue = [];
      state.updateQueue = [];
      state.locks = [];
      state.updates = [];
      state.inserts = [];
      state.lastTx = undefined;
    },
    queueSelect: (...rows: unknown[][]) => state.selectQueue.push(...rows),
    queueUpdate: (...rows: unknown[][]) => state.updateQueue.push(...rows),
    createSelectChain,
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
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
// The real run-duties rules and the real _guard run; only the error type is swapped for one that carries a status.
vi.mock('@/lib/api/errors', () => ({ ApiError: m.ApiError }));
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

async function loadRoute() {
  return import('../employer-execution/payroll-runs/[id]/route');
}

const baseRun = {
  organizationId: 'org_1',
  runCode: 'pr-1',
  runType: 'official',
  status: 'calculated',
  immutableSnapshotLocked: false,
  cbaRuleVersionId: null,
  sourceBatchId: 'batch_1',
  engineVersion: 'v1',
  calcTraceHash: 'calc_hash',
  calcTrace: {},
  totalGross: '300',
  totalNet: '240',
  totalDues: '30',
  totalBenefits: '15',
  totalPension: '15',
  approvedBy: null,
};

const preparedSnapshot = { creatorUserId: 'preparer_1' };

const patch = (userId: string, runId: string, action: 'approve' | 'seal') => ({
  organizationId: 'org_1',
  params: { id: runId },
  userId,
  body: { action, acknowledgedEventIds: [] },
}) as any;

const auditEntry = () => m.persistAtomicAudit.mock.calls[0]![1] as any;

describe('employer-execution/payroll-runs/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.verifyEvidenceChainFromLinks.mockReturnValue({ valid: true });
    m.enforcePayrollLifecycleTransition.mockImplementation(() => undefined);
    m.createEvidencePack.mockReturnValue({
      manifestHash: 'manifest_hash',
      seal: 'seal_hash',
      chainLink: { linkId: 'link_1', sealHash: 'seal_hash', chainDepth: 1 },
      manifest: { a: 1 },
    });
    m.sha256.mockReturnValue('snapshot_hash');

    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => m.createSelectChain()),
        update: vi.fn(() => ({
          set: vi.fn((values: any) => {
            m.state.updates.push({ values });
            return {
              where: vi.fn(() => {
                const pending: any = Promise.resolve(undefined);
                pending.returning = vi.fn(async () => m.state.updateQueue.shift() ?? []);
                return pending;
              }),
            };
          }),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(async (values: any) => {
            m.state.inserts.push({ values });
          }),
        })),
      };
      m.state.lastTx = tx;
      return fn(tx);
    });
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

  it('PATCH is restricted to the named financial roles', async () => {
    await loadRoute();
    const { FINANCIAL_MEMBER_DATA_ROLES } = await import('@/lib/finance/financial-authority');
    expect(m.configs['Transition official payroll run lifecycle'].auth).toEqual({ roles: FINANCIAL_MEMBER_DATA_ROLES });
  });

  it('PATCH returns 404 when the run does not exist', async () => {
    const { PATCH } = await loadRoute();
    m.queueSelect([]);

    await expect(PATCH(patch('approver_1', 'run_x', 'approve'))).rejects.toMatchObject({ status: 404 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('PATCH reads the run under a row lock inside the RLS transaction', async () => {
    const { PATCH } = await loadRoute();
    m.queueSelect([{ ...baseRun, id: 'run_3', runType: 'preview' }]);

    await expect(PATCH(patch('approver_1', 'run_3', 'approve'))).rejects.toMatchObject({ status: 400 });
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.state.locks).toEqual(['update']);
  });

  describe('approve', () => {
    it('captures the first approver when dual approval is required and audits on the same transaction', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect(
        [{ ...baseRun, id: 'run_2', cbaRuleVersionId: 'rv_1', inputSnapshot: preparedSnapshot }],
        [],
        [],
        [{ id: 'rv_1', profileId: 'profile_1' }],
        [{ id: 'profile_1', configJson: { require_dual_approval: true } }],
      );
      m.queueUpdate([{ id: 'run_2' }]);

      const result = await PATCH(patch('approver_1', 'run_2', 'approve'));

      expect(result.data).toMatchObject({ runId: 'run_2', approvalPending: true, status: 'calculated' });
      expect(m.state.updates).toHaveLength(1);
      expect(m.state.updates[0]!.values.inputSnapshot.approvals).toEqual([
        expect.objectContaining({ userId: 'approver_1' }),
      ]);
      expect(m.state.updates[0]!.values.status).toBeUndefined();

      expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
      expect(m.persistAtomicAudit.mock.calls[0]![0]).toBe(m.state.lastTx);
      expect(auditEntry()).toMatchObject({
        userId: 'approver_1',
        action: 'employer_execution.payroll_run.approval_recorded',
        resourceId: 'run_2',
        details: { preparedBy: 'preparer_1', firstApprover: 'approver_1' },
      });
    });

    it('refuses self-approval by the recorded preparer with 403 and writes nothing', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect([{ ...baseRun, id: 'run_2', inputSnapshot: preparedSnapshot }], [], []);

      await expect(PATCH(patch('preparer_1', 'run_2', 'approve'))).rejects.toMatchObject({ status: 403 });
      expect(m.state.updates).toHaveLength(0);
      expect(m.state.inserts).toHaveLength(0);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('fails closed with 403 when the preparer is not recorded on the run', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect([{ ...baseRun, id: 'run_2', inputSnapshot: {} }], [], []);

      await expect(PATCH(patch('approver_1', 'run_2', 'approve'))).rejects.toMatchObject({ status: 403 });
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('refuses the same person approving twice under dual approval', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect(
        [{
          ...baseRun,
          id: 'run_2',
          inputSnapshot: { ...preparedSnapshot, approvals: [{ userId: 'approver_1', at: '2026-01-01T00:00:00Z' }] },
        }],
        [],
        [],
      );
      await expect(PATCH(patch('approver_1', 'run_2', 'approve'))).rejects.toMatchObject({ status: 403 });
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('finalises approval with a second distinct approver and audits both approvers atomically', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect(
        [{
          ...baseRun,
          id: 'run_2',
          cbaRuleVersionId: 'rv_1',
          inputSnapshot: { ...preparedSnapshot, approvals: [{ userId: 'approver_1', at: '2026-01-01T00:00:00Z' }] },
        }],
        [],
        [],
        [{ id: 'rv_1', profileId: 'profile_1' }],
        [{ id: 'profile_1', configJson: { require_dual_approval: true } }],
      );
      m.queueUpdate([{ ...baseRun, id: 'run_2', status: 'approved', approvedBy: 'approver_2' }]);

      const result = await PATCH(patch('approver_2', 'run_2', 'approve'));

      expect(result.data.run).toMatchObject({ id: 'run_2', status: 'approved' });
      expect(m.state.updates[0]!.values).toMatchObject({
        status: 'approved',
        immutableSnapshotLocked: true,
        approvedBy: 'approver_2',
      });
      expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
      expect(m.persistAtomicAudit.mock.calls[0]![0]).toBe(m.state.lastTx);
      expect(auditEntry()).toMatchObject({
        userId: 'approver_2',
        action: 'employer_execution.payroll_run.approve',
        details: {
          preparedBy: 'preparer_1',
          approvers: ['approver_1', 'approver_2'],
          dualApproval: true,
          evidenceManifestHash: 'manifest_hash',
        },
      });
    });

    it('approves in one step when dual approval is not required', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect([{ ...baseRun, id: 'run_2', inputSnapshot: preparedSnapshot }], [], []);
      m.queueUpdate([{ ...baseRun, id: 'run_2', status: 'approved', approvedBy: 'approver_1' }]);

      const result = await PATCH(patch('approver_1', 'run_2', 'approve'));

      expect(result.data.run).toMatchObject({ status: 'approved' });
      expect(auditEntry()).toMatchObject({
        action: 'employer_execution.payroll_run.approve',
        details: { approvers: ['approver_1'], dualApproval: false },
      });
    });

    it('returns 409 when the run changed state before the approval update (status predicate)', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect([{ ...baseRun, id: 'run_2', inputSnapshot: preparedSnapshot }], [], []);
      m.queueUpdate([]);

      await expect(PATCH(patch('approver_1', 'run_2', 'approve'))).rejects.toMatchObject({ status: 409 });
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('rejects while blocking critical compliance events are open', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect([{ ...baseRun, id: 'run_2', inputSnapshot: preparedSnapshot }], [{ id: 'evt_1' }]);

      await expect(PATCH(patch('approver_1', 'run_2', 'approve'))).rejects.toMatchObject({ status: 400 });
      expect(m.state.updates).toHaveLength(0);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('rejects non-official runs', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect([{ ...baseRun, id: 'run_3', runType: 'preview', inputSnapshot: preparedSnapshot }]);

      await expect(PATCH(patch('approver_1', 'run_3', 'approve'))).rejects.toMatchObject({ status: 400 });
    });

    it('does not commit when the atomic audit cannot be written', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect([{ ...baseRun, id: 'run_2', inputSnapshot: preparedSnapshot }], [], []);
      m.queueUpdate([{ ...baseRun, id: 'run_2', status: 'approved', approvedBy: 'approver_1' }]);
      m.persistAtomicAudit.mockRejectedValue(new Error('audit unavailable'));

      await expect(PATCH(patch('approver_1', 'run_2', 'approve'))).rejects.toThrow('audit unavailable');
    });
  });

  describe('seal (execute)', () => {
    const approvedRun = {
      ...baseRun,
      id: 'run_4',
      status: 'approved',
      immutableSnapshotLocked: true,
      inputSnapshot: preparedSnapshot,
      approvedBy: 'approver_1',
    };

    it('executes an approved run as a third party and audits on the same transaction', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect([approvedRun]);
      m.queueUpdate([{ ...approvedRun, status: 'posted' }]);

      const result = await PATCH(patch('executor_1', 'run_4', 'seal'));

      expect(result.data.run).toMatchObject({ id: 'run_4', status: 'posted' });
      expect(m.state.updates[0]!.values).toMatchObject({ status: 'posted', immutableSnapshotLocked: true, executedBy: 'executor_1' });
      expect(m.state.updates[0]!.values.executedAt).toBeInstanceOf(Date);
      expect(m.state.inserts.map((insert) => insert.values.eventCode)).toEqual(['official_run_posted']);
      expect(m.state.inserts[0]!.values.details).toMatchObject({
        executedBy: 'executor_1',
        preparedBy: 'preparer_1',
        approvers: ['approver_1'],
      });

      expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
      expect(m.persistAtomicAudit.mock.calls[0]![0]).toBe(m.state.lastTx);
      expect(auditEntry()).toMatchObject({
        userId: 'executor_1',
        action: 'employer_execution.payroll_run.execute',
        resourceId: 'run_4',
        details: {
          preparedBy: 'preparer_1',
          approvers: ['approver_1'],
          executedBy: 'executor_1',
          amounts: { totalGross: '300', totalNet: '240' },
        },
      });
    });

    it.each([
      ['the preparer', 'preparer_1'],
      ['the approver', 'approver_1'],
    ])('refuses execution by %s with 403', async (_label, actor) => {
      const { PATCH } = await loadRoute();
      m.queueSelect([approvedRun]);

      await expect(PATCH(patch(actor, 'run_4', 'seal'))).rejects.toMatchObject({ status: 403 });
      expect(m.state.updates).toHaveLength(0);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('fails closed with 403 when no approver is recorded on the run', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect([{ ...approvedRun, approvedBy: null }]);

      await expect(PATCH(patch('executor_1', 'run_4', 'seal'))).rejects.toMatchObject({ status: 403 });
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('rejects a run that is not approved', async () => {
      const { PATCH } = await loadRoute();
      m.enforcePayrollLifecycleTransition.mockImplementation(() => {
        throw new Error('Run must be approved before it can be sealed');
      });
      m.queueSelect([{ ...approvedRun, status: 'calculated' }]);

      await expect(PATCH(patch('executor_1', 'run_4', 'seal'))).rejects.toMatchObject({ status: 400 });
      expect(m.state.updates).toHaveLength(0);
    });

    it('returns 409 when the run was already executed concurrently (status predicate)', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect([approvedRun]);
      m.queueUpdate([]);

      await expect(PATCH(patch('executor_1', 'run_4', 'seal'))).rejects.toMatchObject({ status: 409 });
      expect(m.state.inserts).toHaveLength(0);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('does not commit when the atomic audit cannot be written', async () => {
      const { PATCH } = await loadRoute();
      m.queueSelect([approvedRun]);
      m.queueUpdate([{ ...approvedRun, status: 'posted' }]);
      m.persistAtomicAudit.mockRejectedValue(new Error('audit unavailable'));

      await expect(PATCH(patch('executor_1', 'run_4', 'seal'))).rejects.toThrow('audit unavailable');
    });
  });
});
