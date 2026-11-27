import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  withRLSContext: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  getUserRoleInOrganization: vi.fn(),
  requireEntitlement: vi.fn(),
  capabilities: vi.fn(),
  stored: {} as Record<string, unknown>,
  logger: { error: vi.fn() },
  findReadableCase: vi.fn(),
}));

vi.mock('@/lib/cases/case-authorization', async (original) => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  findReadableCase: m.findReadableCase,
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: m.getOrganizationIdForUser,
  getUserRoleInOrganization: m.getUserRoleInOrganization,
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/authority/store/route-adapter', () => ({ decideCaseCapabilitiesBatch: m.capabilities }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/audit-logger', () => ({ auditLog: vi.fn(), AuditEventType: { AUTH_FAILED: 'AUTH_FAILED' }, AuditSeverity: { HIGH: 'HIGH' } }));

async function loadRoute() {
  return import('../cases/[caseId]/next-actions/route');
}

describe('cases/[caseId]/next-actions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.getUserRoleInOrganization.mockResolvedValue('steward');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.stored = { claimId: 'c1', status: 'submitted', assignedTo: 'u1', priority: 'medium',
      description: 'Synthetic recorded case narrative.', createdAt: new Date(Date.now()-12*86400000),
      updatedAt: new Date(), statusChangedAt: new Date(Date.now()-9*86400000) };
    m.findReadableCase.mockImplementation(async () => ({ ...m.stored, visibility: 'internal' }));
    m.capabilities.mockResolvedValue(new Map([['c1', {
      'case:transition': { effect: 'allow' }, 'case:close': { effect: 'deny' },
    }]]));

    m.withRLSContext.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [m.stored]),
            })),
          })),
        })),
      };
      return fn(tx);
    });
  });

  it('returns 401 when unauthenticated', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await GET(new Request('http://localhost/api/cases/c1/next-actions'), {
      params: Promise.resolve({ caseId: 'c1' }),
    });

    expect(response.status).toBe(401);
  });

  it('returns 404 when case is missing', async () => {
    const { GET } = await loadRoute();
    m.findReadableCase.mockResolvedValueOnce(null);

    const response = await GET(new Request('http://localhost/api/cases/missing/next-actions'), {
      params: Promise.resolve({ caseId: 'missing' }),
    });

    expect(response.status).toBe(404);
  });

  it('returns allowed transitions', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new Request('http://localhost/api/cases/c1/next-actions'), {
      params: Promise.resolve({ caseId: 'c1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ caseId: 'c1', currentStatus: 'submitted', allowedTransitions: ['under_review'] });
  });
  it('returns no mutation choices when a readable case has no live transition power', async () => {
    m.getUserRoleInOrganization.mockResolvedValue('admin');
    m.capabilities.mockResolvedValue(new Map([['c1', {
      'case:transition': { effect: 'deny' }, 'case:close': { effect: 'deny' },
    }]]));
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/cases/c1/next-actions'), { params: Promise.resolve({caseId:'c1'}) });
    expect(response.status).toBe(200); expect((await response.json()).allowedTransitions).toEqual([]);
  });

  it('offers investigation from pending documentation without advertising another investigation as negotiation', async () => {
    m.stored.status = 'pending_documentation';
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/cases/c1/next-actions'), {params:Promise.resolve({caseId:'c1'})});
    expect((await response.json()).allowedTransitions).toEqual(['under_review', 'investigation', 'resolved']);
  });

  it('omits an immature transition even if the role and kernel powers permit it', async () => {
    m.stored.status = 'investigation'; m.stored.statusChangedAt = new Date();
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/cases/c1/next-actions'), {params:Promise.resolve({caseId:'c1'})});
    expect((await response.json()).allowedTransitions).toEqual([]);
  });

  it('offers documented, matured closure only with its separate live close power', async () => {
    m.getUserRoleInOrganization.mockResolvedValue('admin'); m.stored.status='resolved';
    const { GET } = await loadRoute();
    const get = () => GET(new Request('http://localhost/api/cases/c1/next-actions'), {params:Promise.resolve({caseId:'c1'})});
    expect((await (await get()).json()).allowedTransitions).toEqual([]);
    m.capabilities.mockResolvedValue(new Map([['c1', {'case:transition':{effect:'allow'},'case:close':{effect:'allow'}}]]));
    expect((await (await get()).json()).allowedTransitions).toEqual(['closed']);
  });

});
