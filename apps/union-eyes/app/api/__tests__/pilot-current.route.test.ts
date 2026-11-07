import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  direct: new Map<string, string>(),
  withSystemContext: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/lib/organizations/read-authority', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/organizations/read-authority')>()),
  resolveOrganizationAccess: async () => ({ direct: m.direct, affiliated: new Set() }),
}));
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
    m.withOrganizationAuth.mockImplementation((fn: any) => async (_req: NextRequest, context: any = { organizationId: 'org_1', userId: 'u1' }) => fn(_req, context));
    m.direct = new Map([['org_1', 'officer']]);
    m.withSystemContext.mockImplementation(async (fn: any) => fn());
  });

  it('returns 403 when lacks role', async () => {
    const { GET } = await loadRoute();
    m.direct = new Map([['org_1', 'steward']]);
    const response = await GET(new NextRequest('http://localhost/api/pilot/current'));
    expect(response.status).toBe(403);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  // Issue #1116: the officer role must be held in the exact organization whose figures are read.
  it.each([
    ['an officer of a different organization', new Map([['org_other', 'president']])],
    ['an administrator of a different organization only', new Map([['org_parent', 'admin']])],
    ['no membership at all', new Map<string, string>()],
  ])('refuses %s and reads nothing', async (_label, direct) => {
    const { GET } = await loadRoute();
    m.direct = direct;
    const response = await GET(new NextRequest('http://localhost/api/pilot/current'));
    expect(response.status).toBe(403);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('refuses a context without a user, reading nothing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/pilot/current'), { organizationId: 'org_1' } as never);
    expect(response.status).toBe(403);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('serves a direct officer of the organization it reads', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/pilot/current'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ metrics: null });
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
  });
});
