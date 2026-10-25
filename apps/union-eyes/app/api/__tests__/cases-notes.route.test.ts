import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  getUserRoleInOrganization: vi.fn(),
  requireEntitlement: vi.fn(),
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  claimQueue: [] as unknown[][],
  notesQueue: [] as unknown[][],
  insertQueue: [] as unknown[][],
  insertValues: vi.fn(),
  findReadableCase: vi.fn(),
  lastClaim: null as unknown,
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser, getUserRoleInOrganization: m.getUserRoleInOrganization }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/audit-logger', () => ({ auditLog: vi.fn().mockResolvedValue(undefined), AuditEventType: { AUTH_FAILED: 'AUTH_FAILED' }, AuditSeverity: { HIGH: 'HIGH' } }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), desc: vi.fn(() => 'desc') };
});


vi.mock('@/lib/cases/case-authorization', async (original) => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  findReadableCase: m.findReadableCase,
}));

async function loadRoute() {
  return import('../cases/[caseId]/notes/route');
}

describe('cases/[caseId]/notes route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.claimQueue = [];
    m.notesQueue = [];
    m.insertQueue = [];
    // One queued case per request; the follow-up internal-note decision re-decides the same case.
    m.findReadableCase.mockImplementation(async (_tx: unknown, _actor: unknown, _ref: string, _lock: boolean, action = 'case:read') => {
      if (action === 'case:write_notes') return m.lastClaim;
      m.lastClaim = (m.claimQueue.shift() ?? [])[0] ?? null;
      return m.lastClaim;
    });
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.getUserRoleInOrganization.mockResolvedValue('steward');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => (m.claimQueue.shift() ?? []) as unknown[]),
              orderBy: vi.fn(async () => (m.notesQueue.shift() ?? []) as unknown[]),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn((value: unknown) => {
            m.insertValues(value);
            return { returning: vi.fn(async () => (m.insertQueue.shift() ?? []) as unknown[]) };
          }),
        })),
      };
      return fn(tx);
    });
  });

  it('GET returns 401 when unauthenticated', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await GET(new Request('http://localhost/api/cases/c1/notes'), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(response.status).toBe(401);
  });

  it('GET returns 404 when case does not exist', async () => {
    const { GET } = await loadRoute();
    m.claimQueue.push([]);

    const response = await GET(new Request('http://localhost/api/cases/c1/notes'), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(response.status).toBe(404);
  });

  it('GET returns notes list', async () => {
    const { GET } = await loadRoute();
    m.claimQueue.push([{ claimId: 'c1', visibility: 'internal' }]);
    m.notesQueue.push([{ updateId: 'n1', message: 'note' }]);

    const response = await GET(new Request('http://localhost/api/cases/c1/notes'), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.notes).toHaveLength(1);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/cases/c1/notes', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad-json',
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    expect(response.status).toBe(400);
  });

  it('POST returns 404 when case does not exist', async () => {
    const { POST } = await loadRoute();
    m.claimQueue.push([]);

    const response = await POST(new Request('http://localhost/api/cases/c1/notes', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'hello', isInternal: false }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    expect(response.status).toBe(404);
  });

  it('POST creates note and returns 201', async () => {
    const { POST } = await loadRoute();
    m.claimQueue.push([{ claimId: 'c1', visibility: 'internal' }]);
    m.insertQueue.push([{ updateId: 'n1' }]);

    const response = await POST(new Request('http://localhost/api/cases/c1/notes', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'hello world', isInternal: true }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(m.persistAtomicAudit).toHaveBeenCalled();
  });
  it('keeps a representative note internal unless member visibility is chosen explicitly', async () => {
    const { POST } = await loadRoute();
    const post = (body: unknown) => POST(new Request('http://localhost/api/cases/c1/notes', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    m.claimQueue.push([{ claimId: 'c1', visibility: 'internal' }]);
    m.insertQueue.push([{ updateId: 'n1' }]);
    expect((await post({ text: 'working note' })).status).toBe(201);
    expect(m.insertValues).toHaveBeenLastCalledWith(expect.objectContaining({ isInternal: true, visibilityScope: 'staff' }));

    m.claimQueue.push([{ claimId: 'c1', visibility: 'internal' }]);
    m.insertQueue.push([{ updateId: 'n2' }]);
    expect((await post({ text: 'update for the member', isInternal: false })).status).toBe(201);
    expect(m.insertValues).toHaveBeenLastCalledWith(expect.objectContaining({ isInternal: false, visibilityScope: 'member' }));
  });

  it('records a member-authored note as member-visible', async () => {
    const { POST } = await loadRoute();
    m.getUserRoleInOrganization.mockResolvedValueOnce('member');
    m.claimQueue.push([{ claimId: 'c1', visibility: 'member_visible' }]);
    m.insertQueue.push([{ updateId: 'n3' }]);
    const response = await POST(new Request('http://localhost/api/cases/c1/notes', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'my message' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(response.status).toBe(201);
    expect(m.findReadableCase).toHaveBeenCalledTimes(1);
    expect(m.findReadableCase).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'c1', true, 'case:comment');
    expect(m.insertValues).toHaveBeenLastCalledWith(expect.objectContaining({ isInternal: false, visibilityScope: 'member' }));
  });

  it('denies member internal-note creation on the kernel decision before any business write', async () => {
    const { POST } = await loadRoute();
    const { ApiError } = await import('@/lib/api/errors');
    m.findReadableCase.mockImplementation(async (_tx: unknown, _actor: unknown, _ref: string, _lock: boolean, action = 'case:read') => {
      if (action === 'case:write_notes') throw ApiError.forbidden('This action is not permitted for this case.');
      return { claimId: 'c1', visibility: 'member_visible' };
    });
    const response = await POST(new Request('http://localhost/api/cases/c1/notes', {
      method:'POST',body:JSON.stringify({text:'private staff material',isInternal:true}),
    }), {params:Promise.resolve({caseId:'c1'})});
    expect(response.status).toBe(403);
    expect(m.findReadableCase).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 'c1', true, 'case:write_notes');
    expect(m.insertValues).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

});
