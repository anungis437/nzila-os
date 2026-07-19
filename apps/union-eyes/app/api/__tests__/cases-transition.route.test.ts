import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const state = {
    claimRows: [] as unknown[],
  };

  return {
    state,
    auth: vi.fn(),
    withRLSContext: vi.fn(),
    getOrganizationIdForUser: vi.fn(),
    getUserRoleInOrganization: vi.fn(),
    requireEntitlement: vi.fn(),
    validateTransition: vi.fn(),
    getAllowedTransitions: vi.fn(),
    toLifecycleState: vi.fn(),
    wrapSchemaQuery: vi.fn(),
    auditDataMutation: vi.fn(),
    buildUnionEvidencePack: vi.fn(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    resetState: () => {
      state.claimRows = [];
    },
  };
});

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: m.getOrganizationIdForUser,
  getUserRoleInOrganization: m.getUserRoleInOrganization,
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/workflow/case-lifecycle', () => ({
  validateTransition: m.validateTransition,
  getAllowedTransitions: m.getAllowedTransitions,
}));
vi.mock('@/lib/workflow/state-bridge', () => ({ toLifecycleState: m.toLifecycleState }));
vi.mock('@/lib/schema-error', () => ({ wrapSchemaQuery: m.wrapSchemaQuery }));
vi.mock('@/lib/audit-logger', () => ({ auditDataMutation: m.auditDataMutation }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/cases/case_1/transition', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeTx(claimRows: unknown[]) {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    limit: vi.fn(() => selectChain),
    for: vi.fn(async () => claimRows),
  };

  return {
    select: vi.fn(() => selectChain),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async () => undefined),
    })),
  };
}

async function loadRoute() {
  return import('../cases/[caseId]/transition/route');
}

describe('cases/[caseId]/transition route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetState();
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getUserRoleInOrganization.mockResolvedValue('steward');
    m.wrapSchemaQuery.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.toLifecycleState.mockImplementation((_type: string, status: string) => {
      const map: Record<string, string> = {
        filed: 'submitted',
        acknowledged: 'triage',
        settled: 'resolved',
      };
      return map[status] ?? 'submitted';
    });
    m.validateTransition.mockReturnValue({ allowed: true });
    m.getAllowedTransitions.mockReturnValue(['resolved']);
    m.auditDataMutation.mockResolvedValue(undefined);
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = makeTx(m.state.claimRows);
      return fn(tx);
    });
  });

  it('returns 401 when unauthenticated', async () => {
    const { PATCH } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await PATCH(makeRequest({ targetStatus: 'settled' }), { params: Promise.resolve({ caseId: 'case_1' }) });

    expect(response.status).toBe(401);
  });

  it('returns 400 when request body fails validation', async () => {
    const { PATCH } = await loadRoute();

    const response = await PATCH(makeRequest({ targetStatus: '' }), { params: Promise.resolve({ caseId: 'case_1' }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'VALIDATION_ERROR' });
  });

  it('returns 404 when claim is not found', async () => {
    const { PATCH } = await loadRoute();
    m.state.claimRows = [];

    const response = await PATCH(makeRequest({ targetStatus: 'settled' }), { params: Promise.resolve({ caseId: 'missing_case' }) });

    expect(response.status).toBe(404);
  });

  it('returns 403 when transition is denied by FSM', async () => {
    const { PATCH } = await loadRoute();
    m.state.claimRows = [{
      claimId: 'case_1',
      status: 'submitted',
      priority: 'high',
      organizationId: 'org_1',
      assignedTo: 'agent_1',
    }];
    m.validateTransition.mockReturnValueOnce({ allowed: false, reason: 'Forbidden transition' });
    m.getAllowedTransitions.mockReturnValueOnce(['resolved']);

    const response = await PATCH(makeRequest({ targetStatus: 'settled' }), { params: Promise.resolve({ caseId: 'case_1' }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: 'TRANSITION_DENIED',
      nextAllowedStatuses: expect.any(Array),
    });
  });

  it('returns success payload when transition is applied', async () => {
    const { PATCH } = await loadRoute();
    m.state.claimRows = [{
      claimId: 'case_1',
      status: 'submitted',
      priority: 'medium',
      organizationId: 'org_1',
      assignedTo: 'agent_1',
    }];

    const response = await PATCH(makeRequest({ targetStatus: 'settled', reason: 'Resolved in mediation' }), {
      params: Promise.resolve({ caseId: 'case_1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ success: true, claimId: 'case_1', toStatus: 'settled' });
    expect(m.auditDataMutation).toHaveBeenCalled();
  });

  it('returns 500 when transition pipeline throws unexpectedly', async () => {
    const { PATCH } = await loadRoute();
    m.withRLSContext.mockRejectedValueOnce(new Error('db unavailable'));

    const response = await PATCH(makeRequest({ targetStatus: 'settled' }), { params: Promise.resolve({ caseId: 'case_1' }) });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: 'INTERNAL_ERROR' });
  });
});
