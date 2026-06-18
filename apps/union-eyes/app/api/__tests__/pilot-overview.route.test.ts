import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  requireUser: vi.fn(),
  hasMinRole: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  withSystemContext: vi.fn(),
  logger: { error: vi.fn() },
  selectQueue: [] as unknown[][],
  executeQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(async () => rows),
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
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: m.getOrganizationIdForUser,
  DEFAULT_ORGANIZATION_ID: 'platform_org',
}));
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
    m.getOrganizationIdForUser.mockResolvedValue('platform_org');
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  });

  it('GET returns 403 when role check fails', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET();
    expect(response.status).toBe(403);
  });

  it('GET returns 403 when non-platform org requests overview', async () => {
    const { GET } = await loadRoute();
    m.getOrganizationIdForUser.mockResolvedValueOnce('local_org');
    process.env.PLATFORM_ADMIN_USER_IDS = 'someone_else';

    const response = await GET();
    expect(response.status).toBe(403);
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
    expect(response.status).toBe(200);
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
