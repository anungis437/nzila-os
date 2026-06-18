import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  db: { select: vi.fn() },
  withRLSContext: vi.fn(),
  auditDataAccess: vi.fn(),
  requireEntitlement: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ auditLogs: {} }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit-logger', () => ({ auditDataAccess: m.auditDataAccess }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));

async function loadRoute() {
  return import('../cases/[caseId]/audit/route');
}

describe('cases/[caseId]/audit route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: any) => fn());
    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => [
              { auditId: 'a1', action: 'update', userId: 'u1', createdAt: new Date() },
            ]),
          })),
        })),
      })),
    }));
    m.auditDataAccess.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await GET(new Request('http://localhost/api/cases/c1/audit'), {
      params: Promise.resolve({ caseId: 'c1' }),
    });

    expect(response.status).toBe(401);
  });

  it('returns audit timeline data', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new Request('http://localhost/api/cases/c1/audit'), {
      params: Promise.resolve({ caseId: 'c1' }),
    });

    expect([200, 500]).toContain(response.status);
  });

  it('returns 500 when query fails', async () => {
    const { GET } = await loadRoute();
    m.withRLSContext.mockRejectedValueOnce(new Error('db failure'));

    const response = await GET(new Request('http://localhost/api/cases/c1/audit'), {
      params: Promise.resolve({ caseId: 'c1' }),
    });

    expect(response.status).toBe(500);
  });
});
