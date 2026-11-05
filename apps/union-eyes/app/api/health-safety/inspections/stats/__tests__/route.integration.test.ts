import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * GET /api/health-safety/inspections/stats: a figure the data cannot give (no inspection scored) is null, not 0, so a screen can say
 * "unknown" instead of showing a 0% compliance rate that was never measured.
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

beforeEach(() => {
  vi.clearAllMocks();
  m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0, limit: 1000 });
  m.getUserRole.mockResolvedValue(null);
  m.getCurrentUser.mockResolvedValue({
    id: 'user-1',
    email: null,
    name: null,
    firstName: null,
    lastName: null,
    imageUrl: null,
    legacyTenantId: null,
    role: 'member',
    organizationId: ORG_A,
    metadata: {},
  });
  m.getOrganizationIdForUser.mockResolvedValue(ORG_A);
});

async function statsFor(row: Record<string, unknown>) {
  m.dbExecute.mockResolvedValue([row]);
  const { GET } = await import('../route');
  const res = await GET(new NextRequest('http://localhost/api/health-safety/inspections/stats'));
  expect(res.status).toBe(200);
  return (await res.json()).data as Record<string, unknown>;
}

describe('health-safety inspections/stats', () => {
  it('reports the compliance rate and average score as null when nothing was scored, never as 0', async () => {
    const data = await statsFor({ total: 4, scheduled: 3, completed: 1, overdue: 0, compliance_rate: null, avg_score: null });
    expect(data).toMatchObject({ total: 4, scheduled: 3, completed: 1, overdue: 0, complianceRate: null, avgScore: null });
  });

  it('reports a score that really is 0 as 0, and rounds to one decimal', async () => {
    const data = await statsFor({ total: 1, scheduled: 0, completed: 1, overdue: 0, compliance_rate: '0', avg_score: '0' });
    expect(data).toMatchObject({ complianceRate: 0, avgScore: 0 });
    const rounded = await statsFor({ total: 2, scheduled: 0, completed: 2, overdue: 0, compliance_rate: '87.456', avg_score: '91.04' });
    expect(rounded).toMatchObject({ complianceRate: 87.5, avgScore: 91 });
  });
});
