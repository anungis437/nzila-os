import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  hasMinRole: vi.fn(),
  emitCapeAuditEvent: vi.fn(),
  withRLSContext: vi.fn(),
  getDemoDatasetSummary: vi.fn(),
  selectQueue: [] as unknown[][],
}));

const mockDb = {
  select: vi.fn(() => {
    const chain: any = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve((m.selectQueue.shift() ?? []) as unknown[]).then(resolve),
    };
    return chain;
  }),
  insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
  })),
};

vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: vi.fn((handler: (req: NextRequest, ctx: any) => Promise<Response>) => (req: NextRequest, ctx: any) => handler(req, ctx)),
}));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/audit/cape-audit-events', () => ({
  CAPE_AUDIT_EVENTS: {
    PILOT_CHECKLIST_ITEM_COMPLETED: 'PILOT_CHECKLIST_ITEM_COMPLETED',
    PILOT_CHECKLIST_COMPLETED: 'PILOT_CHECKLIST_COMPLETED',
  },
  emitCapeAuditEvent: m.emitCapeAuditEvent,
}));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/pilot/cape-demo-data', () => ({ getDemoDatasetSummary: m.getDemoDatasetSummary }));

async function loadRoute() {
  return import('../pilot/onboarding/route');
}

describe('pilot/onboarding route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.hasMinRole.mockResolvedValue(true);
    m.emitCapeAuditEvent.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.getDemoDatasetSummary.mockReturnValue({ members: 10, employers: 2, grievances: 3, timelines: 1, resolutions: 1 });
  });

  it('GET returns forbidden for users below officer', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/pilot/onboarding'), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(403);
  });

  it('GET returns checklist state and demo metadata', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [{ itemId: 'org-seeded', completed: true }],
      [{ organizationId: 'org_1', memberCount: 12, employerCount: 3, grievanceCount: 5, purgedAt: null }],
    );

    const response = await GET(new NextRequest('http://localhost/api/pilot/onboarding'), { organizationId: 'org_1', userId: 'u1' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.completedCount).toBeGreaterThanOrEqual(1);
  });

  it('PATCH rejects invalid checklist item id', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(
      new NextRequest('http://localhost/api/pilot/onboarding/checklist', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: 'not-real', completed: true }),
      }),
      { organizationId: 'org_1', userId: 'u1' },
    );

    expect(response.status).toBe(404);
  });

  it('PATCH updates checklist item and returns recomputed status', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push(
      [],
      [{ itemId: 'org-seeded', completed: true }],
    );

    const response = await PATCH(
      new NextRequest('http://localhost/api/pilot/onboarding/checklist', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: 'org-seeded', completed: true }),
      }),
      { organizationId: 'org_1', userId: 'u1' },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(m.emitCapeAuditEvent).toHaveBeenCalled();
  });
});
