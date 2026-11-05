import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  requireApiAuth: vi.fn(),
  getCaseActor: vi.fn(),
  caseReadScope: vi.fn(() => 'CASE_READ_SCOPE'),
  findReadableCase: vi.fn(),
  updateClaimStatus: vi.fn(),
  getAllowedTransitions: vi.fn(),
  toLifecycleState: vi.fn(),
  toLegacyClaimStatus: vi.fn(),
  withRLSContext: vi.fn(),
  wrapSchemaQuery: vi.fn(),
  transitionSchemaSafeParse: vi.fn(),
  eventEmit: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  recordUnionEyesCaseAcknowledged: vi.fn(),
  recordUnionEyesCaseResolved: vi.fn(),
  recordUnionEyesWorkflowTransition: vi.fn(),
  recordUnionEyesWorkflowTransitionFailure: vi.fn(),
  state: {
    claimRows: [] as unknown[],
    countRows: [{ value: 1 }] as unknown[],
  },
}));

vi.mock('@/lib/api-auth-guard', () => ({ requireApiAuth: m.requireApiAuth }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  AuditEventType: { AUTH_FAILED: 'AUTH_FAILED' },
  AuditSeverity: { HIGH: 'HIGH' },
}));
vi.mock('@/lib/cases/case-authorization', async (original) => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  getCaseActor: m.getCaseActor,
  caseReadScope: m.caseReadScope,
  findReadableCase: m.findReadableCase,
}));
vi.mock('@/lib/workflow-engine', () => ({ updateClaimStatus: m.updateClaimStatus }));
vi.mock('@/lib/workflow/case-lifecycle', () => ({ getAllowedTransitions: m.getAllowedTransitions }));
vi.mock('@/lib/workflow/state-bridge', () => ({
  toLifecycleState: m.toLifecycleState,
  toLegacyClaimStatus: m.toLegacyClaimStatus,
}));
vi.mock('@/lib/schema-error', () => ({ wrapSchemaQuery: m.wrapSchemaQuery }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/events', () => ({
  AppEvents: { CLAIM_UPDATED: 'claim.updated' },
  eventBus: { emit: m.eventEmit },
}));
vi.mock('@/lib/events/pilot-event-listeners', () => ({}));
vi.mock('@/lib/pilot-metrics', () => ({
  recordUnionEyesCaseAcknowledged: m.recordUnionEyesCaseAcknowledged,
  recordUnionEyesCaseResolved: m.recordUnionEyesCaseResolved,
  recordUnionEyesWorkflowTransition: m.recordUnionEyesWorkflowTransition,
  recordUnionEyesWorkflowTransitionFailure: m.recordUnionEyesWorkflowTransitionFailure,
}));
vi.mock('../workflow/transition/schemas', () => ({
  transitionSchema: {
    safeParse: m.transitionSchemaSafeParse,
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
}));

function makeTx(claimRows: unknown[], countRows: unknown[]) {
  let selectCallCount = 0;

  const claimChain = {
    from: vi.fn(() => claimChain),
    where: vi.fn(() => claimChain),
    limit: vi.fn(() => claimChain),
    for: vi.fn(async () => claimRows),
  };

  const countChain = {
    from: vi.fn(() => countChain),
    where: vi.fn(async () => countRows),
  };

  return {
    select: vi.fn(() => {
      selectCallCount += 1;
      return selectCallCount === 1 ? claimChain : countChain;
    }),
  };
}

async function loadRoute() {
  return import('../workflow/transition/route');
}

describe('workflow/transition route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireApiAuth.mockResolvedValue({ userId: 'user_1', organizationId: 'org_1' });
    m.getCaseActor.mockResolvedValue({ userId: 'user_1', organizationId: 'org_1', role: 'steward' });
    m.findReadableCase.mockResolvedValue({ claimId: 'claim_1', visibility: 'internal' });
    m.transitionSchemaSafeParse.mockReturnValue({
      success: true,
      data: { claimNumber: 'CLM-1', targetStatus: 'resolved', notes: 'done' },
    });
    m.getAllowedTransitions.mockReturnValue(['resolved']);
    m.toLifecycleState.mockReturnValue('submitted');
    m.toLegacyClaimStatus.mockImplementation((s: string) => s);
    m.updateClaimStatus.mockResolvedValue({ success: true, claim: { id: 'claim_1', status: 'resolved' } });
    m.wrapSchemaQuery.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.withRLSContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = makeTx(m.state.claimRows, m.state.countRows);
      return fn(tx);
    });
    m.state.claimRows = [{
      claimId: 'claim_1',
      claimNumber: 'CLM-1',
      status: 'submitted',
      organizationId: 'org_1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    }];
    m.state.countRows = [{ value: 1 }];
    m.recordUnionEyesCaseAcknowledged.mockResolvedValue(undefined);
    m.recordUnionEyesCaseResolved.mockResolvedValue(undefined);
    m.recordUnionEyesWorkflowTransition.mockResolvedValue(undefined);
    m.recordUnionEyesWorkflowTransitionFailure.mockResolvedValue(undefined);
  });

  it('returns 401 when auth middleware rejects', async () => {
    const { POST } = await loadRoute();
    m.requireApiAuth.mockRejectedValueOnce(new Error('Unauthorized: no token'));

    const response = await POST(new NextRequest('http://localhost/api/workflow/transition', { method: 'POST', body: '{}' }));

    expect(response.status).toBe(401);
  });

  it('returns 400 when request payload fails schema validation', async () => {
    const { POST } = await loadRoute();
    m.transitionSchemaSafeParse.mockReturnValueOnce({
      success: false,
      error: { issues: [{ path: ['targetStatus'], message: 'Required' }] },
    });

    const response = await POST(new NextRequest('http://localhost/api/workflow/transition', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claimNumber: 'CLM-1' }),
    }));

    expect(response.status).toBe(400);
  });

  it('returns 404 when claim is missing', async () => {
    const { POST } = await loadRoute();
    m.state.claimRows = [];

    const response = await POST(new NextRequest('http://localhost/api/workflow/transition', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claimNumber: 'CLM-404', targetStatus: 'resolved' }),
    }));

    expect(response.status).toBe(404);
  });

  it('returns 422 when target transition is not allowed', async () => {
    const { POST } = await loadRoute();
    m.getAllowedTransitions.mockReturnValueOnce(['triage']);
    m.transitionSchemaSafeParse.mockReturnValueOnce({
      success: true,
      data: { claimNumber: 'CLM-1', targetStatus: 'resolved' },
    });

    const response = await POST(new NextRequest('http://localhost/api/workflow/transition', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claimNumber: 'CLM-1', targetStatus: 'resolved' }),
    }));

    expect(response.status).toBe(422);
    expect(m.recordUnionEyesWorkflowTransitionFailure).toHaveBeenCalled();
  });

  it('returns success and emits workflow events when transition succeeds', async () => {
    const { POST } = await loadRoute();
    m.transitionSchemaSafeParse.mockReturnValueOnce({
      success: true,
      data: { claimNumber: 'CLM-1', targetStatus: 'resolved', notes: 'ok' },
    });

    const response = await POST(new NextRequest('http://localhost/api/workflow/transition', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trace-id': 'trace_1' },
      body: JSON.stringify({ claimNumber: 'CLM-1', targetStatus: 'resolved', notes: 'ok' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(m.eventEmit).toHaveBeenCalled();
    expect(m.recordUnionEyesWorkflowTransition).toHaveBeenCalled();
  });

  it('returns 404 when the caller cannot even read the case', async () => {
    const { POST } = await loadRoute();
    m.findReadableCase.mockResolvedValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/workflow/transition', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claimNumber: 'CLM-1', targetStatus: 'resolved' }),
    }));

    expect(response.status).toBe(404);
    expect(m.updateClaimStatus).not.toHaveBeenCalled();
  });

  it('returns 403 on the kernel decision for a caller without transition authority, before any lock or write', async () => {
    const { POST } = await loadRoute();
    const { ApiError } = await import('@/lib/api/errors');
    m.findReadableCase.mockRejectedValueOnce(ApiError.forbidden('This action is not permitted for this case.'));

    const response = await POST(new NextRequest('http://localhost/api/workflow/transition', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claimNumber: 'CLM-1', targetStatus: 'resolved' }),
    }));

    expect(response.status).toBe(403);
    expect(m.findReadableCase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'user_1' }), 'CLM-1', true, 'case:transition');
    expect(m.updateClaimStatus).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller may transition but the kernel denies closing the case', async () => {
    const { POST } = await loadRoute();
    const { ApiError } = await import('@/lib/api/errors');
    m.findReadableCase.mockImplementation(async (_tx: unknown, _actor: unknown, _ref: string, _lock: boolean, action: string) => {
      if (action === 'case:close') throw ApiError.forbidden('This action is not permitted for this case.');
      return { claimId: 'claim_1', visibility: 'internal' };
    });

    const response = await POST(new NextRequest('http://localhost/api/workflow/transition', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claimNumber: 'CLM-1', targetStatus: 'resolved' }),
    }));

    expect(response.status).toBe(403);
    expect(m.findReadableCase).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'CLM-1', true, 'case:close');
    expect(m.updateClaimStatus).not.toHaveBeenCalled();
  });

  it('decides with the actor organization, never the auth guard organization, before locking the case', async () => {
    const { POST } = await loadRoute();
    // Even when the auth guard reports no organization, the actor organization governs the decision.
    m.requireApiAuth.mockResolvedValueOnce({ userId: 'user_1', organizationId: undefined });

    await POST(new NextRequest('http://localhost/api/workflow/transition', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claimNumber: 'CLM-1', targetStatus: 'resolved' }),
    }));

    expect(m.findReadableCase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'user_1', organizationId: 'org_1' }), 'CLM-1', true, 'case:transition');
  });

  it('returns 500 when unexpected errors occur', async () => {
    const { POST } = await loadRoute();
    m.withRLSContext.mockRejectedValueOnce(new Error('boom'));

    const response = await POST(new NextRequest('http://localhost/api/workflow/transition', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claimNumber: 'CLM-1', targetStatus: 'resolved' }),
    }));

    expect(response.status).toBe(500);
  });
});
