import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  requireUser: vi.fn(),
  hasMinRole: vi.fn(),
  isPlatformAdminUser: vi.fn(),
  performAtomicAuditedOperation: vi.fn(),
  operationAuditResponse: vi.fn(),
  logger: { error: vi.fn() },
  selectQueue: [] as unknown[][],
  executeQueue: [] as unknown[][],
  chainCalls: [] as Array<[string, unknown[]]>,
}));

// A query chain that records its calls and resolves, when awaited, to the next queued result.
function makeSelectChain() {
  const chain: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'then') {
          const rows = (m.selectQueue.shift() ?? []) as unknown[];
          return (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve);
        }
        return (...args: unknown[]) => {
          m.chainCalls.push([prop, args]);
          return chain;
        };
      },
    },
  );
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  execute: vi.fn(async () => (m.executeQueue.shift() ?? []) as unknown[]),
};

vi.mock('@/lib/api-auth-guard', () => ({
  requireUser: m.requireUser,
  hasMinRole: m.hasMinRole,
  isPlatformAdminUser: m.isPlatformAdminUser,
}));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAtomicAuditedOperation: m.performAtomicAuditedOperation,
  operationAuditResponse: m.operationAuditResponse,
}));
vi.mock('@/lib/organization-utils', () => ({ DEFAULT_ORGANIZATION_ID: 'platform_org' }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { FORBIDDEN: 'FORBIDDEN', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ code, message }), { status: code === 'FORBIDDEN' ? 403 : 500 }),
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../pilot/overview/route');
}

const enrollmentRow = (organizationId: string, name: string) => ({
  enrollment: {
    id: `enr_${organizationId}`,
    pilotId: 'pilot_1',
    organizationId,
    enrolledAt: new Date('2026-01-01T00:00:00.000Z'),
    organizerAdoptionRate: 10,
    memberEngagementRate: 20,
    casesManaged: 5,
    avgTimeToResolution: 24,
    healthScore: 80,
  },
  orgName: name,
  orgSlug: name.toLowerCase().replace(/\s+/g, '-'),
});

describe('pilot/overview route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.executeQueue = [];
    m.chainCalls = [];
    m.requireUser.mockResolvedValue({ userId: 'u1', organizationId: 'platform_org' });
    m.hasMinRole.mockResolvedValue(true);
    m.isPlatformAdminUser.mockResolvedValue(true);
    m.operationAuditResponse.mockReturnValue(null);
    m.performAtomicAuditedOperation.mockImplementation(async (_op: unknown, work: (tx: unknown) => Promise<unknown>) => work(mockDb));
  });

  it('GET returns 403 when role check fails', async () => {
    m.hasMinRole.mockResolvedValueOnce(false);
    const { GET } = await loadRoute();

    expect((await GET()).status).toBe(403);
    expect(m.performAtomicAuditedOperation).not.toHaveBeenCalled();
  });

  it('F06 A4: an officer of the platform organization without platform-administrator authority is denied, and nothing is read', async () => {
    m.isPlatformAdminUser.mockResolvedValueOnce(false);
    const { GET } = await loadRoute();

    const response = await GET();

    expect(response.status).toBe(403);
    expect(m.isPlatformAdminUser).toHaveBeenCalledWith('u1');
    expect(m.performAtomicAuditedOperation).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('GET returns organization metrics for the page of active enrollments, with one query per figure', async () => {
    m.selectQueue.push(
      [{ total: 1 }],
      [enrollmentRow('org_1', 'Org 1')],
      [{ organizationId: 'org_1', name: 'Kickoff', description: 'desc', status: 'completed', targetDate: null, completedAt: null }],
    );
    m.executeQueue.push(
      [{ organization_id: 'org_1', organizer_count: 4, active_organizer_count: 2, total_members: 20, active_members: 10 }],
      [{ organization_id: 'org_1', cases_managed: 12, avg_resolution_hours: 48 }],
    );
    const { GET } = await loadRoute();

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.organizations).toHaveLength(1);
    expect(json.organizations[0]).toMatchObject({
      organizationId: 'org_1',
      organizationName: 'Org 1',
      organizerAdoptionRate: 50,
      memberEngagementRate: 50,
      casesManaged: 12,
    });
    expect(json.organizations[0].milestones).toHaveLength(1);
    expect(json.pagination).toEqual({ limit: 25, offset: 0, total: 1, returned: 1 });
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });

  it('F06 A4: attributes figures to the right organization and never reads a neighbor figures', async () => {
    m.selectQueue.push(
      [{ total: 2 }],
      [enrollmentRow('org_1', 'Org 1'), enrollmentRow('org_2', 'Org 2')],
      [
        { organizationId: 'org_1', name: 'Only org 1', description: '', status: 'completed', targetDate: null, completedAt: null },
      ],
    );
    m.executeQueue.push(
      [{ organization_id: 'org_2', organizer_count: 2, active_organizer_count: 2, total_members: 10, active_members: 5 }],
      [{ organization_id: 'org_2', cases_managed: 9, avg_resolution_hours: 10 }],
    );
    const { GET } = await loadRoute();

    const json = await (await GET()).json();
    const [first, second] = json.organizations;

    expect(first).toMatchObject({ organizationId: 'org_1', organizerAdoptionRate: 10, memberEngagementRate: 20, casesManaged: 5 });
    expect(first.milestones).toHaveLength(1);
    expect(second).toMatchObject({ organizationId: 'org_2', organizerAdoptionRate: 100, memberEngagementRate: 50, casesManaged: 9 });
    expect(second.milestones).toHaveLength(0);
  });

  it('F06 A4: bounds the page and records the read', async () => {
    m.selectQueue.push([{ total: 500 }], []);
    const { GET } = await loadRoute();

    const response = await GET(new Request('http://localhost/api/pilot/overview?limit=100000&offset=-5'));
    const json = await response.json();

    expect(json.pagination).toMatchObject({ limit: 100, offset: 0, total: 500, returned: 0 });
    expect(m.chainCalls).toContainEqual(['limit', [100]]);
    expect(m.performAtomicAuditedOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'system',
        organizationId: 'platform_org',
        userId: 'u1',
        action: 'pilot.overview.read',
        details: { limit: 100, offset: 0 },
      }),
      expect.any(Function),
    );
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it('F06 A4: returns nothing when the read cannot be audited', async () => {
    const refusal = { status: 409, body: { error: 'audit' } };
    m.performAtomicAuditedOperation.mockRejectedValueOnce(new Error('audit down'));
    m.operationAuditResponse.mockReturnValueOnce(refusal);
    const { GET } = await loadRoute();

    const response = await GET();

    expect(response.status).toBe(409);
  });

  it('GET returns 500 when the query throws', async () => {
    m.performAtomicAuditedOperation.mockRejectedValueOnce(new Error('db down'));
    const { GET } = await loadRoute();

    expect((await GET()).status).toBe(500);
  });
});
