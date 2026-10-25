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
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (_role: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    (req: NextRequest, ctx: Record<string, unknown> = {}) =>
      handler(req, { userId: 'u1', organizationId: 'org-1', params: { id: 'c1' }, ...ctx }),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
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
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_s: unknown, fn: () => unknown) => fn() }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { FORBIDDEN: 'FORBIDDEN', VALIDATION_ERROR: 'VALIDATION_ERROR', RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND', CONFLICT: 'CONFLICT', INTERNAL_ERROR: 'INTERNAL_ERROR', ALREADY_EXISTS: 'ALREADY_EXISTS' },
  standardErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ code, message }), {
      status: ({ RESOURCE_NOT_FOUND: 404, FORBIDDEN: 403, VALIDATION_ERROR: 400, CONFLICT: 409, ALREADY_EXISTS: 409 } as Record<string, number>)[code] ?? 500,
    }),
  standardSuccessResponse: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));

const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(url, { method, body: body ? JSON.stringify(body) : undefined, headers: { 'content-type': 'application/json' } });

describe('cbas/[id] route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PATCH updates within the caller\'s organization and reports another organization\'s CBA as 404', async () => {
    const { PATCH } = await import('../cbas/[id]/route');
    m.updateCba.mockResolvedValueOnce({ kind: 'updated', cba: { id: 'c1' } });
    expect((await PATCH(json('http://x/api/cbas/c1', 'PATCH', { title: 'T' }))).status).toBe(200);
    expect(m.updateCba).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'u1' }, 'c1', { title: 'T' });

    m.updateCba.mockResolvedValueOnce({ kind: 'not_found' });
    expect((await PATCH(json('http://x/api/cbas/c1', 'PATCH', { title: 'T' }))).status).toBe(404);
  });

  it('PATCH reports a concurrent status change as a conflict', async () => {
    const { PATCH } = await import('../cbas/[id]/route');
    m.updateCba.mockResolvedValue({ kind: 'conflict' });
    expect((await PATCH(json('http://x/api/cbas/c1', 'PATCH', { status: 'expired' }))).status).toBe(409);
  });

  it('PATCH refuses to change visibility', async () => {
    const { PATCH } = await import('../cbas/[id]/route');
    expect((await PATCH(json('http://x/api/cbas/c1', 'PATCH', { isPublic: true }))).status).toBe(403);
    expect(m.updateCba).not.toHaveBeenCalled();
  });

  it('DELETE only archives, in the caller\'s organization, and a "hard" request is not honoured', async () => {
    const { DELETE } = await import('../cbas/[id]/route');
    m.archiveCba.mockResolvedValue('archived');
    expect((await DELETE(json('http://x/api/cbas/c1?hard=true', 'DELETE'))).status).toBe(200);
    expect(m.archiveCba).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'u1' }, 'c1');

    m.archiveCba.mockResolvedValueOnce('not_found');
    expect((await DELETE(json('http://x/api/cbas/c1', 'DELETE'))).status).toBe(404);
    m.archiveCba.mockResolvedValueOnce('already_archived');
    expect((await DELETE(json('http://x/api/cbas/c1', 'DELETE'))).status).toBe(409);
  });

  it('GET reads within the organization and keeps privileged notes from other members', async () => {
    const { GET } = await import('../cbas/[id]/route');
    m.getCba.mockResolvedValue({ id: 'c1' });
    m.getNotes.mockResolvedValue([
      { id: 'n1', confidentialityLevel: 'internal', createdBy: 'other' },
      { id: 'n2', confidentialityLevel: 'confidential', createdBy: 'other' },
      { id: 'n3', confidentialityLevel: 'restricted', createdBy: 'u1' },
    ]);
    const response = await GET(json('http://x/api/cbas/c1?includeNotes=true', 'GET'));
    const body = await response.json();
    expect(m.getCba).toHaveBeenCalledWith('org-1', 'c1', { countView: false });
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
  beforeEach(() => vi.clearAllMocks());

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
    const foreign = await GET(json('http://x/api/bargaining-notes?organizationId=org-2', 'GET'));
    expect(foreign.status).toBe(403);
  });

  it('GET for an agreement outside the organization is 404', async () => {
    const { GET } = await import('../bargaining-notes/route');
    m.getCba.mockResolvedValue(null);
    expect((await GET(json('http://x/api/bargaining-notes?cbaId=c-x', 'GET'))).status).toBe(404);
  });
});
