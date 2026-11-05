import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  getCba: vi.fn(),
  updateCba: vi.fn(),
  archiveCba: vi.fn(),
  createCba: vi.fn(),
  getClauses: vi.fn(),
  getNotes: vi.fn(),
  createNote: vi.fn(),
  listNotes: vi.fn(),
  rlsScopes: [] as unknown[],
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
// `cbas/route` and `bargaining-notes/route` are still wrapped by withRoleAuth; `cbas/[id]/route` is wrapped by withApi (the stub above).
vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (_role: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    (req: NextRequest, ctx: Record<string, unknown> = {}) =>
      handler(req, { userId: 'u1', organizationId: 'org-1', params: { id: 'c1' }, ...ctx }),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('@/lib/services/cba-audited-service', () => ({
  getCbaForOrganization: m.getCba,
  updateCbaAudited: m.updateCba,
  archiveCbaAudited: m.archiveCba,
  createCbaAudited: m.createCba,
}));
vi.mock('@/lib/services/clause-service', () => ({ getClausesByCBAId: m.getClauses }));
vi.mock('@/lib/services/bargaining-notes-service', () => ({
  getBargainingNotesByCBA: m.getNotes,
  listBargainingNotes: m.listNotes,
  getBargainingTimeline: vi.fn(),
  getBargainingNotesStatistics: vi.fn(),
  getSessionTypes: vi.fn(),
}));
vi.mock('@/lib/services/bargaining-notes-audited-service', () => ({
  createBargainingNoteAudited: m.createNote,
  ForeignAgreementError: class ForeignAgreementError extends Error {},
}));
vi.mock('@/lib/services/cba-service', () => ({ listCBAs: vi.fn() }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (scope: unknown, fn: () => unknown) => { m.rlsScopes.push(scope); return fn(); } }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

const CBA_ID = '11111111-1111-4111-8111-111111111111';

const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(url, { method, body: body ? JSON.stringify(body) : undefined, headers: { 'content-type': 'application/json' } });

describe('cbas/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.userId = 'u1';
    caller.organizationId = 'org-1';
    caller.role = 'steward';
    caller.params = { id: CBA_ID };
  });

  it('declares what it asks of the wrapper: a member to read it (in the organization\'s tenant transaction) and a steward to change or archive it', async () => {
    await import('../cbas/[id]/route');
    const read = declared.find((entry) => entry.openapi?.summary === 'Read a collective agreement with its clauses and bargaining notes');
    const update = declared.find((entry) => entry.openapi?.summary === 'Update a collective agreement');
    const archive = declared.find((entry) => entry.openapi?.summary === 'Archive a collective agreement (never a hard delete)');

    expect(read?.auth).toEqual({ minRole: 'member' });
    expect(read?.rlsOrgContext).toBe(true);
    // The audited services open their own tenant transaction, so the wrapper opens none for the writes.
    expect(update?.auth).toEqual({ minRole: 'steward' });
    expect(update?.rlsOrgContext).toBeUndefined();
    expect(archive?.auth).toEqual({ minRole: 'steward' });
    expect(archive?.rlsOrgContext).toBeUndefined();
  });

  it('refuses a member the change and the archive before any service is reached, and lets a member read', async () => {
    caller.role = 'member';
    const { PATCH, DELETE, GET } = await import('../cbas/[id]/route');

    expect((await PATCH(json(`http://x/api/cbas/${CBA_ID}`, 'PATCH', { title: 'T' }))).status).toBe(403);
    expect((await DELETE(json(`http://x/api/cbas/${CBA_ID}`, 'DELETE'))).status).toBe(403);
    expect(m.updateCba).not.toHaveBeenCalled();
    expect(m.archiveCba).not.toHaveBeenCalled();

    m.getCba.mockResolvedValue({ id: CBA_ID });
    expect((await GET(json(`http://x/api/cbas/${CBA_ID}`, 'GET'))).status).toBe(200);
  });

  it('answers 400, and reaches no service, for an id that is not a valid id', async () => {
    caller.params = { id: 'c1' };
    const { PATCH, DELETE, GET } = await import('../cbas/[id]/route');

    expect((await GET(json('http://x/api/cbas/c1', 'GET'))).status).toBe(400);
    expect((await PATCH(json('http://x/api/cbas/c1', 'PATCH', { title: 'T' }))).status).toBe(400);
    expect((await DELETE(json('http://x/api/cbas/c1', 'DELETE'))).status).toBe(400);
    expect(m.getCba).not.toHaveBeenCalled();
    expect(m.updateCba).not.toHaveBeenCalled();
    expect(m.archiveCba).not.toHaveBeenCalled();
  });

  it('PATCH updates within the caller\'s organization and reports another organization\'s CBA as 404', async () => {
    const { PATCH } = await import('../cbas/[id]/route');
    m.updateCba.mockResolvedValueOnce({ kind: 'updated', cba: { id: CBA_ID } });
    expect((await PATCH(json(`http://x/api/cbas/${CBA_ID}`, 'PATCH', { title: 'T' }))).status).toBe(200);
    expect(m.updateCba).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'u1' }, CBA_ID, { title: 'T' });

    m.updateCba.mockResolvedValueOnce({ kind: 'not_found' });
    expect((await PATCH(json(`http://x/api/cbas/${CBA_ID}`, 'PATCH', { title: 'T' }))).status).toBe(404);
  });

  it('PATCH reports a concurrent status change as a conflict', async () => {
    const { PATCH } = await import('../cbas/[id]/route');
    m.updateCba.mockResolvedValue({ kind: 'conflict' });
    expect((await PATCH(json(`http://x/api/cbas/${CBA_ID}`, 'PATCH', { status: 'expired' }))).status).toBe(409);
  });

  it('PATCH refuses to change visibility', async () => {
    const { PATCH } = await import('../cbas/[id]/route');
    expect((await PATCH(json(`http://x/api/cbas/${CBA_ID}`, 'PATCH', { isPublic: true }))).status).toBe(403);
    expect(m.updateCba).not.toHaveBeenCalled();
  });

  it('DELETE only archives, in the caller\'s organization, and a "hard" request is not honoured', async () => {
    const { DELETE } = await import('../cbas/[id]/route');
    m.archiveCba.mockResolvedValue('archived');
    expect((await DELETE(json(`http://x/api/cbas/${CBA_ID}?hard=true`, 'DELETE'))).status).toBe(200);
    expect(m.archiveCba).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'u1' }, CBA_ID);

    m.archiveCba.mockResolvedValueOnce('not_found');
    expect((await DELETE(json(`http://x/api/cbas/${CBA_ID}`, 'DELETE'))).status).toBe(404);
    m.archiveCba.mockResolvedValueOnce('already_archived');
    expect((await DELETE(json(`http://x/api/cbas/${CBA_ID}`, 'DELETE'))).status).toBe(409);
  });

  it('GET reads within the organization and keeps privileged notes from other members', async () => {
    const { GET } = await import('../cbas/[id]/route');
    m.getCba.mockResolvedValue({ id: CBA_ID });
    m.getNotes.mockResolvedValue([
      { id: 'n1', confidentialityLevel: 'internal', createdBy: 'other' },
      { id: 'n2', confidentialityLevel: 'confidential', createdBy: 'other' },
      { id: 'n3', confidentialityLevel: 'restricted', createdBy: 'u1' },
    ]);
    const response = await GET(json(`http://x/api/cbas/${CBA_ID}?includeNotes=true`, 'GET'));
    const body = await response.json();
    expect(m.getCba).toHaveBeenCalledWith('org-1', CBA_ID, { countView: false });
    expect(m.getNotes).toHaveBeenCalledWith(CBA_ID, 'org-1');
    expect(body.bargainingNotes.map((n: { id: string }) => n.id)).toEqual(['n1', 'n3']);
  });
});

describe('cbas route', () => {
  beforeEach(() => vi.clearAllMocks());

  const valid = {
    cbaNumber: 'N-1', title: 'T', jurisdiction: 'ontario', employerName: 'E', unionName: 'U',
    effectiveDate: '2025-01-01', expiryDate: '2026-01-01', industrySector: 'S',
  };

  it('POST creates in the caller\'s organization, never from the body, and never takes visibility from it', async () => {
    const { POST } = await import('../cbas/route');
    m.createCba.mockResolvedValue({ id: 'c1' });
    const response = await POST(json('http://x/api/cbas', 'POST', { ...valid, isPublic: true, createdBy: 'evil', id: 'forced' }));
    expect(response.status).toBe(201);
    const [scope, data] = m.createCba.mock.calls[0];
    expect(scope).toEqual({ organizationId: 'org-1', userId: 'u1' });
    expect(data).not.toHaveProperty('isPublic');
    expect(data).not.toHaveProperty('createdBy');
    expect(data).not.toHaveProperty('id');
  });

  it('POST refuses a body organization that is not the caller\'s', async () => {
    const { POST } = await import('../cbas/route');
    const response = await POST(json('http://x/api/cbas', 'POST', { ...valid, organizationId: '99999999-9999-4999-8999-999999999999' }));
    expect(response.status).toBe(403);
    expect(m.createCba).not.toHaveBeenCalled();
  });
});

describe('bargaining-notes route', () => {
  beforeEach(() => { vi.clearAllMocks(); m.rlsScopes.length = 0; });

  const note = { sessionDate: '2025-01-01', sessionType: 'negotiation', title: 'T', content: 'C' };

  it('POST stores the note for the caller\'s organization', async () => {
    const { POST } = await import('../bargaining-notes/route');
    m.createNote.mockResolvedValue({ id: 'n1' });
    const response = await POST(json('http://x/api/bargaining-notes', 'POST', note));
    expect(response.status).toBe(200);
    expect(m.createNote).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'u1' }, expect.objectContaining({ title: 'T' }));
  });

  it('POST refuses a body organization that is not the caller\'s and an array body', async () => {
    const { POST } = await import('../bargaining-notes/route');
    const other = await POST(json('http://x/api/bargaining-notes', 'POST', { ...note, organizationId: '99999999-9999-4999-8999-999999999999' }));
    expect(other.status).toBe(403);
    const bulk = await POST(json('http://x/api/bargaining-notes', 'POST', [note]));
    expect(bulk.status).toBe(400);
    expect(m.createNote).not.toHaveBeenCalled();
  });

  it('POST reports an agreement of another organization as not found', async () => {
    const { POST } = await import('../bargaining-notes/route');
    const { ForeignAgreementError } = await import('@/lib/services/bargaining-notes-audited-service');
    m.createNote.mockRejectedValue(new ForeignAgreementError());
    const response = await POST(json('http://x/api/bargaining-notes', 'POST', { ...note, cbaId: '11111111-1111-4111-8111-111111111111' }));
    expect(response.status).toBe(404);
  });

  it('GET always lists within the caller\'s organization and only the notes visible to the caller', async () => {
    const { GET } = await import('../bargaining-notes/route');
    m.getCba.mockResolvedValue({ id: 'c1' });
    m.listNotes.mockResolvedValue({ notes: [], total: 0, page: 1, limit: 20 });
    await GET(json('http://x/api/bargaining-notes', 'GET'));
    expect(m.listNotes).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', visibleToUserId: 'u1' }),
      expect.anything(),
    );
    expect(m.rlsScopes).toContainEqual({ organizationId: 'org-1', userId: 'u1' });
    const foreign = await GET(json('http://x/api/bargaining-notes?organizationId=org-2', 'GET'));
    expect(foreign.status).toBe(403);
  });

  it('GET tag-filtered listing remains inside the authenticated tenant transaction', async () => {
    const { GET } = await import('../bargaining-notes/route');
    m.listNotes.mockResolvedValue({ notes: [], total: 0, page: 1, limit: 20 });
    const response = await GET(json('http://x/api/bargaining-notes?tags=seniority', 'GET'));
    expect(response.status).toBe(200);
    expect(m.rlsScopes).toContainEqual({ organizationId: 'org-1', userId: 'u1' });
    expect(m.listNotes).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', visibleToUserId: 'u1', tags: ['seniority'] }),
      expect.anything(),
    );
  });

  it('GET tag filtering cannot escape its requested agreement', async () => {
    const { GET } = await import('../bargaining-notes/route');
    m.getCba.mockResolvedValue({ id: 'c1' });
    m.listNotes.mockResolvedValue({ notes: [], total: 0, page: 1, limit: 20 });
    const response = await GET(json('http://x/api/bargaining-notes?cbaId=c1&tags=seniority', 'GET'));
    expect(response.status).toBe(200);
    expect(m.getCba).toHaveBeenCalledWith('org-1', 'c1');
    expect(m.listNotes).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', visibleToUserId: 'u1', cbaId: 'c1', tags: ['seniority'] }),
      expect.anything(),
    );
    expect(m.rlsScopes).toContainEqual({ organizationId: 'org-1', userId: 'u1' });
  });

  it('GET for an agreement outside the organization is 404', async () => {
    const { GET } = await import('../bargaining-notes/route');
    m.getCba.mockResolvedValue(null);
    expect((await GET(json('http://x/api/bargaining-notes?cbaId=c-x', 'GET'))).status).toBe(404);
  });
});
