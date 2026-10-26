import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  hasMinRole: vi.fn(),
  emitCapeAuditEvent: vi.fn(),
  persistAtomicAudit: vi.fn(),
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
  insert: vi.fn(() => {
    const chain: any = {
      values: vi.fn(() => chain),
      onConflictDoUpdate: vi.fn(() => chain),
      returning: vi.fn(async () => [{ id: 'item-row-1' }]),
    };
    return chain;
  }),
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
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/pilot/cape-demo-data', () => ({ getDemoDatasetSummary: m.getDemoDatasetSummary }));

async function loadRoute() {
  return import('../pilot/onboarding/route');
}

const patch = async (body: unknown) => {
  const { PATCH } = await loadRoute();
  return PATCH(
    new NextRequest('http://localhost/api/pilot/onboarding/checklist', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { organizationId: 'org_1', userId: 'u1' },
  );
};

describe('pilot/onboarding route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.hasMinRole.mockResolvedValue(true);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));
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
    m.selectQueue.push([{ itemId: 'org-seeded', completed: true }]);

    const response = await patch({ itemId: 'org-seeded', completed: true });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.items['org-seeded']).toBe(true);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
  });

  it('PATCH records the audit on the same transaction as the toggle', async () => {
    m.selectQueue.push([{ itemId: 'org-seeded', completed: true }]);

    await patch({ itemId: 'org-seeded', completed: true });

    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'u1',
        action: 'PILOT_CHECKLIST_ITEM_COMPLETED',
        resourceType: 'pilot_checklist_items',
        resourceId: 'item-row-1',
        details: { itemId: 'org-seeded', completed: true, checklistComplete: false },
      }),
    );
  });

  it('PATCH also records the checklist completion when the last item is ticked', async () => {
    const all = ['org-seeded', 'users-invited', 'roles-assigned', 'contracts-uploaded', 'employers-imported', 'integrations-configured', 'export-verified'];
    m.selectQueue.push(all.map((itemId) => ({ itemId, completed: true })));

    await patch({ itemId: 'export-verified', completed: true });

    expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockDb, expect.objectContaining({ action: 'PILOT_CHECKLIST_COMPLETED' }));
  });

  it('PATCH fails when the audit cannot be written, so the toggle does not commit', async () => {
    m.selectQueue.push([{ itemId: 'org-seeded', completed: true }]);
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'));

    const response = await patch({ itemId: 'org-seeded', completed: true });

    expect(response.status).toBe(500);
  });

  it('PATCH writes no audit for an unknown item or a caller below officer', async () => {
    await patch({ itemId: 'not-real', completed: true });
    m.hasMinRole.mockResolvedValueOnce(false);
    const forbidden = await patch({ itemId: 'org-seeded', completed: true });

    expect(forbidden.status).toBe(403);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });
});
