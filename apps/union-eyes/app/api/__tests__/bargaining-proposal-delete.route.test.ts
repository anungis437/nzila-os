import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * DELETE /api/bargaining/proposals/[id] through the REAL crud-factory + withApi stack. A bargaining proposal has a governed
 * lifecycle (withdrawn/superseded): generic deletion must be refused with 403 and must not touch the database at all, neither a
 * hard delete nor an invented 'archived' status. Only the external boundaries (session, DB-role fallback, rate limiting, the
 * Postgres client and the audit writer) are mocked, as in hazards-incidents-submission.integration.test.ts.
 */

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  platformAuth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  getUserRole: vi.fn(),
  checkRateLimit: vi.fn(),
  dbInsert: vi.fn(),
  dbSelect: vi.fn(),
  dbUpdate: vi.fn(),
  dbDelete: vi.fn(),
  dbExecute: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: m.platformAuth,
  currentUser: async () => null,
  getAuth: m.platformAuth,
  authMiddleware: () => async () => {},
  createRouteMatcher: () => () => false,
}));
vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return { ...actual, getCurrentUser: m.getCurrentUser };
});
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@/lib/auth/rbac-server', () => ({ getUserRole: m.getUserRole }));
vi.mock('@/lib/rate-limiter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limiter')>();
  return { ...actual, checkRateLimit: m.checkRateLimit };
});
vi.mock('@/db/db', () => {
  const client = { insert: m.dbInsert, select: m.dbSelect, update: m.dbUpdate, delete: m.dbDelete, execute: m.dbExecute };
  return { db: { ...client, transaction: async (fn: (tx: typeof client) => Promise<unknown>) => fn(client) } };
});
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));

const ORG_A = '11111111-1111-1111-1111-111111111111';
const PROPOSAL_ID = '33333333-3333-4333-8333-333333333333';

function authUser(role: string) {
  return {
    id: 'user-1', email: null, name: null, firstName: null, lastName: null, imageUrl: null,
    legacyTenantId: null, role, organizationId: ORG_A, metadata: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0, limit: 1000 });
  m.getUserRole.mockResolvedValue(null);
  m.getOrganizationIdForUser.mockResolvedValue(ORG_A);
  m.dbExecute.mockResolvedValue([]);
  m.platformAuth.mockImplementation(async () => {
    const user = await m.getCurrentUser();
    if (!user?.id) return { userId: null, orgId: null, sessionClaims: null, has: () => false };
    return { userId: user.id, orgId: user.organizationId ?? null, sessionClaims: null, has: () => false };
  });
});

describe('DELETE /api/bargaining/proposals/[id]', () => {
  for (const role of ['admin', 'steward']) {
    it(`answers 403 to ${role === 'admin' ? 'an administrator' : 'a steward'} and writes nothing`, async () => {
      const { DELETE } = await import('../bargaining/proposals/[id]/route');
      m.getCurrentUser.mockResolvedValue(authUser(role));

      const response = await DELETE(
        new NextRequest(`http://localhost/api/bargaining/proposals/${PROPOSAL_ID}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: PROPOSAL_ID }) },
      );

      expect(response.status).toBe(403);
      expect(m.dbDelete).not.toHaveBeenCalled();
      expect(m.dbUpdate).not.toHaveBeenCalled();
      expect(m.dbInsert).not.toHaveBeenCalled();
      expect(m.audit).not.toHaveBeenCalled();
    });
  }

  it('refuses the administrator because generic deletion is unavailable for a proposal, not merely for lack of role', async () => {
    const { DELETE } = await import('../bargaining/proposals/[id]/route');
    m.getCurrentUser.mockResolvedValue(authUser('admin'));

    const response = await DELETE(
      new NextRequest(`http://localhost/api/bargaining/proposals/${PROPOSAL_ID}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: PROPOSAL_ID }) },
    );

    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).toMatch(/Generic deletion is unavailable/);
  });
});
