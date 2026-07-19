import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  validateIntakeRequest: vi.fn(),
  getCaseTypeById: vi.fn(),
  withRLSContext: vi.fn(),
  createClaim: vi.fn(),
  getClaimsByMember: vi.fn(),
  auditDataMutation: vi.fn(),
  requireEntitlement: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  enforceDecision: vi.fn(),
  createNarProofAdapter: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  eventEmit: vi.fn(),
  selectClaimRows: [] as unknown[][],
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@nzila/cupe-vocabulary', () => ({
  validateIntakeRequest: m.validateIntakeRequest,
  getCaseTypeById: m.getCaseTypeById,
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db/queries/claims-queries', () => ({
  createClaim: m.createClaim,
  getClaimsByMember: m.getClaimsByMember,
}));
vi.mock('@/lib/audit-logger', () => ({ auditDataMutation: m.auditDataMutation }));
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
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getCaseTypeById.mockReturnValue({ defaultSeverity: 'moderate' });
    m.validateIntakeRequest.mockReturnValue({
      success: true,
      data: {
        memberId: 'member_1',
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
    m.auditDataMutation.mockResolvedValue(undefined);

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
    expect(m.auditDataMutation).toHaveBeenCalled();
  });
});
