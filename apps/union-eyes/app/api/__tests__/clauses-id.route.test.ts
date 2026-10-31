import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  roles: [] as string[],
  getClause: vi.fn(),
  getHierarchy: vi.fn(),
  updateClause: vi.fn(),
  deleteClause: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (role: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => {
    m.roles.push(role);
    return (req: NextRequest, ctx: Record<string, unknown> = {}) =>
      handler(req, { userId: 'u1', organizationId: 'org-1', ...ctx });
  },
}));
vi.mock('@/db/schema', () => ({ clauseTypeEnum: { enumValues: ['wages', 'overtime'] } }));
vi.mock('@/lib/services/clause-audited-service', () => ({
  getClauseForOrganization: m.getClause,
  getClauseHierarchyForOrganization: m.getHierarchy,
  updateClauseAudited: m.updateClause,
  deleteClauseAudited: m.deleteClause,
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { FORBIDDEN: 'FORBIDDEN', VALIDATION_ERROR: 'VALIDATION_ERROR', RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ code, message }), { status: code === 'RESOURCE_NOT_FOUND' ? 404 : code === 'FORBIDDEN' ? 403 : code === 'VALIDATION_ERROR' ? 400 : 500 }),
}));

const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/clauses/k1', { method, body: body ? JSON.stringify(body) : undefined, headers: { 'content-type': 'application/json' } });
const params = { params: Promise.resolve({ id: 'k1' }) };

describe('clauses/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PATCH and DELETE require a steward, GET stays member-level', async () => {
    await import('../clauses/[id]/route');
    const { GET, PATCH, DELETE } = await import('../clauses/[id]/route');
    m.getClause.mockResolvedValue(null);
    m.updateClause.mockResolvedValue({ id: 'k1' });
    m.deleteClause.mockResolvedValue(true);
    await GET(req('GET'), params);
    await PATCH(req('PATCH', { title: 'T' }), params);
    await DELETE(req('DELETE'), params);
    expect(m.roles).toEqual(expect.arrayContaining(['member', 'steward']));
    expect(m.roles.filter((r) => r === 'steward').length).toBeGreaterThanOrEqual(2);
  });

  it('PATCH updates inside the caller\'s organization as the caller, and ignores nothing it was not allowed to set', async () => {
    const { PATCH } = await import('../clauses/[id]/route');
    m.updateClause.mockResolvedValue({ id: 'k1' });
    const response = await PATCH(req('PATCH', { title: 'T' }), params);
    expect(response.status).toBe(200);
    expect(m.updateClause).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'u1' }, 'k1', { title: 'T' });
  });

  it('PATCH refuses ownership fields in the body', async () => {
    const { PATCH } = await import('../clauses/[id]/route');
    const response = await PATCH(req('PATCH', { title: 'T', organizationId: 'org-2', cbaId: 'x' }), params);
    expect(response.status).toBe(400);
    expect(m.updateClause).not.toHaveBeenCalled();
  });

  it('PATCH and DELETE on a clause outside the organization are 404', async () => {
    const { PATCH, DELETE } = await import('../clauses/[id]/route');
    m.updateClause.mockResolvedValue(null);
    m.deleteClause.mockResolvedValue(false);
    expect((await PATCH(req('PATCH', { title: 'T' }), params)).status).toBe(404);
    expect((await DELETE(req('DELETE'), params)).status).toBe(404);
  });

  it('GET reads within the caller\'s organization', async () => {
    const { GET } = await import('../clauses/[id]/route');
    m.getClause.mockResolvedValue({ id: 'k1' });
    await GET(req('GET'), params);
    expect(m.getClause).toHaveBeenCalledWith('org-1', 'k1', { countView: false });
  });
});
