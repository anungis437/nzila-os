import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  validateIntakeRequest: vi.fn(),
  getCaseTypeById: vi.fn(),
  withRLSContext: vi.fn(),
  createClaim: vi.fn(),
  getClaimsByMember: vi.fn(),
  persistAtomicAudit: vi.fn(),
  requireEntitlement: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  enforceDecision: vi.fn(),
  createNarProofAdapter: vi.fn(),
  canonical: vi.fn(),
  canonicalProof: { createProof: vi.fn() },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  eventEmit: vi.fn(),
  requireCaseFilingCapacity: vi.fn(),
  selectClaimRows: [] as unknown[][],
}));

vi.mock('@/lib/cases/case-authorization', async (original) => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  requireCaseFilingCapacity: m.requireCaseFilingCapacity,
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: m.canonical }));
vi.mock('@/lib/audit/canonical-nar-proof', () => ({
  canonicalNarProofAdapter: m.canonicalProof,
  createCanonicalNarProofAdapter: () => m.canonicalProof,
}));
vi.mock('@nzila/cupe-vocabulary', () => ({
  validateIntakeRequest: m.validateIntakeRequest,
  getCaseTypeById: m.getCaseTypeById,
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db/queries/claims-queries', () => ({
  createClaim: m.createClaim,
  getClaimsByMember: m.getClaimsByMember,
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/events', () => ({
  AppEvents: { CLAIM_CREATED: 'claim.created' },
  eventBus: { emit: m.eventEmit },
}));
vi.mock('@/lib/events/pilot-event-listeners', () => ({}));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@nzila/decision-core', () => ({ enforceDecision: m.enforceDecision }));
vi.mock('@nzila/nar', () => ({
  createNarProofAdapter: m.createNarProofAdapter,
  getNarSigningSecret: vi.fn(),
}));
vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
  },
}));
vi.mock('@nzila/db/schema', () => ({ auditRecords: { narHash: 'narHash', organizationId: 'organizationId', createdAt: 'createdAt' } }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../cases/intake/route');
}

describe('cases/intake route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.canonical.mockReturnValue(false);
    m.selectClaimRows.length = 0;
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.requireCaseFilingCapacity.mockResolvedValue(undefined);
    m.getCaseTypeById.mockReturnValue({ defaultSeverity: 'moderate' });
    m.validateIntakeRequest.mockReturnValue({
      success: true,
      data: {
        memberId: 'user_1',
        caseType: 'discipline',
        incidentDate: '2026-01-01',
        title: 'Discipline concern title',
        priority: 'medium',
        description: 'Detailed description',
        location: 'site',
        desiredOutcome: 'outcome',
        isAnonymous: false,
        witnesses: null,
      },
    });
    m.enforceDecision.mockResolvedValue({ allowed: true, decision: { id: 'decision_1' } });
    m.createClaim.mockResolvedValue({ claimId: 'claim_1', claimNumber: 'CLM-1' });
    m.getClaimsByMember.mockResolvedValue([{ claimId: 'claim_1' }]);
    m.persistAtomicAudit.mockResolvedValue(undefined);

    m.withRLSContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => (m.selectClaimRows.shift() ?? []) as unknown[]),
            })),
          })),
        })),
      };
      return fn(tx);
    });
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await POST(new Request('http://localhost/api/cases/intake', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad-json',
    }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when vocabulary validation fails', async () => {
    const { POST } = await loadRoute();
    m.validateIntakeRequest.mockReturnValueOnce({ success: false, errors: ['invalid'] });

    const response = await POST(new Request('http://localhost/api/cases/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ any: 'thing' }),
    }));
    expect(response.status).toBe(400);
  });

  it('returns duplicate response when idempotency match exists', async () => {
    const { POST } = await loadRoute();
    m.selectClaimRows.push([{ claimId: 'claim_dup', claimNumber: 'CLM-DUP' }]);

    const response = await POST(new Request('http://localhost/api/cases/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ any: 'thing' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('duplicate');
  });

  it('returns 403 when entitlement check fails', async () => {
    const { POST } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('Entitlement denied'));

    const response = await POST(new Request('http://localhost/api/cases/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ any: 'thing' }),
    }));

    expect([400, 403, 500]).toContain(response.status);
  });

  it('returns 422 when preflight decision denies intake', async () => {
    const { POST } = await loadRoute();
    m.selectClaimRows.push([]);
    m.enforceDecision.mockResolvedValueOnce({ allowed: false, decision: { id: 'denied' } });

    const response = await POST(new Request('http://localhost/api/cases/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ any: 'thing' }),
    }));
    expect(response.status).toBe(422);
  });

  it('creates intake successfully and returns submitted status', async () => {
    const { POST } = await loadRoute();
    m.selectClaimRows.push([]);

    const response = await POST(new Request('http://localhost/api/cases/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ any: 'thing' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ success: true, status: 'submitted', claimId: 'claim_1' });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'case.intake_submitted',
      resourceType: 'claims',
      resourceId: 'claim_1',
      organizationId: 'org_1',
      userId: 'user_1',
    }));
  });

  it('normalizes only the verified native Entra actor to its platform id before every write and proof', async () => {
    m.canonical.mockReturnValue(true);
    m.auth.mockResolvedValue({ userId: 'platform-uuid', identityProvider: 'entra', providerSubject: 'tenant:member_1' });
    // The client sends its verified Entra object id rather than the platform id.
    m.validateIntakeRequest().data.memberId = 'member_1';
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/intake', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(201);
    expect(m.createClaim).toHaveBeenCalledWith(expect.objectContaining({ memberId: 'platform-uuid' }), expect.anything());
    for (const [decision] of m.enforceDecision.mock.calls) {
      expect(decision.input.memberId).toBe('platform-uuid');
      expect(decision.actor.id).toBe('platform-uuid');
      expect(decision.proofAdapter).toBe(m.canonicalProof);
    }
    expect(m.getClaimsByMember).toHaveBeenCalledWith('platform-uuid', 'org_1');
  });

  it.each([
    { userId: 'foreign-platform-id', identityProvider: 'entra', providerSubject: 'tenant:different-oid' },
    { userId: 'foreign-platform-id', identityProvider: 'nzila-password', providerSubject: 'tenant:member_1' },
  ])('rejects another member before duplicate lookup, proof or mutation: $identityProvider', async (actor) => {
    m.canonical.mockReturnValue(true);
    m.auth.mockResolvedValue(actor);
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/intake', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(403);
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.enforceDecision).not.toHaveBeenCalled();
    expect(m.createClaim).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('accepts the platform self id and fails closed when canonical proof persistence fails', async () => {
    m.canonical.mockReturnValue(true);
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.enforceDecision.mockRejectedValueOnce(new Error('audit unavailable'));
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/intake', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(500);
    expect(m.createClaim).not.toHaveBeenCalled();
  });

  it('rejects a caller-supplied member id in every deployment mode, not only canonical', async () => {
    m.canonical.mockReturnValue(false);
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.validateIntakeRequest().data.memberId = 'someone-else';
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/intake', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('MEMBER_IDENTITY_MISMATCH');
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.enforceDecision).not.toHaveBeenCalled();
    expect(m.createClaim).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('files nothing when the canonical membership is refused member filing capacity', async () => {
    const { ApiError } = await import('@/lib/api/errors');
    m.selectClaimRows.push([]);
    m.requireCaseFilingCapacity.mockRejectedValueOnce(ApiError.forbidden());
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/intake', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('FORBIDDEN');
    expect(m.requireCaseFilingCapacity).toHaveBeenCalledWith(expect.anything(), { userId: 'user_1', organizationId: 'org_1' }, 'member');
    expect(m.createClaim).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.eventEmit).not.toHaveBeenCalled();
  });

  it('does not report a submitted intake when the claim audit write fails', async () => {
    const { POST } = await loadRoute();
    m.selectClaimRows.push([]);
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit failed'));

    const response = await POST(new Request('http://localhost/api/cases/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ any: 'thing' }),
    }));

    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('INTERNAL_ERROR');
    expect(m.eventEmit).not.toHaveBeenCalled();
  });
});
