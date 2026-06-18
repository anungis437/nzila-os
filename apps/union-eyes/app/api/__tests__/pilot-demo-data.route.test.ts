import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  hasMinRole: vi.fn(),
  emitCapeAuditEvent: vi.fn(),
  generateDemoEmployers: vi.fn(),
  generateDemoGrievances: vi.fn(),
  getDemoDatasetSummary: vi.fn(),
  assertPilotDemoMutationRuntime: vi.fn(),
  selectQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(async () => rows),
  };
  return chain;
}

const mockDb: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
  delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
};

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/audit/cape-audit-events', () => ({
  emitCapeAuditEvent: m.emitCapeAuditEvent,
  CAPE_AUDIT_EVENTS: { PILOT_DEMO_DATA_SEEDED: 'seeded', PILOT_DEMO_DATA_PURGED: 'purged' },
}));
vi.mock('@/lib/pilot/cape-demo-data', () => ({
  generateDemoEmployers: m.generateDemoEmployers,
  generateDemoGrievances: m.generateDemoGrievances,
  getDemoDatasetSummary: m.getDemoDatasetSummary,
}));
vi.mock('@/lib/config/pilot-demo-runtime', () => ({ assertPilotDemoMutationRuntime: m.assertPilotDemoMutationRuntime }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (fn: () => Promise<unknown>) => fn() }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    FORBIDDEN: 'FORBIDDEN', CONFLICT: 'CONFLICT', INTERNAL_ERROR: 'INTERNAL_ERROR', NOT_FOUND: 'NOT_FOUND',
  },
  standardErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ code, message }), { status: code === 'CONFLICT' ? 409 : code === 'NOT_FOUND' ? 404 : code === 'FORBIDDEN' ? 403 : 500 }),
  standardSuccessResponse: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));

async function loadRoute() {
  return import('../pilot/demo-data/route');
}

describe('pilot/demo-data route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.withOrganizationAuth.mockImplementation((h: (r: Request, c: any) => Promise<Response>) => (r: Request, c: any = { organizationId: 'org_1', userId: 'u1' }) => h(r, c));
    m.hasMinRole.mockResolvedValue(true);
    m.assertPilotDemoMutationRuntime.mockReturnValue('pilot');
    m.generateDemoEmployers.mockReturnValue([{ id: 'e1' }]);
    m.generateDemoGrievances.mockReturnValue([{ id: 'g1' }]);
    m.getDemoDatasetSummary.mockReturnValue({ employers: 1, grievances: 1 });
    m.emitCapeAuditEvent.mockResolvedValue(undefined);
  });

  it('POST rejects when runtime mode is disabled', async () => {
    const { POST } = await loadRoute();
    m.assertPilotDemoMutationRuntime.mockImplementationOnce(() => { throw new Error('disabled'); });

    const response = await POST(new Request('http://localhost/api/pilot/demo-data', { method: 'POST' }), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(403);
  });

  it('POST returns conflict when already seeded', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ organizationId: 'org_1', purgedAt: null }]);

    const response = await POST(new Request('http://localhost/api/pilot/demo-data', { method: 'POST' }), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(409);
  });

  it('POST seeds demo data successfully', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(new Request('http://localhost/api/pilot/demo-data', { method: 'POST' }), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.seeded).toBe(true);
  });

  it('DELETE returns not found when not seeded', async () => {
    const { DELETE } = await loadRoute();
    m.selectQueue.push([]);
    const response = await DELETE(new Request('http://localhost/api/pilot/demo-data', { method: 'DELETE' }), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(404);
  });

  it('DELETE purges demo data successfully', async () => {
    const { DELETE } = await loadRoute();
    m.selectQueue.push([{ organizationId: 'org_1', purgedAt: null }]);

    const response = await DELETE(new Request('http://localhost/api/pilot/demo-data', { method: 'DELETE' }), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.purged).toBe(true);
  });
});
