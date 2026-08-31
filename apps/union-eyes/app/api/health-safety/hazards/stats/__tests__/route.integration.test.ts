import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Proves the org-scoping and error-handling contract shared verbatim across
 * all 5 new health-safety stats/findings routes (hazards/stats,
 * incidents/stats, inspections/findings, inspections/stats, stats), using
 * hazards/stats as the representative instance. Every route follows the
 * identical pattern: `organizationId` sourced only from the auth-resolved
 * withApi context (never a client-supplied query param), and a genuine DB
 * failure propagates as an error response rather than a fabricated
 * zero-valued 200.
 */

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  getUserRole: vi.fn(),
  checkRateLimit: vi.fn(),
  dbExecute: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return { ...actual, getCurrentUser: m.getCurrentUser };
});
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: m.getOrganizationIdForUser,
}));
vi.mock('@/lib/auth/rbac-server', () => ({ getUserRole: m.getUserRole }));
vi.mock('@/lib/rate-limiter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limiter')>();
  return { ...actual, checkRateLimit: m.checkRateLimit };
});
vi.mock('@/db/db', () => ({ db: { execute: m.dbExecute } }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (fn: () => Promise<unknown>) => fn(),
}));

const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';

function authUser(organizationId: string = ORG_A) {
  return {
    id: 'user-1',
    email: null,
    name: null,
    firstName: null,
    lastName: null,
    imageUrl: null,
    legacyTenantId: null,
    role: 'health_safety_rep',
    organizationId,
    metadata: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0, limit: 1000 });
  m.getUserRole.mockResolvedValue(null);
});

describe('health-safety hazards/stats — org scoping and failure handling', () => {
  it('9. scopes the query to the authenticated org, ignoring a client-supplied organizationId query param', async () => {
    m.getCurrentUser.mockResolvedValue(authUser(ORG_A));
    m.getOrganizationIdForUser.mockResolvedValue(ORG_A);
    m.dbExecute.mockResolvedValue([{ total: 3, open: 1, in_progress: 0, resolved: 2, critical: 0, avg_resolution_days: null }]);

    const { GET } = await import('../route');
    // Attacker/other-tenant org id supplied on the query string — must be ignored.
    const res = await GET(new NextRequest(`http://localhost/api/health-safety/hazards/stats?organizationId=${ORG_B}`));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.total).toBe(3);

    const executedSql = m.dbExecute.mock.calls[0][0];
    const sqlString = JSON.stringify(executedSql);
    expect(sqlString).not.toContain(ORG_B);
  });

  it('9b. two different authenticated orgs produce independently scoped queries', async () => {
    m.getCurrentUser.mockResolvedValueOnce(authUser(ORG_A));
    m.getOrganizationIdForUser.mockResolvedValueOnce(ORG_A);
    m.dbExecute.mockResolvedValueOnce([{ total: 5 }]);

    const { GET } = await import('../route');
    await GET(new NextRequest('http://localhost/api/health-safety/hazards/stats'));
    const firstCallSql = JSON.stringify(m.dbExecute.mock.calls[0][0]);

    m.getCurrentUser.mockResolvedValueOnce(authUser(ORG_B));
    m.getOrganizationIdForUser.mockResolvedValueOnce(ORG_B);
    m.dbExecute.mockResolvedValueOnce([{ total: 9 }]);

    await GET(new NextRequest('http://localhost/api/health-safety/hazards/stats'));
    const secondCallSql = JSON.stringify(m.dbExecute.mock.calls[1][0]);

    expect(firstCallSql).not.toEqual(secondCallSql);
  });

  it('10. a genuine query failure surfaces as an error response, not a fabricated zero-valued success', async () => {
    m.getCurrentUser.mockResolvedValue(authUser(ORG_A));
    m.getOrganizationIdForUser.mockResolvedValue(ORG_A);
    m.dbExecute.mockRejectedValue(new Error('connection terminated unexpectedly'));

    const { GET } = await import('../route');
    const res = await GET(new NextRequest('http://localhost/api/health-safety/hazards/stats'));
    const json = await res.json();

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(json.success).not.toBe(true);
    expect(json.total).toBeUndefined();
  });
});
