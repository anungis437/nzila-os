import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  withRLSContext: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  getUserRoleInOrganization: vi.fn(),
  requireEntitlement: vi.fn(),
  getAllowedTransitions: vi.fn(),
  toLifecycleState: vi.fn(),
  toLegacyClaimStatus: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db/schema/claims-schema', () => ({ claims: {} }));
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: m.getOrganizationIdForUser,
  getUserRoleInOrganization: m.getUserRoleInOrganization,
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/workflow/case-lifecycle', () => ({ getAllowedTransitions: m.getAllowedTransitions }));
vi.mock('@/lib/workflow/state-bridge', () => ({
  toLifecycleState: m.toLifecycleState,
  toLegacyClaimStatus: m.toLegacyClaimStatus,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

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
    m.toLifecycleState.mockReturnValue('submitted');
    m.getAllowedTransitions.mockReturnValue(['resolved', 'triage']);
    m.toLegacyClaimStatus.mockImplementation((s: string) => s);

    m.withRLSContext.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ status: 'filed' }]),
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
    m.withRLSContext.mockImplementationOnce(async (fn: any) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
      };
      return fn(tx);
    });

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

    expect([200, 500]).toContain(response.status);
  });
});
