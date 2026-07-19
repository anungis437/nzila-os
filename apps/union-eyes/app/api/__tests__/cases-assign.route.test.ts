import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  requireEntitlement: vi.fn(),
  withRLSContext: vi.fn(),
  auditDataMutation: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  recordUnionEyesCaseAssigned: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  claimQueue: [] as unknown[][],
  insertQueue: [] as unknown[][],
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit-logger', () => ({ auditDataMutation: m.auditDataMutation }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/pilot-metrics', () => ({ recordUnionEyesCaseAssigned: m.recordUnionEyesCaseAssigned }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});

async function loadRoute() {
  return import('../cases/[caseId]/assign/route');
}

describe('cases/[caseId]/assign route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.claimQueue = [];
    m.insertQueue = [];
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.auditDataMutation.mockResolvedValue(undefined);
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
    m.recordUnionEyesCaseAssigned.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => (m.claimQueue.shift() ?? []) as unknown[]) })) })) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => (m.insertQueue.shift() ?? []) as unknown[]) })) })),
      };
      return fn(tx);
    });
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await POST(new Request('http://localhost/api/cases/c1/assign', { method: 'POST', body: '{}' }), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid json', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', { method: 'POST', body: '{bad-json' }), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(response.status).toBe(400);
  });

  it('returns 400 for validation error', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: '' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    expect(response.status).toBe(400);
  });

  it('returns 404 when case does not exist', async () => {
    const { POST } = await loadRoute();
    m.claimQueue.push([]);

    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assigneeId: 'u2' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    expect(response.status).toBe(404);
  });

  it('assigns case successfully', async () => {
    const { POST } = await loadRoute();
    m.claimQueue.push([{ claimId: 'c1', assignedTo: 'u0', status: 'filed' }]);
    m.insertQueue.push([{ updateId: 'up1' }]);

    const response = await POST(new Request('http://localhost/api/cases/c1/assign', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-trace-id': 't1' }, body: JSON.stringify({ assigneeId: 'u2', reason: 'workload' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.assignedTo).toBe('u2');
    expect(m.auditDataMutation).toHaveBeenCalled();
  });
});
