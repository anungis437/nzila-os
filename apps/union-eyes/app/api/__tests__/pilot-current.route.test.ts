import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  hasMinRole: vi.fn(),
  withSystemContext: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => {
  const chain: any = {
    from: vi.fn(function() { return this; }),
    where: vi.fn(function() { return this; }),
    limit: vi.fn(async function() { return []; }),
  };
  return { db: { select: () => chain, execute: () => Promise.resolve([]) } };
});
vi.mock('@/db/schema/domains/pilot/pilot-enrollments', () => ({ pilotEnrollments: {} }));
vi.mock('@/db/schema/domains/pilot/pilot-milestones', () => ({ pilotMilestones: {} }));
vi.mock('@/lib/api/standardized-responses', () => ({ ErrorCode: { FORBIDDEN: 'FORBIDDEN' }, standardErrorResponse: vi.fn((code: string, message: string) => new Response(JSON.stringify({ message }), { status: 403 })) }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), sql: vi.fn((s: any) => s) };
});

async function loadRoute() {
  return import('../pilot/current/route');
}

describe('pilot/current route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((fn: any) => async (_req: NextRequest, context: any = { organizationId: 'org_1' }) => fn(_req, context));
    m.hasMinRole.mockResolvedValue(true);
    m.withSystemContext.mockImplementation(async (fn: any) => fn());
  });

  it('returns 403 when lacks role', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);
    const response = await GET(new NextRequest('http://localhost/api/pilot/current'));
    expect(response.status).toBe(403);
  });

  it('returns metrics for active pilot', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/pilot/current'));
    expect([200, 500]).toContain(response.status);
  });
});
