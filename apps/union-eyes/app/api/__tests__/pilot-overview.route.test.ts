import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  requireUser: vi.fn(),
  hasMinRole: vi.fn(),
  resolveOrganizationAccess: vi.fn(),
  withSystemContext: vi.fn(),
  logger: { error: vi.fn() },
  selectQueue: [] as unknown[][],
  executeQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  execute: vi.fn(async () => (m.executeQueue.shift() ?? []) as unknown[]),
};

vi.mock('@/lib/api-auth-guard', () => ({
  requireUser: m.requireUser,
  hasMinRole: m.hasMinRole,
}));
vi.mock('@/lib/organizations/read-authority', () => ({
  resolveOrganizationAccess: m.resolveOrganizationAccess,
  isAdministrativeRole: (role?: string) => role === 'admin',
}));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { FORBIDDEN: 'FORBIDDEN', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ code, message }), { status: code === 'FORBIDDEN' ? 403 : 500 }),
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../pilot/overview/route');
}

describe('pilot/overview route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.executeQueue = [];
    m.requireUser.mockResolvedValue({ userId: 'u1' });
    m.hasMinRole.mockResolvedValue(true);
    m.resolveOrganizationAccess.mockResolvedValue({ platform: false, direct: new Map([['org_1', 'admin']]), descendants: new Set() });
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  });
  afterEach(() => vi.unstubAllEnvs());

  it('denies a platform administrator title without a direct active union mandate', async () => {
    const { GET } = await loadRoute();
    m.resolveOrganizationAccess.mockResolvedValueOnce({
      platform: true, direct: new Map(), descendants: new Set(),
    });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('permits a direct administrator of a pilot organization, regardless of platform title', async () => {
    const { GET } = await loadRoute();
    const response = await GET();
    expect(response.status, JSON.stringify(m.logger.error.mock.calls)).toBe(200);
    expect(m.resolveOrganizationAccess).toHaveBeenCalledWith('u1');
    expect(m.withSystemContext).toHaveBeenCalledOnce();
  });

  it('denies ordinary officers and federation-only administrators from cross-tenant details', async () => {
    const { GET } = await loadRoute();
    for (const access of [
      { platform: false, direct: new Map([['org_1', 'officer']]), descendants: new Set() },
      { platform: false, direct: new Map([['federation', 'admin']]), descendants: new Set(['org_1']) },
    ]) {
      m.resolveOrganizationAccess.mockResolvedValueOnce(access);
      const response = await GET();
      if (access.direct.has('org_1')) expect(response.status).toBe(403);
      else expect((await response.json()).organizations).toHaveLength(0);
    }
  });

  it('GET returns 403 when role check fails', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET();
    expect(response.status).toBe(403);
  });

  it('returns no data when an unrelated organization is not in the authenticated grant set', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{
      enrollment: { id: 'foreign', organizationId: 'other-org', status: 'active' },
      orgName: 'Other Org', orgSlug: 'other',
    }]);
    const response = await GET();
    expect(response.status, JSON.stringify(m.logger.error.mock.calls)).toBe(200);
    expect((await response.json()).organizations).toHaveLength(0);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it('GET returns organizations metrics for active enrollments', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [
        {
          enrollment: {
            id: 'enr_1',
            pilotId: 'pilot_1',
            organizationId: 'org_1',
            enrolledAt: new Date('2026-01-01T00:00:00.000Z'),
            organizerAdoptionRate: 10,
            memberEngagementRate: 20,
            casesManaged: 5,
            avgTimeToResolution: 24,
            healthScore: 80,
          },
          orgName: 'Org 1',
          orgSlug: 'org-1',
        },
      ],
      [{ id: 'm1', name: 'Kickoff', description: 'desc', status: 'completed', targetDate: null, completedAt: null }],
    );
    m.executeQueue.push(
      [{ organizer_count: 4, active_organizer_count: 2, total_members: 20, active_members: 10 }],
      [{ cases_managed: 12, avg_resolution_hours: 48 }],
    );

    const response = await GET();
    expect(response.status, JSON.stringify(m.logger.error.mock.calls)).toBe(200);
    const json = await response.json();
    expect(json.organizations).toHaveLength(1);
    expect(json.organizations[0]).toMatchObject({
      organizationId: 'org_1',
      organizationName: 'Org 1',
      organizerAdoptionRate: 50,
      memberEngagementRate: 50,
      casesManaged: 12,
    });
  });

  it('GET returns 500 when query throws', async () => {
    const { GET } = await loadRoute();
    m.withSystemContext.mockRejectedValueOnce(new Error('db down'));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
